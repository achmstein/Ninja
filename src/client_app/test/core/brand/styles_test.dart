import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/brand/styles.dart';
import 'package:ninja_client/core/brand/tenant_brand.dart';
import 'package:ninja_client/core/models/localized_text.dart';
import 'package:ninja_client/core/theme/theme_provider.dart';

/// The port of client_web's lib/styles.ts: the same presets, resolved the
/// same way, so the app and the site dress a café alike.
void main() {
  group('resolveLayout', () {
    test('no style is classic, which is the app as it always was', () {
      final layout = resolveLayout(null, null);
      expect(layout, styles[StyleKey.classic]!.layout);
      expect(layout.menuItem, MenuItemLayout.row);
      expect(layout.categories, CategoriesLayout.chips);
      expect(layout.header, HeaderLayout.left);
      expect(layout.buttons, ButtonsLayout.rounded);
      expect(layout.surface, SurfaceLayout.outlined);
      expect(layout.density, DensityLayout.comfortable);
    });

    test('a style this build does not know is classic', () {
      expect(styleOf('retro'), StyleKey.classic);
      expect(resolveLayout('retro', null), styles[StyleKey.classic]!.layout);
    });

    test('each style wears its own preset', () {
      for (final key in StyleKey.values) {
        expect(resolveLayout(key.name, null), styles[key]!.layout, reason: key.name);
      }
      expect(resolveLayout('minimal', null).menuItem, MenuItemLayout.compact);
      expect(resolveLayout('bold', null).header, HeaderLayout.banner);
      expect(resolveLayout('cozy', null).menuItem, MenuItemLayout.card);
      expect(resolveLayout('night', null).categories, CategoriesLayout.tabs);
    });

    test("the café's own parts go over its style's", () {
      final layout = resolveLayout('bold', {'menuItem': 'card', 'density': 'airy'});
      expect(layout.menuItem, MenuItemLayout.card);
      expect(layout.density, DensityLayout.airy);
      // The rest is still bold's
      expect(layout.header, HeaderLayout.banner);
      expect(layout.buttons, ButtonsLayout.pill);
      expect(layout.surface, SurfaceLayout.shadow);
    });

    test("a part's value this build does not know falls back to the style's", () {
      final layout = resolveLayout('minimal', {'menuItem': 'carousel', 'header': 42, 'buttons': 'pill'});
      expect(layout.menuItem, MenuItemLayout.compact);
      expect(layout.header, HeaderLayout.center);
      expect(layout.buttons, ButtonsLayout.pill);
    });
  });

  group('the presets', () {
    test('only night keeps the page dark', () {
      for (final key in StyleKey.values) {
        expect(presetOf(key.name).forceDark, key == StyleKey.night, reason: key.name);
      }
    });

    test('night keeps the app dark whatever the customer chose; other styles leave the choice alone', () {
      const night = TenantBrand(name: LocalizedText(en: 'Bar'), theme: TenantTheme(style: 'night'));
      const cozy = TenantBrand(name: LocalizedText(en: 'Cafe'), theme: TenantTheme(style: 'cozy'));
      const light = ThemeState(themeMode: AppThemeMode.light);
      expect(light.effectiveMode(night), AppThemeMode.dark);
      expect(light.effectiveMode(cozy), AppThemeMode.light);
      expect(light.effectiveMode(TenantBrand.neutral), AppThemeMode.light);
    });

    test('cozy sets its headings in Playfair Display; classic headings are bold at their size', () {
      expect(presetOf('cozy').headings.font, 'Playfair Display');
      final classic = presetOf(null).headings;
      expect(classic.font, isNull);
      expect(classic.weight, 700);
      expect(classic.scale, 1);
      expect(classic.uppercase, isFalse);
      expect(classic.tracking, 0);
    });
  });

  group('withStyleDefaults', () {
    test("the style's seeds fill what the café left unset", () {
      final theme = withStyleDefaults(const TenantTheme(style: 'bold'));
      expect(theme.radius, 'xl');
      expect(theme.fontLatin, 'Satoshi');
      expect(theme.fontArabic, 'Readex Pro');
      expect(theme.headerSize, 'md');
    });

    test("the café's own seeds win", () {
      final theme = withStyleDefaults(const TenantTheme(style: 'cozy', radius: 'none', fontLatin: 'Inter'));
      expect(theme.radius, 'none');
      expect(theme.fontLatin, 'Inter');
      expect(theme.fontArabic, 'Almarai');
    });

    test('classic adds nothing', () {
      expect(withStyleDefaults(TenantTheme.neutral), TenantTheme.neutral);
    });
  });

  group('parsing', () {
    test('the API sends the style, the parts and the cover', () {
      final brand = TenantBrand.fromApi({
        'name': {'en': 'Chillax'},
        'theme': {
          'style': 'Cozy',
          'layout': {'menuItem': 'hero', 'categories': null, 'density': 'compact'},
        },
        'cover': {'url': '/api/tenant/images/cover?v=3', 'width': 1600, 'height': 900},
      }, baseUrl: 'https://api.test');

      expect(brand.theme.style, 'cozy');
      expect(brand.theme.layout, {'menuItem': 'hero', 'density': 'compact'});
      expect(brand.theme.resolvedLayout.menuItem, MenuItemLayout.hero);
      expect(brand.theme.resolvedLayout.categories, CategoriesLayout.chips);
      expect(brand.cover?.url, 'https://api.test/api/tenant/images/cover?v=3');
      expect(brand.cover?.aspectRatio, closeTo(16 / 9, 0.001));

      // And the cache keeps them
      final cached = TenantBrand.fromJson(brand.toJson());
      expect(cached, brand);
      expect(cached.theme.style, 'cozy');
      expect(cached.cover, brand.cover);
    });

    test('a brand or a cache from before styles is classic, with no cover', () {
      final brand = TenantBrand.fromJson({
        'name': {'en': 'Chillax'},
        'theme': {'accent': '#ff0000'},
      });
      expect(brand.theme.style, isNull);
      expect(brand.theme.layout, isNull);
      expect(brand.theme.styleKey, StyleKey.classic);
      expect(brand.cover, isNull);
    });

    test('a layout or cover of the wrong shape is none', () {
      final brand = TenantBrand.fromApi({
        'name': {'en': 'Chillax'},
        'theme': {'style': null, 'layout': 'hero'},
        'cover': {'url': '', 'width': 0, 'height': 0},
      }, baseUrl: 'https://api.test');
      expect(brand.theme.layout, isNull);
      expect(brand.cover, isNull);
    });
  });
}
