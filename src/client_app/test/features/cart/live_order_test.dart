import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/brand/brand_provider.dart';
import 'package:ninja_client/core/ui/island.dart';
import 'package:ninja_client/core/utils/money.dart';
import 'package:ninja_client/features/cart/services/checkout_flow.dart';
import 'package:ninja_client/features/cart/widgets/order_island.dart';
import 'package:ninja_client/features/orders/models/order.dart';
import 'package:ninja_client/features/orders/services/order_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The order on its way survives a reload, as on the web: only the moment of
/// placing is kept (the newest order before it), and the order is found
/// again in the server's list.

class _Orders extends OrdersNotifier {
  @override
  OrdersState build() => const OrdersState(isLoading: true);

  @override
  Future<void> loadOrders() async {}

  void arrive(List<Order> orders) => state = OrdersState(orders: orders);
}

Order _order(int id, OrderStatus status) => Order(id: id, date: DateTime(2026, 10, 1, 13), status: status, total: 50);

Future<(ProviderContainer, _Orders)> _reloaded() async {
  final container = ProviderContainer(overrides: [ordersProvider.overrideWith(_Orders.new)]);
  addTearDown(container.dispose);
  container.listen(liveOrderProvider, (_, _) {});
  await Future<void>.delayed(const Duration(milliseconds: 10));
  return (container, container.read(ordersProvider.notifier) as _Orders);
}

void main() {
  // The island's announcement buzzes the phone
  TestWidgetsFlutterBinding.ensureInitialized();

  test('after a reload the order placed is followed again from the list, to confirmed', () async {
    // Order 5 was the newest before this one was placed
    SharedPreferences.setMockInitialValues({'flutter.ninja-order-pill': 5});
    final (container, orders) = await _reloaded();
    expect(container.read(liveOrderProvider)?.stage, OrderStage.sent);

    orders.arrive([_order(4, OrderStatus.confirmed), _order(6, OrderStatus.submitted)]);
    expect(container.read(liveOrderProvider)?.orderId, 6);
    expect(container.read(liveOrderProvider)?.stage, OrderStage.sent);

    orders.arrive([_order(4, OrderStatus.confirmed), _order(6, OrderStatus.confirmed)]);
    expect(container.read(liveOrderProvider)?.stage, OrderStage.confirmed);
  });

  test('nothing followed, nothing shown: an older waiting order does not take the dock', () async {
    SharedPreferences.setMockInitialValues({});
    final (container, orders) = await _reloaded();
    orders.arrive([_order(6, OrderStatus.submitted)]);
    expect(container.read(liveOrderProvider), isNull);
  });

  test('turned down, the island says so out loud for a moment; Sent and Confirmed it leaves to the dock', () async {
    SharedPreferences.setMockInitialValues({'flutter.ninja-order-pill': 5});
    final container = ProviderContainer(overrides: [
      ordersProvider.overrideWith(_Orders.new),
      moneyProvider.overrideWithValue(MoneyFormat('EGP', const Locale('en'))),
      brandNameProvider.overrideWithValue('Chillax'),
    ]);
    addTearDown(container.dispose);
    addTearDown(island.end);
    container.listen(liveOrderProvider, (_, _) {});
    await Future<void>.delayed(const Duration(milliseconds: 10));
    final orders = container.read(ordersProvider.notifier) as _Orders;

    orders.arrive([_order(6, OrderStatus.submitted)]);
    expect(island.face, isNull);

    orders.arrive([_order(6, OrderStatus.cancelled)]);
    expect(container.read(liveOrderProvider)?.stage, OrderStage.cancelled);
    expect(island.flashing, isTrue);
    expect(island.duration, orderAnnounce);
    expect(island.face?.description, isNotNull);
  });

  test('a followed order no longer in the loaded list (another day) is let go', () async {
    SharedPreferences.setMockInitialValues({'flutter.ninja-order-pill': 9});
    final (container, orders) = await _reloaded();
    orders.arrive([_order(4, OrderStatus.confirmed)]);
    expect(container.read(liveOrderProvider), isNull);
    expect((await SharedPreferences.getInstance()).getInt('ninja-order-pill'), isNull);
  });
}
