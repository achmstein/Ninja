import 'dart:math';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_app_core/brand/tenant_brand.dart';
import 'package:pos_app/features/deliveries/services/address_search.dart';

void main() {
  test('a search waits for three letters, trimmed and single-spaced', () {
    expect(searchableQuery(' ma '), isNull);
    expect(searchableQuery('maadi   street 9'), 'maadi street 9');
  });

  test('a session token is a UUID Google takes', () {
    expect(newSearchSession(), matches(RegExp(r'^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')));
    expect(newSearchSession(Random(7)), newSearchSession(Random(7)));
  });

  test('a picked place goes in the location field as coordinates that read back as its pin', () {
    expect(const PickedPlace(29.9601234, 31.25, null).locationText, '29.960123, 31.250000');
  });

  test('the brand says whether the till shows address search', () {
    final on = TenantBrand.fromApi({'name': {'en': 'Blue'}, 'maps': {'search': true}}, baseUrl: 'https://api.blue.test');
    expect(on.addressSearch, isTrue);
    expect(TenantBrand.fromJson(on.toJson()).addressSearch, isTrue);
    expect(TenantBrand.fromApi({'name': {'en': 'Blue'}, 'maps': {'search': false}}, baseUrl: '').addressSearch, isFalse);
  });
}
