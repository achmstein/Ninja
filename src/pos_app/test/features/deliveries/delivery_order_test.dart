import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/core/brand/tenant_brand.dart';
import 'package:pos_app/features/deliveries/models/delivery_order.dart';

Map<String, dynamic> _order(int number, {String? rider, String? outAt, String? deliveredAt, String? cashIn, double? lat}) => {
      'orderNumber': number,
      'date': '2026-10-04T10:00:00Z',
      'confirmedAt': '2026-10-04T10:01:00Z',
      'customerName': 'Mona',
      'total': '145.00',
      'items': [
        {'productName': {'en': 'Latte', 'ar': 'لاتيه'}, 'units': 2, 'customizationsDescription': {'en': 'Oat milk'}},
      ],
      'delivery': {
        'latitude': lat,
        'longitude': lat == null ? null : 31.47,
        'address': 'Maadi, Road 9',
        'building': '12',
        'phone': '01001234567',
        'fee': 25,
        'distanceMeters': lat == null ? null : 1800,
        'stage': 'Waiting',
        'riderUserId': rider,
        'riderName': rider == null ? null : 'Emam',
        'outAt': outAt,
        'deliveredAt': deliveredAt,
        'cashHandedInAt': cashIn,
      },
    };

void main() {
  group('DeliveryOrder', () {
    test('reads the board, numbers as numbers or strings, and a delivery without a pin', () {
      final order = DeliveryOrder.fromJson(_order(11));
      expect(order.orderNumber, 11);
      expect(order.total, 145);
      expect(order.items.single.units, 2);
      expect(order.items.single.options?.en, 'Oat milk');
      expect(order.delivery.hasPin, isFalse);
      expect(order.delivery.distanceMeters, isNull);
      expect(order.delivery.directionsUri.toString(), 'https://www.google.com/maps/dir/?api=1&destination=Maadi%2C+Road+9');
    });

    test('with a pin, Maps goes to the pin', () {
      final order = DeliveryOrder.fromJson(_order(12, lat: 30.06));
      expect(order.delivery.hasPin, isTrue);
      expect(order.delivery.distanceMeters, 1800);
      expect(order.delivery.directionsUri.toString(), 'https://www.google.com/maps/dir/?api=1&destination=30.06,31.47');
    });

    test('stands in one lane: waiting, with a rider, cash due, done', () {
      expect(DeliveryOrder.fromJson(_order(1)).lane, DeliveryLane.waiting);
      expect(DeliveryOrder.fromJson(_order(2, rider: 'r1')).lane, DeliveryLane.withRider);
      expect(DeliveryOrder.fromJson(_order(3, rider: 'r1', outAt: '2026-10-04T10:10:00Z')).lane, DeliveryLane.withRider);
      expect(DeliveryOrder.fromJson(_order(4, rider: 'r1', outAt: '2026-10-04T10:10:00Z', deliveredAt: '2026-10-04T10:30:00Z')).lane,
          DeliveryLane.cashDue);
      expect(
          DeliveryOrder.fromJson(_order(5,
                  rider: 'r1', outAt: '2026-10-04T10:10:00Z', deliveredAt: '2026-10-04T10:30:00Z', cashIn: '2026-10-04T11:00:00Z'))
              .lane,
          DeliveryLane.done);
    });

    test('the board puts waiting first, then with a rider, then cash due, and leaves the settled off', () {
      final board = boardOrder([
        DeliveryOrder.fromJson(_order(1, rider: 'r1', outAt: 'x', deliveredAt: '2026-10-04T10:30:00Z')),
        DeliveryOrder.fromJson(_order(2, rider: 'r1')),
        DeliveryOrder.fromJson(_order(3)),
        DeliveryOrder.fromJson(_order(4, rider: 'r1', deliveredAt: '2026-10-04T10:30:00Z', cashIn: '2026-10-04T11:00:00Z')),
      ]);
      expect(board.map((d) => d.orderNumber), [3, 2, 1]);
    });
  });

  group('mergeRiders', () {
    const heard = [TillRider(userId: 'a', name: 'Amr', onDuty: true, out: 1)];

    test('keeps the checked-in riders first, then the branch riders who have not opened the app, by name', () {
      final riders = mergeRiders(
        heard,
        const [
          RiderAccount(id: 'a', name: 'Amr', branches: [1]),
          RiderAccount(id: 'z', name: 'Ziad Ali', branches: [1]),
          RiderAccount(id: 'm', name: 'mona@x', branches: [1, 2]),
          RiderAccount(id: 'o', name: 'Other', branches: [2]),
          RiderAccount(id: 'n', name: 'Nobranch'),
        ],
        1,
      );
      expect(riders.map((r) => (r.userId, r.signedIn)), [('a', true), ('m', false), ('z', false)]);
      expect(riders[1].onDuty, isFalse);
    });

    test('adds nobody while the till has no branch', () {
      expect(mergeRiders(const [], const [RiderAccount(id: 'z', name: 'Ziad', branches: [1])], null), isEmpty);
    });

    test('reads an Identity account by its names, or its username', () {
      expect(RiderAccount.fromJson({'id': 'x', 'firstName': 'Emam', 'lastName': 'Abelhafez', 'branches': [1, '2']}).name, 'Emam Abelhafez');
      expect(RiderAccount.fromJson({'id': 'x', 'username': 'rider@x', 'branches': [1, '2']}).branches, [1, 2]);
      expect(RiderAccount.fromJson({'id': 'x', 'username': 'rider@x'}).name, 'rider@x');
    });
  });

  test('the till quote says a pasted location had no point in it', () {
    final quote = TillDeliveryQuote.fromJson({'delivers': true, 'inRange': true, 'fee': 25, 'minimumOrder': 50, 'radiusKm': 25, 'locationRead': false});
    expect(quote.pinned, isFalse);
    expect(quote.locationRead, isFalse);
    expect(TillDeliveryQuote.fromJson({'delivers': true, 'latitude': 30.06, 'longitude': 31.47, 'distanceMeters': 900}).pinned, isTrue);
  });

  test('distances read briefly', () {
    String say(int m) => distanceText(m, metres: (v) => '$v m', kilometres: (v) => '$v km');
    expect(say(790), '790 m');
    expect(say(3), '10 m');
    expect(say(2400), '2.4 km');
  });

  test('delivery is on until the brand says otherwise, and a stack older than the switch says nothing', () {
    expect(const TenantFeatures().delivery, isTrue);
    expect(TenantFeatures.fromJson(const {}).delivery, isTrue);
    expect(TenantFeatures.fromJson(const {'delivery': false}).delivery, isFalse);
    expect(TenantFeatures.fromJson(TenantFeatures.fromJson(const {'delivery': false}).toJson()).delivery, isFalse);
  });
}
