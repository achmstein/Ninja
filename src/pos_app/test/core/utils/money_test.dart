import 'dart:ui' show Locale;
import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/core/brand/tenant_brand.dart';
import 'package:pos_app/core/models/money.dart';

void main() {
  const en = Locale('en');
  const ar = Locale('ar');

  test('prices carry the tenant currency, labelled in the reader language', () {
    expect(const MoneyFormat('EGP', en)(12.5), '12.50 EGP');
    expect(const MoneyFormat('EGP', ar)('12.5'), '12.50 ج.م');
    expect(const MoneyFormat('SAR', ar)(7), '7.00 ر.س');
    expect(const MoneyFormat('SAR', en).label, 'SAR');
    expect(const MoneyFormat('XAF', ar)(null), '0.00 XAF');
  });

  test('the locale on the brand reads the API shape and falls back to tenant one', () {
    final saudi = TenantLocale.parse({'country': 'sa', 'currency': 'sar', 'timeZone': 'Asia/Riyadh', 'language': 'AR'});
    expect((saudi.country, saudi.currency, saudi.timeZone, saudi.language), ('SA', 'SAR', 'Asia/Riyadh', 'ar'));
    expect(TenantLocale.parse(null), TenantLocale.egypt);

    final brand = TenantBrand.fromApi({'name': {'en': 'Oasis'}, 'locale': saudi.toJson()}, baseUrl: 'https://x');
    expect(brand.locale, saudi);
    expect(TenantBrand.fromJson(brand.toJson()).locale, saudi);
  });
}
