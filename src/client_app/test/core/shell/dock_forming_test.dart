import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/models/localized_text.dart';
import 'package:ninja_client/core/shell/dock_bill.dart';
import 'package:ninja_client/features/bills/models/bill.dart';
import 'package:ninja_client/features/bills/services/bills_service.dart';
import 'package:ninja_client/features/orders/models/order.dart';
import 'package:ninja_client/features/orders/services/order_service.dart';

/// Orders on their way with no open bill to land on stand as a bill of their
/// own on the dock, read from the server: a reload still shows them.

class _Bills extends MyBillsNotifier {
  final List<Bill> bills;

  _Bills(this.bills);

  @override
  AsyncValue<List<Bill>> build() => AsyncValue.data(bills);
}

class _Orders extends OrdersNotifier {
  final List<Order> orders;

  _Orders(this.orders);

  @override
  OrdersState build() => OrdersState(orders: orders);
}

Order _order(int id, OrderStatus status, {int? ticketId}) =>
    Order(id: id, date: DateTime(2026, 10, 1, 13), status: status, total: 50, ticketId: ticketId);

Bill _bill({required bool open, List<int> orderIds = const []}) => Bill(
      id: 1,
      type: 'Dine',
      status: open ? 'Open' : 'Settled',
      branchId: 1,
      openedAt: DateTime(2026, 10, 1, 12),
      lastActivityAt: DateTime(2026, 10, 1, 12),
      lines: [
        for (final id in orderIds)
          BillLine(id: id, source: 'Order', orderId: id, description: const LocalizedText(en: 'Latte'), qty: 1, unitPrice: 50, discount: 0, total: 50, isMine: true),
      ],
      subtotal: 50,
      discount: 0,
      serviceCharge: 0,
      serviceChargeRate: 0,
      vat: 0,
      vatRate: 0,
      vatIncluded: true,
      total: 50,
      refundedTotal: 0,
    );

ProviderContainer _with({required List<Bill> bills, required List<Order> orders}) {
  final container = ProviderContainer(overrides: [
    myBillsProvider.overrideWith(() => _Bills(bills)),
    ordersProvider.overrideWith(() => _Orders(orders)),
  ]);
  addTearDown(container.dispose);
  return container;
}

void main() {
  test('with no open bill, the waiting orders and the confirmed ones not on a bill form one, and the dock shows it', () {
    final container = _with(bills: [_bill(open: false, orderIds: [3])], orders: [
      _order(3, OrderStatus.confirmed), // on the paid bill
      _order(4, OrderStatus.submitted), // waiting
      _order(5, OrderStatus.confirmed), // confirmed, not on a bill yet
      _order(6, OrderStatus.cancelled), // turned down
    ]);
    expect(container.read(formingOrdersProvider).map((o) => o.id), [4, 5]);
    expect(container.read(dockRowShownProvider), isTrue);
  });

  test('with an open bill the waiting orders land on it, not on a bill of their own', () {
    final container = _with(bills: [_bill(open: true)], orders: [_order(4, OrderStatus.submitted)]);
    expect(container.read(formingOrdersProvider), isEmpty);
    expect(container.read(dockRowShownProvider), isTrue);
  });

  test('nothing on its way and no bill: no row', () {
    final container = _with(bills: [_bill(open: false, orderIds: [3])], orders: [_order(3, OrderStatus.confirmed)]);
    expect(container.read(formingOrdersProvider), isEmpty);
  });
}
