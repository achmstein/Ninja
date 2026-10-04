import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_app_core/brand/tenant_brand.dart';
import 'package:pos_app/features/deliveries/models/delivery_order.dart';
import 'package:pos_app/features/orders/models/order.dart';

Map<String, dynamic> _order(int number, {String stage = 'Waiting', String? rider, String? cashIn, double? lat, String? date = '2026-10-04T10:00:00Z'}) => {
      'orderNumber': number,
      'date': date,
      'confirmedAt': '2026-10-04T10:01:00Z',
      'customerName': ' Mona ',
      'total': '145.00',
      'items': [
        {'productName': {'en': 'Latte', 'ar': 'لاتيه'}, 'units': 2, 'customizationsDescription': {'en': 'Oat milk'}},
      ],
      'delivery': {
        'latitude': lat,
        'longitude': lat == null ? null : 31.47,
        'address': ' Maadi, Road 9 ',
        'building': '12',
        'floor': '3',
        'phone': '010 0123-4567',
        'fee': 25,
        'distanceMeters': lat == null ? null : 1800,
        'stage': stage,
        'riderUserId': rider,
        'riderName': rider == null ? null : 'Emam',
        'cashHandedInAt': cashIn,
        'failureReason': stage == 'Failed' ? 'NoAnswer' : null,
      },
    };

void main() {
  group('DeliveryOrder', () {
    test('reads the board, numbers as numbers or strings, text trimmed, times in UTC', () {
      final order = DeliveryOrder.fromJson(_order(11));
      expect(order.orderNumber, 11);
      expect(order.total, 145);
      expect(order.customerName, 'Mona');
      expect(order.delivery.address, 'Maadi, Road 9');
      expect(order.items.single.units, 2);
      expect(order.since!.isUtc, isTrue);
      expect(order.delivery.hasPin, isFalse);
      expect(order.delivery.distanceMeters, isNull);
      expect(order.delivery.directionsUri.toString(), 'https://www.google.com/maps/dir/?api=1&destination=Maadi%2C+Road+9');
      expect(order.delivery.phoneUri.toString(), 'tel:01001234567', reason: 'only what a dialer reads');
    });

    test('a missing date is missing, not now', () {
      final json = _order(1, date: null)..remove('confirmedAt');
      expect(DeliveryOrder.fromJson(json).since, isNull);
    });

    test('with a pin, Maps goes to the pin', () {
      final order = DeliveryOrder.fromJson(_order(12, lat: 30.06));
      expect(order.delivery.hasPin, isTrue);
      expect(order.delivery.directionsUri.toString(), 'https://www.google.com/maps/dir/?api=1&destination=30.06,31.47');
    });

    test('the address joins with the language\'s own comma', () {
      final d = DeliveryOrder.fromJson(_order(1)).delivery;
      expect(d.line(building: 'Bldg', floor: 'Floor', apartment: 'Apt', separator: ', '), 'Maadi, Road 9 · Bldg 12, Floor 3');
      expect(d.line(building: 'عمارة', floor: 'دور', apartment: 'شقة', separator: '، '), 'Maadi, Road 9 · عمارة 12، دور 3');
    });

    test("the lane is the server's stage; the till adds only settled", () {
      expect(DeliveryOrder.fromJson(_order(1)).lane, DeliveryLane.waiting);
      expect(DeliveryOrder.fromJson(_order(2, stage: 'Assigned', rider: 'r1')).lane, DeliveryLane.withRider);
      expect(DeliveryOrder.fromJson(_order(3, stage: 'OnTheWay', rider: 'r1')).lane, DeliveryLane.withRider);
      expect(DeliveryOrder.fromJson(_order(4, stage: 'Failed', rider: 'r1')).lane, DeliveryLane.failed);
      expect(DeliveryOrder.fromJson(_order(5, stage: 'Returned', rider: 'r1')).lane, DeliveryLane.returned);
      expect(DeliveryOrder.fromJson(_order(6, stage: 'Delivered', rider: 'r1')).lane, DeliveryLane.cashDue);
      expect(DeliveryOrder.fromJson(_order(7, stage: 'Delivered', rider: 'r1', cashIn: '2026-10-04T11:00:00Z')).lane, DeliveryLane.done);
      expect(DeliveryOrder.fromJson(_order(8, stage: 'Failed')).delivery.failureReason, 'NoAnswer');
    });

    test('the board: waiting, with a rider, coming back, back, cash due; the settled are off it', () {
      final board = boardOrder([
        DeliveryOrder.fromJson(_order(1, stage: 'Delivered', rider: 'r1')),
        DeliveryOrder.fromJson(_order(2, stage: 'Returned', rider: 'r1')),
        DeliveryOrder.fromJson(_order(3, stage: 'Failed', rider: 'r1')),
        DeliveryOrder.fromJson(_order(4, stage: 'Assigned', rider: 'r1')),
        DeliveryOrder.fromJson(_order(5)),
        DeliveryOrder.fromJson(_order(6, stage: 'Delivered', rider: 'r1', cashIn: '2026-10-04T11:00:00Z')),
      ]);
      expect(board.map((d) => d.orderNumber), [5, 4, 3, 2, 1]);
    });
  });

  test("the rider picker is Ordering's list: those not yet signed in say so", () {
    expect(TillRider.fromJson(const {'userId': 'a', 'name': ' Amr ', 'onDuty': true, 'out': 1}).signedIn, isTrue);
    final notYet = TillRider.fromJson(const {'userId': 'z', 'name': 'Ziad', 'signedIn': false});
    expect(notYet.signedIn, isFalse);
    expect(notYet.onDuty, isFalse);
  });

  test('known addresses are one door each, whichever list they came from', () {
    final a = KnownAddress.fromJson(const {'address': 'Tahrir St', 'building': '12'});
    final b = KnownAddress.fromJson(const {'address': 'tahrir st ', 'building': '12', 'label': 'Home'});
    expect(a.identity, b.identity);
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

  test('stages read from the server, anything unknown waiting', () {
    expect(DeliveryStage.parse('OnTheWay'), DeliveryStage.onTheWay);
    expect(DeliveryStage.parse('Returned'), DeliveryStage.returned);
    expect(DeliveryStage.parse('Something'), DeliveryStage.waiting);
  });
}
