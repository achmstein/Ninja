import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../models/kitchen_order.dart';

/// The two calls the kitchen makes: the board, and Start / Ready / Recall.
abstract class KitchenRepository {
  Future<List<KitchenOrder>> getKitchenOrders();

  /// Moves an order between lanes. Each tap carries its own idempotency
  /// key: a double tap on a slow connection must not turn into two commands
  /// (the backend treats a repeat as a no-op anyway).
  Future<void> setPreparation(int orderNumber, PreparationStatus target, {required String requestId});
}

/// Ordering.API's kitchen endpoints, branch-scoped by the X-Branch-Id header
class ApiKitchenRepository implements KitchenRepository {
  final ApiClient _api;

  ApiKitchenRepository(this._api);

  @override
  Future<List<KitchenOrder>> getKitchenOrders() async {
    final response = await _api.get<List<dynamic>>('kitchen');
    return [
      for (final order in response.data ?? const []) KitchenOrder.fromJson(order as Map<String, dynamic>),
    ];
  }

  @override
  Future<void> setPreparation(int orderNumber, PreparationStatus target, {required String requestId}) async {
    await _api.put('$orderNumber/preparation', data: {'preparation': target.wire}, requestId: requestId);
  }
}

final kitchenRepositoryProvider = Provider<KitchenRepository>((ref) {
  return ApiKitchenRepository(ref.read(ordersApiProvider));
});
