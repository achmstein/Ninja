import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/money.dart';
import '../../../core/network/api_client.dart';
import '../../sale/models/pos_order_request.dart';
import '../models/order.dart';

/// Abstract repository defining order operations
abstract class OrderRepository {
  Future<List<Order>> getPendingOrders();
  Future<bool> confirmOrder(int orderId, {String? requestId});
  Future<bool> cancelOrder(int orderId, {String? requestId});
  Future<Order> getOrderDetails(int orderId);

  /// Rings a counter sale up as a real order (the kitchen sees it like any
  /// other). Returns the order id, or 0 when the same request id was already
  /// accepted — a deduplicated retry.
  Future<int> createPosOrder(PosOrderRequest request, {required String requestId});

  /// Puts an account holder or a bare name on an order after the fact
  Future<void> assignOrderCustomer(int orderId, {String? customerUserId, required String customerName, String? requestId});
}

/// Concrete implementation that calls the Orders API
class ApiOrderRepository implements OrderRepository {
  final ApiClient _api;

  ApiOrderRepository(this._api);

  @override
  Future<List<Order>> getPendingOrders() async {
    final response = await _api.get('pending');
    final itemsList = response.data as List<dynamic>;
    final orders = itemsList
        .map((e) => Order.fromJson(e as Map<String, dynamic>))
        .toList();
    orders.sort((a, b) => b.date.compareTo(a.date));
    return orders;
  }

  @override
  Future<bool> confirmOrder(int orderId, {String? requestId}) async {
    await _api.put('confirm', data: {'orderNumber': orderId}, requestId: requestId);
    return true;
  }

  @override
  Future<bool> cancelOrder(int orderId, {String? requestId}) async {
    await _api.put('cancel', data: {'orderNumber': orderId}, requestId: requestId);
    return true;
  }

  @override
  Future<Order> getOrderDetails(int orderId) async {
    final response = await _api.get('$orderId');
    return Order.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<int> createPosOrder(PosOrderRequest request, {required String requestId}) async {
    final response = await _api.post<Map<String, dynamic>>('pos', data: request.toJson(), requestId: requestId);
    return toInt(response.data?['orderId']);
  }

  @override
  Future<void> assignOrderCustomer(int orderId,
      {String? customerUserId, required String customerName, String? requestId}) async {
    await _api.put(
      '$orderId/customer',
      data: {'customerUserId': customerUserId, 'customerName': customerName},
      requestId: requestId,
    );
  }
}

/// Provider for the order repository
final orderRepositoryProvider = Provider<OrderRepository>(
  (ref) => ApiOrderRepository(ref.read(ordersApiProvider)),
);
