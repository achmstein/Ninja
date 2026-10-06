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
    DeliveryProblem? problem({bool active = true, bool hasAddress = true, bool quoted = true, bool failed = false, bool inRange = true, double short = 0}) =>
        deliveryProblem(active: active, hasAddress: hasAddress, quoted: quoted, quoteFailed: failed, inRange: inRange, short: short);

    test('in the order the customer meets it', () {
      expect(problem(active: false, hasAddress: false), isNull, reason: 'collecting it: nothing');
      expect(problem(hasAddress: false, quoted: false), DeliveryProblem.address);
      expect(problem(quoted: false, failed: true), DeliveryProblem.quoteFailed);
      expect(problem(quoted: false), DeliveryProblem.checking);
      expect(problem(inRange: false, short: 50), DeliveryProblem.range, reason: 'too far before too little');
      expect(problem(short: 20), DeliveryProblem.minimum);
      expect(problem(), isNull);
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
