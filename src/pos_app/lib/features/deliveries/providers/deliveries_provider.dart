import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/config/app_config.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import 'package:uuid/uuid.dart';
import '../../orders/models/stock_disposition.dart';
import '../../orders/services/order_service.dart';
import '../../tickets/providers/tickets_provider.dart';
import '../models/delivery_order.dart';
import '../services/delivery_service.dart';

/// The branch's deliveries on the board's order: waiting for a rider, with
/// one, coming back, back, delivered with the cash still out. Nothing at all
/// where the business does not deliver (an add-on): no request, no poll. The
/// hub's DeliveryChanged is the primary update path; the poll covers a dead socket.
class DeliveriesNotifier extends AsyncNotifier<List<DeliveryOrder>> {
  Timer? _poll;

  @override
  Future<List<DeliveryOrder>> build() async {
    ref.watch(selectedBranchIdProvider);
    _poll?.cancel();
    if (!ref.watch(featuresProvider.select((f) => f.delivery))) return const [];
    _poll = Timer.periodic(AppConfig.deliveriesPoll, (_) => refresh());
    ref.onDispose(() => _poll?.cancel());
    return _load();
  }

  Future<List<DeliveryOrder>> _load() async => boardOrder(await ref.read(deliveryRepositoryProvider).getDeliveries());

  Future<void> refresh() async {
    if (!ref.read(featuresProvider).delivery) return;
    final result = await AsyncValue.guard(_load);
    if (!ref.mounted) return;
    if (result.hasValue) state = result;
  }
}

final deliveriesProvider = AsyncNotifierProvider<DeliveriesNotifier, List<DeliveryOrder>>(DeliveriesNotifier.new);

/// The rider picker: every rider of the branch, as Ordering lists them (on
/// duty first, then those not yet heard from)
final tillRidersProvider = FutureProvider.autoDispose<List<TillRider>>((ref) async {
  ref.watch(selectedBranchIdProvider);
  return ref.read(deliveryRepositoryProvider).getRiders();
});

/// What a delivery taken over the phone asks, for the sale pad's button:
/// whether the branch delivers (even while the customers' orders are paused)
/// and its fee. Not asked where the business does not deliver.
final tillDeliveryTermsProvider = FutureProvider.autoDispose<TillDeliveryQuote>((ref) async {
  ref.watch(selectedBranchIdProvider);
  if (!ref.watch(featuresProvider.select((f) => f.delivery))) return const TillDeliveryQuote();
  return ref.read(deliveryRepositoryProvider).tillQuote();
});

/// The till's moves on a delivery: each one, then the board and the riders
/// read again (and the open bills, for cash taken in or an order cancelled).
/// Errors are rethrown for the screen to say, in the till's language.
class DeliveryActions {
  final Ref _ref;

  DeliveryActions(this._ref);

  DeliveryRepository get _repository => _ref.read(deliveryRepositoryProvider);

  Future<void> _then(Future<void> Function() move, {bool bills = false}) async {
    await move();
    await _ref.read(deliveriesProvider.notifier).refresh();
    _ref.invalidate(tillRidersProvider);
    if (bills) await _ref.read(openTicketsProvider.notifier).refresh();
  }

  Future<void> assign(int orderId, TillRider rider) => _then(() => _repository.assignRider(orderId, rider));

  Future<void> takeBack(int orderId) => _then(() => _repository.unassignRider(orderId));

  Future<void> markOut(int orderId) => _then(() => _repository.markOut(orderId));

  Future<void> markDelivered(int orderId) => _then(() => _repository.markDelivered(orderId));

  Future<void> markFailed(int orderId, String reason) => _then(() => _repository.markFailed(orderId, reason));

  Future<void> markReturned(int orderId) => _then(() => _repository.markReturned(orderId));

  Future<void> cashIn(int orderId, double amount) => _then(() => _repository.cashIn(orderId, amount), bills: true);

  /// A rider's cash for several deliveries, taken in at once
  Future<void> cashInMany(Map<int, double> amounts) => _then(() => _repository.cashInMany(amounts), bills: true);

  /// The bag is back and nobody will have it: the order is called off, its
  /// food written off or back to stock as the cashier said
  Future<void> cancelReturned(int orderId, StockDisposition disposition) => _then(
      () async => await _ref
          .read(orderRepositoryProvider)
          .cancelOrder(orderId, requestId: const Uuid().v4(), stockDisposition: disposition.wire),
      bills: true);
}

final deliveryActionsProvider = Provider<DeliveryActions>(DeliveryActions.new);
