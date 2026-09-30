import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/brand/styles.dart';
import 'package:ninja_client/core/brand/tenant_brand.dart';

/// The port of client_web's lib/styles.ts: one style, Ninja, with the
/// business's choice of how its menu shows its dishes over it.
void main() {
  group('resolveLayout', () {
    test('nothing chosen is Ninja: a list of dishes, chips, pills, lifted surfaces', () {
      final layout = resolveLayout(null);
      expect(layout, ninja.layout);
      expect(layout.menuItem, MenuItemLayout.row);
      expect(layout.categories, CategoriesLayout.chips);
      expect(layout.header, HeaderLayout.left);
      expect(layout.buttons, ButtonsLayout.pill);
      expect(layout.surface, SurfaceLayout.shadow);
      expect(layout.density, DensityLayout.comfortable);
    });

    test("the business's menu item goes over Ninja's; the other parts are the style's", () {
      final layout = resolveLayout({'menuItem': 'card', 'density': 'airy', 'buttons': 'square'});
      expect(layout.menuItem, MenuItemLayout.card);
      expect(layout.density, DensityLayout.comfortable);
      expect(layout.buttons, ButtonsLayout.pill);
    });

    test('the cards to swipe and the tiles are choices of their own', () {
      expect(resolveLayout({'menuItem': 'deck'}).menuItem, MenuItemLayout.deck);
      expect(resolveLayout({'menuItem': 'tiles'}).menuItem, MenuItemLayout.tiles);
    });

    test("a value this build does not know falls back to Ninja's", () {
      expect(resolveLayout({'menuItem': 'carousel'}).menuItem, MenuItemLayout.row);
      expect(resolveLayout({'menuItem': 42}).menuItem, MenuItemLayout.row);
    });
  });

  test("Ninja's headings: heavy, a touch larger, tightly set", () {
    final headings = ninja.headings;
    expect(headings.font, isNull);
    expect(headings.weight, 800);
    expect(headings.scale, 1.1);
    expect(headings.uppercase, isFalse);
    expect(headings.tracking, -0.02);
  });

  group('withStyleDefaults', () {
    test("Ninja's seeds fill what the business left unset", () {
      final theme = withStyleDefaults(TenantTheme.neutral);
      expect(theme.radius, 'xl');
      expect(theme.fontLatin, 'Plus Jakarta Sans');
      expect(theme.fontArabic, 'IBM Plex Sans Arabic');
      expect(theme.headerSize, isNull);
    });

    test("the business's own seeds win, whatever style it once chose", () {
      final theme = withStyleDefaults(const TenantTheme(style: 'cozy', radius: 'none', fontLatin: 'Inter'));
      expect(theme.radius, 'none');
      expect(theme.fontLatin, 'Inter');
      expect(theme.fontArabic, 'IBM Plex Sans Arabic');
    });
  });

  group('parsing', () {
    test('the API sends the parts, the dock and the cover', () {
      final brand = TenantBrand.fromApi({
        'name': {'en': 'Chillax'},
        'theme': {
          'style': 'Cozy',
          'layout': {'menuItem': 'hero', 'categories': null, 'density': 'compact'},
          'slab': 'Neutral',
        },
        'cover': {'url': '/api/tenant/images/cover?v=3', 'width': 1600, 'height': 900},
      }, baseUrl: 'https://api.test');

      expect(brand.theme.style, 'cozy');
      expect(brand.theme.slab, 'neutral');
      expect(brand.theme.layout, {'menuItem': 'hero', 'density': 'compact'});
      expect(brand.theme.resolvedLayout.menuItem, MenuItemLayout.hero);
      expect(brand.theme.resolvedLayout.categories, CategoriesLayout.chips);
      expect(brand.cover?.url, 'https://api.test/api/tenant/images/cover?v=3');
      expect(brand.cover?.aspectRatio, closeTo(16 / 9, 0.001));

      // And the cache keeps them
      final cached = TenantBrand.fromJson(brand.toJson());
      expect(cached, brand);
      expect(cached.theme.slab, 'neutral');
      expect(cached.cover, brand.cover);
    });

    test('a brand or a cache from before styles wears Ninja, with no cover', () {
      final brand = TenantBrand.fromJson({
        'name': {'en': 'Chillax'},
        'theme': {'accent': '#ff0000'},
      });
      expect(brand.theme.style, isNull);
      expect(brand.theme.layout, isNull);
      expect(brand.theme.slab, isNull);
      expect(brand.theme.resolvedLayout, ninja.layout);
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
