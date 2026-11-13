import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:pos_app/features/deliveries/delivery_errors.dart';
import 'package:pos_app/features/deliveries/models/delivery_order.dart';
import 'package:pos_app/features/deliveries/providers/deliveries_provider.dart';
import 'package:pos_app/features/deliveries/widgets/area_picker_field.dart';
import 'package:pos_app/features/orders/models/order.dart';
import 'package:pos_app/features/sale/models/pos_order_request.dart';
import 'package:pos_app/features/sale/models/sale_delivery.dart';
import 'package:pos_app/features/sale/models/sale_line.dart';
import 'package:pos_app/l10n/app_localizations_ar.dart';
import 'package:pos_app/l10n/app_localizations_en.dart';
import 'package:dio/dio.dart';

DeliveryZone _zone(int id, {String? en, String? ar, double fee = 20, bool on = true}) =>
    DeliveryZone(zoneId: id, branchId: 1, name: LocalizedText(en: en, ar: ar), fee: fee, on: on);

DioException _refused(String code) => DioException(
      requestOptions: RequestOptions(path: '/'),
      response: Response(requestOptions: RequestOptions(path: '/'), statusCode: 400, data: {'code': code}),
    );

void main() {
  group('matchAreas', () {
    final zones = [
      _zone(1, en: 'Maadi Degla', ar: 'دجلة المعادي'),
      _zone(2, en: 'New Maadi', ar: 'المعادي الجديدة'),
      _zone(3, en: 'Zamalek', ar: 'الزمالك', on: false),
      _zone(4, ar: 'مدينة نصر'),
      _zone(5, en: "Sheikh Zayed - 6th of October"),
    ];
    List<int> ids(String query) => [for (final z in matchAreas(zones, query)) z.zoneId];

    test('finds nothing for nothing typed', () {
      expect(ids(''), isEmpty);
      expect(ids('   '), isEmpty);
    });

    test('finds a name in either language, in the list order, whatever the case', () {
      expect(ids('maadi'), [1, 2]);
      expect(ids('MAAD'), [1, 2]);
      expect(ids('المعادي'), [1, 2]);
      expect(ids('nasr'), isEmpty);
      expect(ids('نصر'), [4]);
    });

    test('wants every word typed, in any order, each in one of the names', () {
      expect(ids('degla maadi'), [1]);
      expect(ids('maadi new'), [2]);
      expect(ids('maadi zamalek'), isEmpty);
      // One word in each language still names the same area
      expect(ids('degla المعادي'), [1]);
    });

    test('reads Arabic spelled either way, and hyphens as spaces', () {
      expect(ids('المعادى الجديده'), [2], reason: 'ى for ي and ه for ة');
      expect(ids('الزَمالِك'), [3], reason: 'diacritics set aside');
      expect(ids('zayed 6th'), [5]);
      expect(ids('sheikh-zayed'), [5]);
    });

    test('offers an area that is off, and at most eight', () {
      expect(matchAreas(zones, 'zamalek').single.on, isFalse);
      final many = [for (var i = 1; i <= 12; i++) _zone(i, en: 'Block $i')];
      final found = matchAreas(many, 'block');
      expect(found, hasLength(maxAreaMatches));
      expect([for (final z in found) z.zoneId], [1, 2, 3, 4, 5, 6, 7, 8]);
    });
  });

  group("the till's quote", () {
    test('reads the area it is for and the list to pick from', () {
      final quote = TillDeliveryQuote.fromJson({
        'delivers': true,
        'inRange': true,
        'fee': '35.00',
        'minimumOrder': '150',
        'zoneId': 11,
        'zoneName': {'en': 'Maadi Degla', 'ar': null},
        'etaMinutes': 40,
        'zoneOff': true,
        'zones': [
          {'zoneId': 11, 'branchId': 1, 'name': {'en': 'Maadi Degla'}, 'fee': 35, 'minimumOrder': 150, 'etaMinutes': 40, 'on': false, 'branchPaused': false, 'drawn': true},
          {'zoneId': 12, 'branchId': 1, 'name': {'ar': 'الزمالك'}, 'fee': 15, 'minimumOrder': 0, 'etaMinutes': null, 'on': true, 'branchPaused': false, 'drawn': false},
        ],
      });

      expect((quote.zoneId, quote.zoneName?.en, quote.etaMinutes, quote.zoneOff, quote.fee, quote.minimumOrder), (11, 'Maadi Degla', 40, true, 35, 150));
      expect([for (final z in quote.zones) z.zoneId], [11, 12]);
      expect(quote.zone?.on, isFalse);
      expect(zoneById(quote.zones, 12)?.name.ar, 'الزمالك');
      expect(zoneById(quote.zones, 99), isNull);
    });

    test('is for no area when the branch lists none (an older answer too)', () {
      final quote = TillDeliveryQuote.fromJson({'delivers': true, 'fee': 20});
      expect(quote.zoneId, isNull);
      expect(quote.zone, isNull);
      expect(quote.zones, isEmpty);
      expect(quote.zoneOff, isFalse);
    });
  });

  group("an order's delivery", () {
    test('keeps the area it was priced by and about how long it takes', () {
      final delivery = OrderDelivery.parse(<String, dynamic>{
        'address': 'Road 9',
        'phone': '01001234567',
        'fee': 35,
        'zoneName': {'en': 'Maadi Degla', 'ar': 'دجلة المعادي'},
        'etaMinutes': '40',
      })!;
      expect(delivery.zoneName?.en, 'Maadi Degla');
      expect(delivery.zoneName?.ar, 'دجلة المعادي');
      expect(delivery.etaMinutes, 40);
    });

    test('has neither when it went by the branch own fee', () {
      final delivery = OrderDelivery.parse(<String, dynamic>{'address': 'Road 9', 'phone': '01001234567', 'zoneName': null})!;
      expect(delivery.zoneName, isNull);
      expect(delivery.etaMinutes, isNull);
      expect(OrderDelivery.parse(<String, dynamic>{'address': 'Road 9', 'phone': '1', 'zoneName': {'en': ' ', 'ar': null}})!.zoneName, isNull);
    });
  });

  group('a sale going to a named area', () {
    const zone = SaleDeliveryZone(id: 11, name: LocalizedText(en: 'Maadi Degla', ar: 'دجلة المعادي'), fee: 35, minimumOrder: 150, etaMinutes: 40);
    const delivery = SaleDelivery(address: 'Road 9', phone: '01001234567', zone: zone);
    const large = SaleLine(productId: 1, nameEn: 'Latte', nameAr: 'لاتيه', price: 50);

    test("charges the area's fee: what the branch says now, else what it was when picked", () {
      expect(delivery.feeWith(20), 35);
      expect(delivery.feeWith(20, zoneFee: 40), 40);
      expect(delivery.withoutZone().feeWith(20), 20);
      expect(delivery.withoutZone().feeWith(20, zoneFee: 40), 20, reason: 'no area, no area fee');
      expect(const SaleDelivery(address: 'Road 9', phone: '1').feeWith(20), 20);
    });

    test('is kept through a refresh, and a sale saved before areas still loads', () {
      final back = SaleDelivery.fromJson(delivery.toJson());
      expect((back.zone?.id, back.zone?.name.en, back.zone?.name.ar), (11, 'Maadi Degla', 'دجلة المعادي'));
      expect((back.zone?.fee, back.zone?.minimumOrder, back.zone?.etaMinutes), (35, 150, 40));

      final old = SaleDelivery.fromJson({'address': 'Road 9', 'phone': '01001234567', 'building': '4'});
      expect(old.zone, isNull);
      expect(old.zoneId, isNull);
      expect(old.building, '4');
      expect(old.toJson().containsKey('zone'), isFalse);
    });

    test('names the area on the order, and none on one without', () {
      final json = PosOrderRequest(lines: [large], delivery: delivery).toJson()['delivery'] as Map<String, dynamic>;
      expect(json['zoneId'], 11);
      final plain = PosOrderRequest(lines: [large], delivery: delivery.withoutZone()).toJson()['delivery'] as Map<String, dynamic>;
      expect(plain.containsKey('zoneId'), isFalse);
    });

    test('sent to another branch carries no area: an area is one branch own', () {
      const sent = SaleDelivery(
          address: 'Road 9', phone: '01001234567', zone: zone, sendTo: DeliveryAlternative(branchId: 2, distanceMeters: 600, fee: 25));
      expect(sent.zoneId, isNull);
      expect(sent.toRequest().containsKey('zoneId'), isFalse);
      expect(sent.feeWith(20, zoneFee: 40), 25);
      expect(sent.keptHere().zoneId, 11, reason: 'made here after all, the area holds again');
    });

    test('asks the branch by the area picked, else by the pin, else not at all', () {
      const pinned = SaleDelivery(address: 'Road 9', phone: '1', latitude: 29.96, longitude: 31.25);
      expect(saleDeliveryWhere(delivery), (zoneId: 11, location: null));
      expect(saleDeliveryWhere(pinned), (zoneId: null, location: '29.96, 31.25'));
      expect(saleDeliveryWhere(pinned.copyWith(zone: zone)), (zoneId: 11, location: null), reason: 'the name wins over the pin');
      expect(saleDeliveryWhere(const SaleDelivery(address: 'Road 9', phone: '1')), isNull);
      expect(saleDeliveryWhere(null), isNull);
      expect(
        saleDeliveryWhere(pinned.copyWith(sendTo: const DeliveryAlternative(branchId: 2, distanceMeters: 600))),
        isNull,
        reason: "another branch's fee is the offer's",
      );
    });

    test('takes its area from the list the cashier picked from', () {
      final picked = SaleDeliveryZone.of(_zone(7, en: 'Zamalek', fee: 15));
      expect((picked.id, picked.name.en, picked.fee, picked.etaMinutes), (7, 'Zamalek', 15, null));
    });
  });

  test('an area the server refuses is said in the till language', () {
    final en = AppLocalizationsEn();
    final ar = AppLocalizationsAr();
    expect(describeDeliveryError(_refused('delivery.area_unknown'), en), "That area isn't on this branch's list any more. Pick the area again.");
    expect(describeDeliveryError(_refused('delivery.area_off'), en), "The branch isn't delivering to that area right now.");
    expect(describeDeliveryError(_refused('delivery.area_unknown'), ar), 'لم تعد هذه المنطقة ضمن مناطق الفرع. اختر المنطقة مجددًا.');
    expect(describeDeliveryError(_refused('delivery.area_off'), ar), 'الفرع لا يوصّل إلى هذه المنطقة الآن.');
    expect(en.deliveryAboutMinutes(40), 'about 40 min');
    expect(ar.deliveryAboutMinutes(40), 'حوالي 40 دقيقة');
  });
}
