import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../../../core/config/app_config.dart';
import '../../../core/providers/branch_provider.dart';
import '../models/kitchen_order.dart';
import '../services/kitchen_service.dart';

/// The board: every order the kitchen still has to deal with, oldest
/// first, for the active branch (the X-Branch-Id header every request
/// carries). SignalR is the primary update path; the poll is only a
/// fallback, as in kds_web's use-kitchen-orders.
class KitchenOrdersNotifier extends AsyncNotifier<List<KitchenOrder>> {
  Timer? _poll;

  @override
  Future<List<KitchenOrder>> build() async {
    ref.watch(selectedBranchIdProvider);
    _poll?.cancel();
    _poll = Timer.periodic(AppConfig.kitchenPoll, (_) => refresh());
    ref.onDispose(() => _poll?.cancel());
    return _sorted(await ref.read(kitchenRepositoryProvider).getKitchenOrders());
  }

  /// Refetch in place. A failed poll keeps the last good board on screen
  /// rather than blanking it.
  Future<void> refresh() async {
    final result = await AsyncValue.guard(() async => _sorted(await ref.read(kitchenRepositoryProvider).getKitchenOrders()));
    if (!ref.mounted) return;
    if (result.hasValue) state = result;
  }

  /// Start / Ready / Recall. The card moves lanes the instant it is tapped —
  /// optimistic, because a barista with a hot cup in one hand does not wait
  /// for a round trip — and the board refetches once the server has spoken,
  /// whichever way. A refusal puts the card back and rethrows so the screen
  /// can say why.
  Future<void> setPreparation(int orderNumber, PreparationStatus target) async {
    final previous = state.value;
    if (previous == null) return;
    final now = DateTime.now().toUtc();
    state = AsyncData([
      for (final order in previous)
        if (order.orderNumber == orderNumber)
          order.copyWith(
            preparation: target,
            preparingAt: target == PreparationStatus.preparing ? (order.preparingAt ?? now) : order.preparingAt,
            readyAt: target == PreparationStatus.ready ? now : null,
            clearReadyAt: target != PreparationStatus.ready,
          )
        else
          order,
    ]);
    try {
      await ref.read(kitchenRepositoryProvider).setPreparation(orderNumber, target, requestId: const Uuid().v4());
    } catch (_) {
      if (ref.mounted) state = AsyncData(previous);
      rethrow;
    } finally {
      await refresh();
    }
  }

  static List<KitchenOrder> _sorted(List<KitchenOrder> orders) => [...orders]..sort((a, b) => a.since.compareTo(b.since));
}

final kitchenOrdersProvider = AsyncNotifierProvider<KitchenOrdersNotifier, List<KitchenOrder>>(KitchenOrdersNotifier.new);

/// The orders in one lane, in board order
List<KitchenOrder> laneOrders(List<KitchenOrder> orders, PreparationStatus lane) => [
      for (final order in orders)
        if (order.preparation == lane) order,
    ];
