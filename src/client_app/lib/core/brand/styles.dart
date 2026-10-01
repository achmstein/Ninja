/// The customer app's style: Ninja, the one client_web wears.
///
/// A port of `client_web/src/lib/styles.ts`, the single source of truth:
/// motion-first, one thumb, the order in a tray in the dock. Its pills and
/// lifted surfaces are the theme's own (ninja_theme.dart); what it brings
/// here is how headings are set and the seeds it suggests, which the
/// business's own seeds always win over. The business still chooses how its
/// menu shows its dishes (`theme.layout.menuItem`, client_web's
/// menu-style.ts) and how the Book tab lists its places
/// (`theme.layout.places`); every other part of the page is the style's.
library;

import 'tenant_brand.dart';

/// row: a photo beside the text (the default); card: a photo tile in a grid;
/// compact: text only; hero: a wide photo; deck: big cards to swipe, one
/// column a category; tiles: a grid of small tiles, the whole menu at once
enum MenuItemLayout { row, card, compact, hero, deck, tiles }

/// chips that scroll; underlined tabs; a side list on wide screens (chips on a phone)
enum CategoriesLayout { chips, tabs, rail }

/// the brand at the start; centred; over the cover photo on the menu
enum HeaderLayout { left, center, banner }

enum ButtonsLayout { pill, rounded, square }

enum SurfaceLayout { flat, outlined, shadow }

enum DensityLayout { airy, comfortable, compact }

/// How the Book tab lists its places. cards: one big card each (the
/// default); list: a slim row each; grid: two small tiles a row
enum PlacesLayout { cards, list, grid }

/// One choice per part of the customer app.
class Layout {
  final MenuItemLayout menuItem;
  final CategoriesLayout categories;
  final HeaderLayout header;
  final ButtonsLayout buttons;
  final SurfaceLayout surface;
  final DensityLayout density;
  final PlacesLayout places;

  const Layout({
    required this.menuItem,
    required this.categories,
    required this.header,
    required this.buttons,
    required this.surface,
    required this.density,
    this.places = PlacesLayout.cards,
  });

  Layout copyWith({
    MenuItemLayout? menuItem,
    CategoriesLayout? categories,
    HeaderLayout? header,
    ButtonsLayout? buttons,
    SurfaceLayout? surface,
    DensityLayout? density,
    PlacesLayout? places,
  }) =>
      Layout(
        menuItem: menuItem ?? this.menuItem,
        categories: categories ?? this.categories,
        header: header ?? this.header,
        buttons: buttons ?? this.buttons,
        surface: surface ?? this.surface,
        density: density ?? this.density,
        places: places ?? this.places,
      );

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Layout &&
          other.menuItem == menuItem &&
          other.categories == categories &&
          other.header == header &&
          other.buttons == buttons &&
          other.surface == surface &&
          other.density == density &&
          other.places == places;

  @override
  int get hashCode => Object.hash(menuItem, categories, header, buttons, surface, density, places);

  @override
  String toString() =>
      'Layout(${menuItem.name}, ${categories.name}, ${header.name}, ${buttons.name}, ${surface.name}, ${density.name}, ${places.name})';
}

/// How section and page headings are set.
class Headings {
  /// A family only headings use; null keeps the text's
  final String? font;
  final int weight;

  /// Relative to the base heading size
  final double scale;
  final bool uppercase;

  /// Letter spacing, em
  final double tracking;

  const Headings({this.font, required this.weight, required this.scale, required this.uppercase, required this.tracking});
}

/// Seeds the style suggests; the business's own seeds win.
class StyleDefaults {
  final String? radius;
  final String? fontLatin;
  final String? fontArabic;
  final String? headerSize;

  const StyleDefaults({this.radius, this.fontLatin, this.fontArabic, this.headerSize});
}

class StylePreset {
  final Layout layout;
  final Headings headings;
  final StyleDefaults defaults;

  const StylePreset({required this.layout, required this.headings, required this.defaults});
}

/// Ninja: a list of dishes unless the business picks another, the
/// categories as chips, the brand at the start, pill buttons, lifted surfaces
const ninja = StylePreset(
  layout: Layout(
    menuItem: MenuItemLayout.row,
    categories: CategoriesLayout.chips,
    header: HeaderLayout.left,
    buttons: ButtonsLayout.pill,
    surface: SurfaceLayout.shadow,
    density: DensityLayout.comfortable,
  ),
  headings: Headings(font: null, weight: 800, scale: 1.1, uppercase: false, tracking: -0.02),
  defaults: StyleDefaults(radius: 'xl', fontLatin: 'Plus Jakarta Sans', fontArabic: 'IBM Plex Sans Arabic'),
);

T? _pick<T extends Enum>(List<T> values, Object? value) =>
    value is String ? values.where((v) => v.name == value).firstOrNull : null;

/// The layout the customer app wears: Ninja's, with the business's choice
/// of how the menu shows its dishes and how the Book tab lists its places over it. A value this build does not
/// know falls back to Ninja's, so an older app never breaks on a newer brand.
Layout resolveLayout(Map<String, dynamic>? overrides) =>
    ninja.layout.copyWith(
      menuItem: _pick(MenuItemLayout.values, overrides?['menuItem']),
      places: _pick(PlacesLayout.values, overrides?['places']),
    );

/// The seeds a theme paints with once the style's defaults fill what the
/// business left unset. The business's own values always win.
TenantTheme withStyleDefaults(TenantTheme theme) {
  final d = ninja.defaults;
  return theme.copyWith(
    radius: theme.radius ?? d.radius,
    fontLatin: theme.fontLatin ?? d.fontLatin,
    fontArabic: theme.fontArabic ?? d.fontArabic,
    headerSize: theme.headerSize ?? d.headerSize,
  );
}

extension TenantThemeStyle on TenantTheme {
  Layout get resolvedLayout => resolveLayout(layout);
}
