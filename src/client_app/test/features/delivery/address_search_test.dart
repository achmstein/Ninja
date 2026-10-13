import 'dart:math';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/brand/tenant_brand.dart';
import 'package:ninja_client/features/delivery/services/address_search.dart';

void main() {
  group('address search', () {
    test('waits for three letters, trimmed and single-spaced', () {
      expect(searchableQuery('  st '), isNull);
      expect(searchableQuery('  شارع   9 '), 'شارع 9');
    });

    test('a session token is a UUID Google takes, different each time', () {
      final a = newSearchSession();
      expect(a, matches(RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')));
      expect(newSearchSession(), isNot(a));
      expect(newSearchSession(Random(1)), newSearchSession(Random(1)));
    });

    test('leans to a point to about a metre, or to none', () {
      expect(nearParam((lat: 30.044412345, lng: 31.2357)), '30.04441,31.23570');
      expect(nearParam(null), isNull);
    });

    test('the brand says whether the business has address search, and keeps it in the cache', () {
      final on = TenantBrand.fromApi({
        'name': {'en': 'Blue'},
        'maps': {'search': true, 'webKey': null, 'webDomains': []},
      }, baseUrl: 'https://api.blue.test');
      expect(on.addressSearch, isTrue);
      expect(TenantBrand.fromJson(on.toJson()).addressSearch, isTrue);
      expect(TenantBrand.fromApi({'name': {'en': 'Blue'}}, baseUrl: 'https://api.blue.test').addressSearch, isFalse,
          reason: 'a stack older than Google Maps, or the business without it: no search field');
    });
  });
}
