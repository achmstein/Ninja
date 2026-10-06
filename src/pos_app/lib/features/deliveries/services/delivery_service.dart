import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../models/delivery_order.dart';

/// The branch's own deliveries, as the till works them: the board, its
/// riders, giving one to a rider and taking the cash in, standing in for a
/// rider whose phone cannot say it left, arrived or did not, the bag back at
/// the branch, and what a delivery taken over the phone asks. Ordering is the
/// one service it talks to: who the branch's riders are is Ordering's to say.
class DeliveryRepository {
  final ApiClient _orders;

  DeliveryRepository(this._orders);

  List<Map<String, dynamic>> _list(Object? data) =>
      [for (final e in (data as List<dynamic>? ?? const <dynamic>[])) (e as Map).cast<String, dynamic>()];

  Future<List<DeliveryOrder>> getDeliveries() async {
    final response = await _orders.get('deliveries');
    return [for (final e in _list(response.data)) DeliveryOrder.fromJson(e)];
  }

  /// The branch's riders, on duty first, with those who have not opened the app yet
  Future<List<TillRider>> getRiders() async {
    final response = await _orders.get('riders');
    return [for (final e in _list(response.data)) TillRider.fromJson(e)];
  }

  /// The server names the rider from its own list; the till says only which
  Future<void> assignRider(int orderId, TillRider rider) =>
      _orders.put('$orderId/delivery/rider', data: {'riderUserId': rider.userId});

  Future<void> unassignRider(int orderId) => _orders.delete('$orderId/delivery/rider');

  Future<void> markOut(int orderId) => _orders.put('$orderId/delivery/out');

  Future<void> markDelivered(int orderId) => _orders.put('$orderId/delivery/delivered');

  /// The rider could not hand it over; [reason] is a code (NoAnswer, Refused, WrongAddress, Other)
  Future<void> markFailed(int orderId, String reason) => _orders.put('$orderId/delivery/failed', data: {'reason': reason});

  /// The bag is back at the branch
  Future<void> markReturned(int orderId) => _orders.put('$orderId/delivery/returned');

  /// The rider handed in [amount] for it; the bill is settled with it
  Future<void> cashIn(int orderId, double amount) => _orders.put('$orderId/delivery/cash-in', data: {'amount': amount});

  /// A rider handed in the cash for several deliveries at once, each with what
  /// was counted for it; all or nothing on the server
  Future<void> cashInMany(Map<int, double> amounts) => _orders.put('deliveries/cash-in', data: {
        'items': [
          for (final e in amounts.entries) {'orderId': e.key, 'amount': e.value},
        ],
      });

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
  (ref) => DeliveryRepository(ref.read(ordersApiProvider)),
);
