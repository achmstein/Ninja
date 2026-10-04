import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../models/delivery_order.dart';

/// The branch's own deliveries, as the till works them: the board, its
/// riders, giving one to a rider and taking the cash in, standing in for a
/// rider whose phone cannot say it left or arrived, and what a delivery
/// taken over the phone asks.
class DeliveryRepository {
  final ApiClient _orders;
  final ApiClient _identity;

  DeliveryRepository(this._orders, this._identity);

  List<Map<String, dynamic>> _list(Object? data) =>
      [for (final e in (data as List<dynamic>? ?? const [])) (e as Map).cast<String, dynamic>()];

  Future<List<DeliveryOrder>> getDeliveries() async {
    final response = await _orders.get('deliveries');
    return [for (final e in _list(response.data)) DeliveryOrder.fromJson(e)];
  }

  /// The riders whose app has checked in at the branch, on duty first
  Future<List<TillRider>> getRiders() async {
    final response = await _orders.get('riders');
    return [for (final e in _list(response.data)) TillRider.fromJson(e)];
  }

  /// Every Rider account, with its branches: those not yet heard from join the picker
  Future<List<RiderAccount>> getRiderAccounts() async {
    final response = await _identity.get('users', queryParameters: {'role': 'Rider', 'max': 200});
    return [for (final e in _list(response.data)) RiderAccount.fromJson(e)];
  }

  Future<void> assignRider(int orderId, TillRider rider) =>
      _orders.put('$orderId/delivery/rider', data: {'riderUserId': rider.userId, 'riderName': rider.name});

  Future<void> unassignRider(int orderId) => _orders.delete('$orderId/delivery/rider');

  Future<void> markOut(int orderId) => _orders.put('$orderId/delivery/out');

  Future<void> markDelivered(int orderId) => _orders.put('$orderId/delivery/delivered');

  Future<void> cashIn(int orderId) => _orders.put('$orderId/delivery/cash-in');

  /// The branch's fee, minimum and radius for a delivery taken over the
  /// phone; with a pasted [location], the pin read from it and how far
  Future<TillDeliveryQuote> tillQuote({String? location}) async {
    final response = await _orders.get('delivery/till-quote', queryParameters: {
      if ((location ?? '').trim().isNotEmpty) 'location': location!.trim(),
    });
    return TillDeliveryQuote.fromJson((response.data as Map).cast<String, dynamic>());
  }

  /// Where a caller asked to be delivered before, by account or number
  Future<List<KnownAddress>> knownAddresses({String? customerUserId, String? phone}) async {
    final response = await _orders.get('delivery/known-addresses', queryParameters: {
      if ((customerUserId ?? '').isNotEmpty) 'customerUserId': customerUserId,
      if ((phone ?? '').isNotEmpty) 'phone': phone,
    });
    return [for (final e in _list(response.data)) KnownAddress.fromJson(e)];
  }
}

final deliveryRepositoryProvider = Provider<DeliveryRepository>(
  (ref) => DeliveryRepository(ref.read(ordersApiProvider), ref.read(identityApiProvider)),
);
