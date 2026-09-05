import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/features/orders/models/order.dart';
import 'package:pos_app/features/orders/providers/pending_orders_provider.dart';
import 'package:pos_app/features/orders/status.dart';

Order order(int id, {int? sessionId, int? tableId}) => Order(
      id: id,
      date: DateTime(2026, 9, 5, 12),
      status: OrderStatus.submitted,
      total: 10,
      sessionId: sessionId,
      tableId: tableId,
    );

void main() {
  test('a room order follows its session, a table order its table, counter bills get none', () {
    final pending = [order(1, sessionId: 7), order(2, tableId: 5), order(3, tableId: 2), order(4)];
    expect(pendingForTicket(pending, sessionId: 7).map((o) => o.id), [1]);
    expect(pendingForTicket(pending, tableId: 5).map((o) => o.id), [2]);
    expect(pendingForTicket(pending), isEmpty);
  });

  test('urgency climbs at two and three minutes', () {
    final placed = DateTime(2026, 9, 5, 12);
    expect(orderUrgency(placed, placed.add(const Duration(seconds: 90))), OrderUrgency.fresh);
    expect(orderUrgency(placed, placed.add(const Duration(minutes: 2))), OrderUrgency.warning);
    expect(orderUrgency(placed, placed.add(const Duration(minutes: 3))), OrderUrgency.delayed);
  });
}
