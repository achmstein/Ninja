import 'dart:ui' show Locale;
import 'package:ninja_client/core/brand/tenant_brand.dart';
import 'package:ninja_client/core/utils/money.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  const en = Locale('en');
  const ar = Locale('ar');

  test('prices carry the tenant currency, labelled in the reader language', () {
    expect(const MoneyFormat('EGP', en)(12.5), '12.50 EGP');
    expect(const MoneyFormat('EGP', ar)(12.5), '12.50 ج.م');
    expect(const MoneyFormat('SAR', ar)(7), '7.00 ر.س');
    expect(const MoneyFormat('SAR', en).whole(50), '50 SAR');
    expect(const MoneyFormat('EGP', en).discount(3.25), '-3.25 EGP');
  });

  test('a currency the list lacks shows its code', () {
    expect(const MoneyFormat('XAF', ar)(1), '1.00 XAF');
    expect(const MoneyFormat('XAF', en).label, 'XAF');
  });

  test('the locale on the brand reads the API shape and falls back to tenant one', () {
    final saudi = TenantLocale.parse({'country': 'sa', 'currency': 'sar', 'timeZone': 'Asia/Riyadh', 'language': 'AR'});
    expect((saudi.country, saudi.currency, saudi.timeZone, saudi.language), ('SA', 'SAR', 'Asia/Riyadh', 'ar'));
    expect(TenantLocale.parse(null), TenantLocale.egypt);
    expect(TenantLocale.parse({'currency': ''}).currency, 'EGP');

    final brand = TenantBrand.fromApi({'name': {'en': 'Oasis'}, 'locale': saudi.toJson()}, baseUrl: 'https://x');
    expect(brand.locale, saudi);
    expect(TenantBrand.fromJson(brand.toJson()).locale, saudi);
  });
}
