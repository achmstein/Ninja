import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ninja_app_core/network/api_client.dart';
import '../models/delivery_order.dart';

/// The rider's side of Ordering's delivery endpoints: their deliveries, the
/// moves a rider makes, and saying when they are on duty.
class DeliveryService {
  final ApiClient _orders;

  DeliveryService(this._orders);

  /// Given to this rider and not yet done with, then those done in the last day
  Future<List<DeliveryOrder>> mine() async {
    final response = await _orders.get<List<dynamic>>('deliveries/mine');
    return [
      for (final json in response.data ?? const <dynamic>[]) DeliveryOrder.fromJson((json as Map).cast<String, dynamic>()),
    ];
  }

  Future<void> markOut(int orderId) => _orders.put<void>('$orderId/delivery/out');

  Future<void> markDelivered(int orderId) => _orders.put<void>('$orderId/delivery/delivered');

  /// Could not hand it over (after leaving): the bag goes back to the branch
  Future<void> markFailed(int orderId, String reason) => _orders.put<void>('$orderId/delivery/failed', data: {'reason': reason});

  /// On duty or off, at the selected branch; also the heartbeat while the app is in front
  Future<void> setOnDuty(bool onDuty) => _orders.put<void>('riders/me', data: {'onDuty': onDuty});
}

final deliveryServiceProvider = Provider<DeliveryService>((ref) {
  return DeliveryService(ref.watch(ordersApiProvider));
});
