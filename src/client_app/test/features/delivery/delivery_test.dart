import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/l10n/app_localizations.dart';
import 'package:ninja_client/features/cart/services/checkout_flow.dart';
import 'package:ninja_client/features/delivery/models/delivery_address.dart';
import 'package:ninja_client/features/delivery/services/delivery_service.dart';
import 'package:ninja_client/features/orders/models/order.dart';

Order _order({String status = 'Confirmed', Map<String, dynamic>? delivery}) => Order.fromJson({
      'orderNumber': 7,
      'date': '2026-10-06T10:00:00Z',
      'status': status,
      'total': 120,
      'delivery': ?delivery,
    });

void main() {
  group('what stands in the way of a delivery', () {
    DeliveryProblem? problem({bool active = true, bool hasAddress = true, bool quoted = true, bool failed = false, bool inRange = true, bool zoneOff = false, double short = 0}) =>
        deliveryProblem(active: active, hasAddress: hasAddress, quoted: quoted, quoteFailed: failed, inRange: inRange, zoneOff: zoneOff, short: short);

    test('in the order the customer meets it', () {
      expect(problem(active: false, hasAddress: false), isNull, reason: 'collecting it: nothing');
      expect(problem(hasAddress: false, quoted: false), DeliveryProblem.address);
      expect(problem(quoted: false, failed: true), DeliveryProblem.quoteFailed);
      expect(problem(quoted: false), DeliveryProblem.checking);
      expect(problem(inRange: false, short: 50), DeliveryProblem.range, reason: 'too far before too little');
      expect(problem(short: 20), DeliveryProblem.minimum);
      expect(problem(), isNull);
    });

    test('an area the branch switched off is said after too far and before too little', () {
      expect(problem(zoneOff: true), DeliveryProblem.areaOff);
      expect(problem(zoneOff: true, short: 20), DeliveryProblem.areaOff);
      expect(problem(zoneOff: true, inRange: false), DeliveryProblem.range);
      expect(problem(zoneOff: true, quoted: false), DeliveryProblem.checking);
      expect(const DeliveryState(offered: true, active: true, problem: DeliveryProblem.areaOff).ready, isFalse);
    });
  });

  group('a named area', () {
    test('comes with the quote: its name, its minutes, whether it is off', () {
      final quote = DeliveryQuote.fromJson({
        'delivers': true,
        'inRange': true,
        'distanceMeters': 1800,
        'fee': 35,
        'minimumOrder': '150',
        'zoneId': 4,
        'zoneName': {'en': 'Maadi Degla', 'ar': 'دجلة المعادي'},
        'etaMinutes': 45,
        'zoneOff': true,
      });
      expect(quote.zoneId, 4);
      expect(quote.zoneName?.en, 'Maadi Degla');
      expect(quote.zoneName?.ar, 'دجلة المعادي');
      expect(quote.etaMinutes, 45);
      expect(quote.zoneOff, isTrue);
      expect(quote.fee, 35);
      expect(quote.minimumOrder, 150);
    });

    test('is none for a point in no area, or a server that says nothing of areas', () {
      final plain = DeliveryQuote.fromJson({'delivers': true, 'inRange': true, 'fee': 20, 'zoneId': null, 'zoneName': null, 'etaMinutes': null});
      expect(plain.zoneId, isNull);
      expect(plain.zoneName, isNull);
      expect(plain.etaMinutes, isNull);
      expect(plain.zoneOff, isFalse);
      expect(DeliveryQuote.fromJson({'delivers': true, 'inRange': true, 'zoneName': {'en': ' ', 'ar': null}}).zoneName, isNull, reason: 'a blank name is no name');
    });

    test('comes with each branch that reaches the point', () {
      final resolution = DeliveryResolution.fromJson({
        'delivers': true,
        'branches': [
          {'branchId': 1, 'distanceMeters': 2500, 'fee': 20, 'minimumOrder': 0, 'signInRequired': false},
          {'branchId': 2, 'distanceMeters': 900, 'fee': 30, 'minimumOrder': 0, 'signInRequired': false, 'zoneId': 7, 'zoneName': {'ar': 'الزمالك'}, 'etaMinutes': 30, 'zoneOff': true},
        ],
      });
      expect(resolution.branches.map((b) => b.zoneOff), [false, true]);
      expect(resolution.branches.last.zoneName?.ar, 'الزمالك');
      expect(resolution.branches.last.etaMinutes, 30);
      expect(resolution.branches.first.zoneId, isNull);
    });

    test('is said in the customer\'s words', () {
      final en = lookupAppLocalizations(const Locale('en'));
      final ar = lookupAppLocalizations(const Locale('ar'));
      expect(en.deliveryAboutMinutes(45), 'about 45 min');
      expect(en.deliveryAreaOff('Zamalek'), "We're not delivering to Zamalek right now.");
      expect(ar.deliveryAreaOff('الزمالك'), 'مش بنوصّل الزمالك دلوقتي.');
      expect(deliveryProblemText(en, 'delivery.area_off'), "We're not delivering to this area right now.");
    });

    test('ready only when active and nothing stands in the way', () {
      expect(const DeliveryState(offered: true, active: true).ready, isTrue);
      expect(const DeliveryState(offered: true, active: true, problem: DeliveryProblem.checking).ready, isFalse);
      expect(const DeliveryState(offered: true).ready, isFalse);
    });
  });

  group('an address', () {
    const address = DeliveryAddress(latitude: 30.05, longitude: 31.24, address: 'Tahrir St', building: '12', floor: '3');

    test('reads on one line, the street first, in the language\'s comma', () {
      expect(address.line(building: 'Bldg', floor: 'Floor', apartment: 'Apt', separator: ', '), 'Tahrir St · Bldg 12, Floor 3');
      expect(address.line(building: 'عمارة', floor: 'دور', apartment: 'شقة', separator: '، '), 'Tahrir St · عمارة 12، دور 3');
      expect(const DeliveryAddress(latitude: 0, longitude: 0, address: 'Road 9').line(building: 'B', floor: 'F', apartment: 'A', separator: ', '), 'Road 9');
    });

    test('is sent with blank parts as none', () {
      final body = const DeliveryAddress(latitude: 1, longitude: 2, address: 'X', building: ' ', phone: '0100').body();
      expect(body['building'], isNull);
      expect(body['phone'], '0100');
      expect(body.containsKey('label'), isFalse, reason: 'an order carries no label');
    });

    test('Home and Work are kept as their own words, whatever the language', () {
      expect(labelKind('البيت'), LabelKind.home);
      expect(labelKind('Work'), LabelKind.work);
      expect(storedLabel(LabelKind.home, 'ignored'), 'home');
      expect(storedLabel(LabelKind.other, '  Mum\'s  '), 'Mum\'s');
      expect(storedLabel(LabelKind.other, ' '), isNull);
      expect(shownLabel('home', home: 'البيت', work: 'الشغل'), 'البيت');
      expect(shownLabel(null, home: 'Home', work: 'Work'), isNull);
    });

    test('a saved one is the same by its id, a kept one by its pin and street', () {
      expect(const DeliveryAddress(id: 4, latitude: 0, longitude: 0, address: 'A').sameAs(const DeliveryAddress(id: 4, latitude: 1, longitude: 1, address: 'B')), isTrue);
      expect(address.sameAs(const DeliveryAddress(latitude: 30.05, longitude: 31.24, address: 'Tahrir St')), isTrue);
      expect(address.sameAs(const DeliveryAddress(latitude: 30.06, longitude: 31.24, address: 'Tahrir St')), isFalse);
    });

    test('reads from the API', () {
      final saved = DeliveryAddress.fromJson({'id': 9, 'label': 'work', 'latitude': '30.1', 'longitude': 31.2, 'address': ' Road 9 ', 'building': ''});
      expect(saved.id, 9);
      expect(saved.latitude, 30.1);
      expect(saved.address, 'Road 9');
      expect(saved.building, isNull);
    });
  });

  group('a delivery followed to the door', () {
    test('the dock reads its stage from the rider\'s word, once confirmed', () {
      expect(orderStageOf(_order(status: 'Submitted', delivery: {'stage': 'Waiting'})), OrderStage.sent);
      expect(orderStageOf(_order(delivery: {'stage': 'Assigned'})), OrderStage.preparing);
      expect(orderStageOf(_order(delivery: {'stage': 'OnTheWay', 'riderName': 'Ali'})), OrderStage.onTheWay);
      expect(orderStageOf(_order(delivery: {'stage': 'Delivered'})), OrderStage.delivered);
      expect(orderStageOf(_order(delivery: {'stage': 'Failed'})), OrderStage.notDelivered);
      expect(orderStageOf(_order(delivery: {'stage': 'Returned'})), OrderStage.notDelivered);
      expect(orderStageOf(_order(status: 'Cancelled', delivery: {'stage': 'Waiting'})), OrderStage.cancelled);
      expect(orderStageOf(_order()), OrderStage.confirmed, reason: 'eaten in or collected: as before');
    });

    test('on its way it stays; delivered and not delivered are said for a while', () {
      expect(lingerOf(OrderStage.preparing), isNull);
      expect(lingerOf(OrderStage.onTheWay), isNull);
      expect(lingerOf(OrderStage.delivered), const Duration(seconds: 10));
      expect(lingerOf(OrderStage.notDelivered), const Duration(seconds: 30));
    });

    test('the order carries its rider and fee', () {
      final order = _order(delivery: {'stage': 'OnTheWay', 'riderName': ' Ali ', 'fee': 25});
      expect(order.delivery?.riderName, 'Ali');
      expect(order.delivery?.fee, 25);
      expect(order.delivery?.zoneName, isNull);
      final toArea = _order(delivery: {'stage': 'Waiting', 'zoneName': {'en': 'Maadi Degla'}, 'etaMinutes': 45});
      expect(toArea.delivery?.zoneName?.en, 'Maadi Degla');
      expect(toArea.delivery?.etaMinutes, 45);
      expect(_order().delivery, isNull);
    });
  });

  test('a delivery rule the order broke is said in the customer\'s words', () {
    final en = lookupAppLocalizations(const Locale('en'));
    final ar = lookupAppLocalizations(const Locale('ar'));
    expect(deliveryProblemText(en, 'delivery.out_of_range'), "This address is outside the branch's delivery area.");
    expect(deliveryProblemText(ar, 'delivery.below_minimum'), 'زوّد شوية عشان التوصيل.');
    expect(deliveryProblemText(en, 'order.something_else'), isNull);
  });
}
