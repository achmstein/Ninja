import 'package:dio/dio.dart';
import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../../../core/config/app_config.dart';
import '../../../core/providers/branch_provider.dart';
import '../models/order.dart';
import '../services/order_service.dart';

/// Customer app orders waiting for a cashier to accept them, oldest first —
/// the one that has waited longest is the one to deal with. Branch-scoped
/// by the X-Branch-Id header every request carries. SignalR is the primary
/// update path; the poll is only a fallback.
class PendingOrdersNotifier extends AsyncNotifier<List<Order>> {
  Timer? _poll;

  @override
  Future<List<Order>> build() async {
    ref.watch(selectedBranchIdProvider);
    _poll?.cancel();
    _poll = Timer.periodic(AppConfig.pendingOrdersPoll, (_) => refresh());
    ref.onDispose(() => _poll?.cancel());
    return _sorted(await ref.read(orderRepositoryProvider).getPendingOrders());
  }

  Future<void> refresh() async {
    final result = await AsyncValue.guard(() async => _sorted(await ref.read(orderRepositoryProvider).getPendingOrders()));
    if (!ref.mounted) return;
    if (result.hasValue) state = result;
  }

  /// Confirm / cancel a pending order, the same two calls the admin board
  /// makes. Each carries a fresh idempotency key: a double tap on a slow
  /// connection must not turn into two commands. Confirming lands the lines
  /// on a ticket through the order-confirmed event, so the ticket queries
  /// refetch on the TicketUpdated signal that follows.
  Future<bool> confirm(int orderId) => _act(() => ref.read(orderRepositoryProvider).confirmOrder(orderId, requestId: const Uuid().v4()));

  Future<bool> cancel(int orderId) => _act(() => ref.read(orderRepositoryProvider).cancelOrder(orderId, requestId: const Uuid().v4()));

  /// "Nobody at the table": the order goes and the device that placed it is
  /// turned away for the day
  Future<bool> rejectGuest(int orderId) =>
      _act(() => ref.read(orderRepositoryProvider).rejectGuestOrder(orderId, requestId: const Uuid().v4()));

  Future<bool> _act(Future<bool> Function() call) async {
    try {
      final ok = await call();
      await refresh();
      return ok;
    } catch (_) {
      return false;
    }
  }

  static List<Order> _sorted(List<Order> orders) => [...orders]..sort((a, b) => a.date.compareTo(b.date));
}

final pendingOrdersProvider = AsyncNotifierProvider<PendingOrdersNotifier, List<Order>>(PendingOrdersNotifier.new);

/// One order in full, for the look-before-accepting dialog
final orderDetailsProvider = FutureProvider.autoDispose.family<Order, int>(
  (ref, orderId) => ref.read(orderRepositoryProvider).getOrderDetails(orderId),
  // A refusal (404, 403) stays a refusal: say so at once instead of looping back to loading;
  // a dropped connection gets Riverpod's usual retries
  retry: (count, error) {
    final status = error is DioException ? error.response?.statusCode : null;
    if (status != null && status >= 400 && status < 500) return null;
    return count < 3 ? Duration(milliseconds: 200 * (1 << count)) : null;
  },
);

/// The pending orders that will land on this ticket once confirmed: a room
/// order carries its session, a table order its table. Counter tickets
/// never match — nothing orders into them from an app.
List<Order> pendingForTicket(List<Order> pending, {int? sessionId, int? placeId}) => [
      for (final order in pending)
        if ((sessionId != null && order.sessionId == sessionId) ||
            (placeId != null && order.sessionId == null && order.placeId == placeId))
          order,
    ];
