import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/brand/tenant_brand.dart';
import 'package:ninja_client/core/providers/locale_provider.dart';

void main() {
  group('openingLanguage', () {
    test('a one-language business speaks only that language, whatever the customer chose', () {
      expect(openingLanguage(contentLanguages: 'en', businessDefault: 'ar', chosen: 'ar'), 'en');
      expect(openingLanguage(contentLanguages: 'ar', businessDefault: 'en', chosen: 'en'), 'ar');
    });

    test('a business in both languages opens in its default until the customer picks', () {
      expect(openingLanguage(contentLanguages: 'both', businessDefault: 'en'), 'en');
      expect(openingLanguage(contentLanguages: 'both', businessDefault: 'en', chosen: 'ar'), 'ar');
      expect(openingLanguage(contentLanguages: 'both', businessDefault: 'fr'), 'ar');
    });
  });

  group('TenantLocale.contentLanguages', () {
    test('an older stack that does not say reads as both', () {
      expect(TenantLocale.parse(<String, dynamic>{'country': 'EG'}).contentLanguages, 'both');
      expect(TenantLocale.parse(<String, dynamic>{'contentLanguages': 'fr'}).writesOneLanguage, isFalse);
    });

    test('a one-language business says so, and it survives the cache', () {
      final locale = TenantLocale.parse(<String, dynamic>{'contentLanguages': 'AR'});
      expect(locale.contentLanguages, 'ar');
      expect(locale.writesOneLanguage, isTrue);
      expect(TenantLocale.parse(locale.toJson()), locale);
    });
  });
}
