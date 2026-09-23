import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../../../core/config/app_config.dart';
import '../../../core/providers/branch_provider.dart';
import '../models/kitchen_order.dart';
import '../services/kitchen_service.dart';
import 'station_provider.dart';

/// The kitchen's day: every confirmed order of the last 24 hours, oldest
/// first, for the active branch (the X-Branch-Id header every request
/// carries) — on a station's display, that station's part of each. The
/// board shows the open ones, the history the ready ones.
/// SignalR is the primary update path; the poll is only a fallback, as in
/// kds_web's use-kitchen-orders.
class KitchenOrdersNotifier extends AsyncNotifier<List<KitchenOrder>> {
  Timer? _poll;

  @override
  Future<List<KitchenOrder>> build() async {
    ref.watch(selectedBranchIdProvider);
    ref.watch(selectedStationIdProvider);
    _poll?.cancel();
    _poll = Timer.periodic(AppConfig.kitchenPoll, (_) => refresh());
    ref.onDispose(() => _poll?.cancel());
    return _fetch();
  }

  Future<List<KitchenOrder>> _fetch() async =>
      _sorted(await ref.read(kitchenRepositoryProvider).getKitchenOrders(stationId: ref.read(selectedStationIdProvider)));

  /// Refetch in place. A failed poll keeps the last good board on screen
  /// rather than blanking it.
  Future<void> refresh() async {
    final result = await AsyncValue.guard(_fetch);
    if (!ref.mounted) return;
    if (result.hasValue) state = result;
  }

  /// Ready / Bring back. The card leaves (or rejoins) the board the instant
  /// it is tapped — optimistic, because a barista with a hot cup in one hand
  /// does not wait for a round trip — and the board refetches once the
  /// server has spoken, whichever way. A refusal puts the card back and
  /// rethrows so the screen can say why.
  Future<void> setReady(int orderNumber, bool ready) async {
    final previous = state.value;
    if (previous == null) return;
    final now = DateTime.now().toUtc();
    state = AsyncData([
      for (final order in previous)
        if (order.orderNumber == orderNumber) order.withReadyAt(ready ? now : null) else order,
    ]);
    try {
      await ref
          .read(kitchenRepositoryProvider)
          .setReady(orderNumber, ready, stationId: ref.read(selectedStationIdProvider), requestId: const Uuid().v4());
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

/// The board: what is still to be made, oldest first
List<KitchenOrder> openOrders(List<KitchenOrder> orders) => [
      for (final order in orders)
        if (!order.isReady) order,
    ];

/// The history: what was finished today, newest first
List<KitchenOrder> finishedOrders(List<KitchenOrder> orders) => [
      for (final order in orders)
        if (order.isReady) order,
    ]..sort((a, b) => b.readyAt!.compareTo(a.readyAt!));
