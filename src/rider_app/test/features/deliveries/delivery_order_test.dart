import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rider_app/core/models/money.dart';
import 'package:rider_app/features/deliveries/models/delivery_order.dart';

Map<String, dynamic> _json({String stage = 'Assigned', String? deliveredAt, String? cashHandedInAt, num total = 115, String? confirmedAt}) => {
      'orderNumber': 42,
      'confirmedAt': confirmedAt ?? '2026-10-04T10:00:00Z',
      'customerName': 'Mona',
      'total': total,
      'items': [
        {'productName': {'en': 'Latte', 'ar': 'لاتيه'}, 'units': 2, 'customizationsDescription': {'en': 'Oat milk'}},
      ],
      'delivery': {
        'latitude': 30.0444,
        'longitude': '31.2357',
        'address': 'Tahrir St',
        'building': '12',
        'floor': '3',
        'apartment': null,
        'directions': 'Blue gate',
        'phone': '01001234567',
        'stage': stage,
        'deliveredAt': deliveredAt,
        'cashHandedInAt': cashHandedInAt,
      },
    };

void main() {
  group('DeliveryOrder', () {
    test('reads what the server sends, numbers as numbers or strings', () {
      final order = DeliveryOrder.fromJson(_json());
      expect(order.orderNumber, 42);
      expect(order.longitude, 31.2357);
      expect(order.stage, DeliveryStage.assigned);
      expect(order.lines.single.units, 2);
      expect(order.lines.single.options?.en, 'Oat milk');
      expect(order.apartment, isNull);
    });

    test('says the address on one line, street first, leaving out what is missing', () {
      final order = DeliveryOrder.fromJson(_json());
      expect(order.addressLine(building: 'Bldg', floor: 'Floor', apartment: 'Apt'), 'Tahrir St · Bldg 12، Floor 3');
    });

    test('leads to the door on Google Maps and calls the phone', () {
      final order = DeliveryOrder.fromJson(_json());
      expect(order.directionsUri.toString(), 'https://www.google.com/maps/dir/?api=1&destination=30.0444,31.2357');
      expect(order.phoneUri.toString(), 'tel:01001234567');
    });

    test('an address the till took over the phone, without a pin, is found by its words', () {
      final json = _json();
      (json['delivery'] as Map)
        ..['latitude'] = null
        ..['longitude'] = null
        ..['address'] = 'Maadi, Road 9';
      final order = DeliveryOrder.fromJson(json);
      expect(order.hasPin, isFalse);
      expect(order.latitude, isNull);
      expect(order.directionsUri.toString(), 'https://www.google.com/maps/dir/?api=1&destination=Maadi%2C+Road+9');
    });

    test('an unknown stage is one still waiting', () {
      expect(DeliveryOrder.fromJson(_json(stage: 'Something')).stage, DeliveryStage.waiting);
    });
  });

  group('RiderDay', () {
    test('splits what is to go from what was delivered, and counts the cash still out', () {
      final day = RiderDay.of([
        DeliveryOrder.fromJson(_json(stage: 'OnTheWay', confirmedAt: '2026-10-04T11:00:00Z')),
        DeliveryOrder.fromJson(_json(stage: 'Assigned', confirmedAt: '2026-10-04T10:00:00Z')),
        DeliveryOrder.fromJson(_json(stage: 'Delivered', deliveredAt: '2026-10-04T09:00:00Z', total: 50)),
        DeliveryOrder.fromJson(_json(stage: 'Delivered', deliveredAt: '2026-10-04T08:00:00Z', cashHandedInAt: '2026-10-04T08:30:00Z', total: 70)),
      ]);
      expect(day.toGo.map((o) => o.stage), [DeliveryStage.assigned, DeliveryStage.onTheWay]);
      expect(day.delivered.length, 2);
      expect(day.cashInHand, 50);
    });
  });

  final marks = RegExp('[${String.fromCharCode(0x2066)}${String.fromCharCode(0x2069)}]');

  test('money reads as the rest of the product: grouped, two places, the currency in the language', () {
    expect(formatMoney(1250, 'EGP', const Locale('en')).replaceAll(marks, ''), '1,250.00 EGP');
    expect(formatMoney(12.5, 'EGP', const Locale('ar')).replaceAll(marks, ''), '12.50 ج.م');
  });
}
