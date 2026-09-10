import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/core/models/localized_text.dart';
import 'package:pos_app/features/ticket/lines.dart';
import 'package:pos_app/features/tickets/models/ticket_detail.dart';

TicketLineView line(
  int id,
  String name,
  double qty,
  double unitPrice, {
  String? details,
  double discount = 0,
  String source = 'Order',
  String? customerId,
  String? customerName,
  String? guestId,
}) =>
    TicketLineView(
      id: id,
      source: source,
      description: LocalizedText.parse({'en': name, 'ar': name}),
      details: details == null ? null : LocalizedText.fromString(details),
      qty: qty,
      unitPrice: unitPrice,
      discount: discount,
      total: qty * unitPrice - discount,
      customerId: customerId,
      customerName: customerName,
      guestId: guestId,
    );

void main() {
  group('mergeIdenticalLines', () {
    test('adds up identical lines and keeps the first id', () {
      final merged = mergeIdenticalLines([
        line(1, 'Latte', 1, 55),
        line(2, 'Brownie', 1, 50),
        line(3, 'Latte', 2, 55),
      ]);
      expect(merged.map((l) => l.id), [1, 2]);
      expect(merged.first.qty, 3);
      expect(merged.first.total, 165);
    });

    test('keeps lines apart when options, price, discount or source differ', () {
      final merged = mergeIdenticalLines([
        line(1, 'Latte', 1, 55),
        line(2, 'Latte', 1, 55, details: 'Oat milk'),
        line(3, 'Latte', 1, 60),
        line(4, 'Latte', 1, 55, discount: 5),
        line(5, 'Latte', 1, 55, source: 'Manual'),
      ]);
      expect(merged.length, 5);
    });
  });

  group('groupLinesByCustomer', () {
    test('one group per person in first-seen order, unnamed lines together', () {
      final groups = groupLinesByCustomer([
        line(1, 'Latte', 1, 55, customerId: 'u1', customerName: 'Ahmed'),
        line(2, 'Water', 1, 20),
        line(3, 'Tea', 1, 25, customerName: 'Sara'),
        line(4, 'Cake', 1, 65, customerId: 'u1', customerName: 'Ahmed'),
        line(5, 'Juice', 1, 40, guestId: 'g9'),
      ]);
      expect(groups.map((g) => g.key), ['account:u1', null, 'name:Sara', 'guest:g9']);
      expect(groups.first.total, 120);
      expect(groups.first.lines.map((l) => l.id), [1, 4]);
      expect(groups[3].name, isNull);
    });

    test('a whole bill nobody was named for is a single unattributed group', () {
      final groups = groupLinesByCustomer([line(1, 'Latte', 1, 55), line(2, 'Water', 1, 20)]);
      expect(groups.length, 1);
      expect(groups.single.unattributed, isTrue);
    });
  });
}
