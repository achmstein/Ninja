import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../models/kitchen_order.dart';
import '../models/kitchen_station.dart';

/// The calls the kitchen makes: its stations, the board, and Ready / Bring back.
abstract class KitchenRepository {
  /// The board: for [stationId], that station's part of every order it has
  /// a hand in; without one, the pass — every order whole.
  Future<List<KitchenOrder>> getKitchenOrders({int? stationId});

  /// Marks an order ready, or brings a ready one back to the board — the
  /// part at [stationId], or the whole order from the pass. Each tap
  /// carries its own idempotency key: a double tap on a slow connection
  /// must not turn into two commands (the backend treats a repeat as a
  /// no-op anyway).
  Future<void> setReady(int orderNumber, bool ready, {int? stationId, required String requestId});

  /// The branch's stations, in display order
  Future<List<KitchenStation>> getStations();
}

/// Ordering.API's kitchen endpoints, branch-scoped by the X-Branch-Id header
class ApiKitchenRepository implements KitchenRepository {
  final ApiClient _orders;
  final ApiClient _kitchen;

  ApiKitchenRepository(this._orders, this._kitchen);

  @override
  Future<List<KitchenOrder>> getKitchenOrders({int? stationId}) async {
    final response = await _orders.get<List<dynamic>>(
      'kitchen',
      queryParameters: stationId == null ? null : {'stationId': stationId},
    );
    return [
      for (final order in response.data ?? const []) KitchenOrder.fromJson(order as Map<String, dynamic>),
    ];
  }

  @override
  Future<void> setReady(int orderNumber, bool ready, {int? stationId, required String requestId}) async {
    final path = stationId == null ? '$orderNumber/ready' : '$orderNumber/stations/$stationId/ready';
    await _orders.put(path, data: {'ready': ready}, requestId: requestId);
  }

  @override
  Future<List<KitchenStation>> getStations() async {
    final response = await _kitchen.get<List<dynamic>>('stations');
    return [
      for (final station in response.data ?? const []) KitchenStation.fromJson(station as Map<String, dynamic>),
    ];
  }
}

final kitchenRepositoryProvider = Provider<KitchenRepository>((ref) {
  return ApiKitchenRepository(ref.read(ordersApiProvider), ref.read(kitchenApiProvider));
});
