import 'package:flutter_test/flutter_test.dart';
import 'package:kds_app/features/kitchen/models/kitchen_order.dart';

void main() {
  test('parses the kitchen endpoint shape', () {
    final order = KitchenOrder.fromJson({
      'orderNumber': 3121,
      'date': '2026-09-05T19:50:00Z',
      'confirmedAt': '2026-09-05T19:52:00Z',
      'preparation': 'Preparing',
      'preparingAt': '2026-09-05T19:53:00Z',
      'readyAt': null,
      'source': 'Customer',
      'roomName': {'en': 'Room 3', 'ar': 'اوضة 3'},
      'tableName': null,
      'customerName': 'Ahmed',
      'customerNote': null,
      'items': [
        {
          'productName': {'en': 'Latte', 'ar': 'لاتيه'},
          'units': 2,
          'customizationsDescription': {'en': 'Large', 'ar': 'كبير'},
          'specialInstructions': 'Less foam',
        },
        {
          'productName': {'en': 'Cheesecake', 'ar': 'تشيز كيك'},
          'units': '1',
          'customizationsDescription': null,
          'specialInstructions': null,
        },
      ],
    });

    expect(order.orderNumber, 3121);
    expect(order.preparation, PreparationStatus.preparing);
    expect(order.since, DateTime.utc(2026, 9, 5, 19, 52));
    expect(order.roomName?.ar, 'اوضة 3');
    expect(order.tableName, isNull);
    expect(order.customerNote, isNull);
    expect(order.isPos, isFalse);
    expect(order.items, hasLength(2));
    expect(order.items[0].units, 2);
    expect(order.items[0].customizationsDescription?.en, 'Large');
    expect(order.items[0].specialInstructions, 'Less foam');
    expect(order.items[1].units, 1);
    expect(order.items[1].customizationsDescription, isNull);
    expect(order.items[1].specialInstructions, isNull);
  });

  test('a string order number, an unknown state and no confirmation still make a card', () {
    final order = KitchenOrder.fromJson({
      'orderNumber': '3122',
      'date': '2026-09-05T19:50:00Z',
      'preparation': 'Whatever',
      'source': 'Pos',
    });
    expect(order.orderNumber, 3122);
    expect(order.preparation, PreparationStatus.notStarted);
    expect(order.since, order.date);
    expect(order.isPos, isTrue);
    expect(order.items, isEmpty);
  });

  test('a timestamp without a zone is read as UTC', () {
    expect(readUtc('2026-09-05T19:50:00'), DateTime.utc(2026, 9, 5, 19, 50));
    expect(readUtc('2026-09-05T19:50:00Z')!.isUtc, isTrue);
    expect(readUtc(null), isNull);
    expect(readUtc(''), isNull);
  });

  test('copyWith clears readyAt only when asked', () {
    final order = KitchenOrder(orderNumber: 1, date: DateTime.utc(2026, 9, 5), readyAt: DateTime.utc(2026, 9, 5, 1));
    expect(order.copyWith(preparation: PreparationStatus.preparing).readyAt, isNotNull);
    expect(order.copyWith(clearReadyAt: true).readyAt, isNull);
    final later = DateTime.utc(2026, 9, 5, 2);
    expect(order.copyWith(readyAt: later).readyAt, later);
  });

  test('preparation states parse by wire name, any case', () {
    expect(PreparationStatus.parse('Ready'), PreparationStatus.ready);
    expect(PreparationStatus.parse('notstarted'), PreparationStatus.notStarted);
    expect(PreparationStatus.parse(null), PreparationStatus.notStarted);
    expect(PreparationStatus.ready.wire, 'Ready');
  });
}
