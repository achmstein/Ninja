import 'package:flutter_test/flutter_test.dart';
import 'package:kds_app/features/kitchen/models/kitchen_order.dart';

void main() {
  test('parses the kitchen endpoint shape', () {
    final order = KitchenOrder.fromJson({
      'orderNumber': 3121,
      'date': '2026-09-05T19:50:00Z',
      'confirmedAt': '2026-09-05T19:52:00Z',
      'readyAt': null,
      'source': 'Customer',
      'placeKind': 'Room',
      'placeName': {'en': 'Room 3', 'ar': 'اوضة 3'},
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
    expect(order.isReady, isFalse);
    expect(order.since, DateTime.utc(2026, 9, 5, 19, 52));
    expect(order.placeName?.ar, 'اوضة 3');
    expect(order.placeKind, 'Room');
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

  test('a string order number and no confirmation still make a card', () {
    final order = KitchenOrder.fromJson({
      'orderNumber': '3122',
      'date': '2026-09-05T19:50:00Z',
      'source': 'Pos',
    });
    expect(order.orderNumber, 3122);
    expect(order.isReady, isFalse);
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

  test('a ready order is one with a ready time, and withReadyAt sets or clears it', () {
    final open = KitchenOrder(orderNumber: 1, date: DateTime.utc(2026, 9, 5));
    expect(open.isReady, isFalse);
    final ready = open.withReadyAt(DateTime.utc(2026, 9, 5, 1));
    expect(ready.isReady, isTrue);
    expect(ready.orderNumber, 1);
    expect(ready.withReadyAt(null).isReady, isFalse);
  });
}
