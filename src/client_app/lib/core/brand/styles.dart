/// The customer app's styles: one flow, many looks.
///
/// A port of `client_web/src/lib/styles.ts`, the single source of truth:
/// the same presets the API accepts, with the same values, and the same
/// resolution. A change there is made here too. (The web's page templates
/// showcase, paper, tiles and poster are not offered by the API, so they
/// are not here.)
///
/// A style dresses the same screens differently: how an item sits on the
/// menu, how the categories and the header are laid out, the shape of the
/// buttons, whether surfaces are flat, outlined or lifted, how much air
/// there is, and how headings are set. It also brings defaults for the
/// business's seeds (corners, fonts, header size), which the business's own seeds
/// always win over. A business may dress single parts its own way; those
/// choices survive a change of style.
library;

import 'tenant_brand.dart';

/// Ninja first: the platform's signature style, and the one a new business
/// starts in.
enum StyleKey { ninja, classic, minimal, bold, cozy, night }

/// row: a thumbnail beside the text; card: a photo tile in a grid; compact: text only; hero: a wide photo
enum MenuItemLayout { row, card, compact, hero }

/// chips that scroll; underlined tabs; a side list on wide screens (chips on a phone)
enum CategoriesLayout { chips, tabs, rail }

/// the brand at the start; centred; over the cover photo on the menu
enum HeaderLayout { left, center, banner }

enum ButtonsLayout { pill, rounded, square }

enum SurfaceLayout { flat, outlined, shadow }

enum DensityLayout { airy, comfortable, compact }

/// One choice per part of the customer app.
class Layout {
  final MenuItemLayout menuItem;
  final CategoriesLayout categories;
  final HeaderLayout header;
  final ButtonsLayout buttons;
  final SurfaceLayout surface;
  final DensityLayout density;

  const Layout({
    required this.menuItem,
    required this.categories,
    required this.header,
    required this.buttons,
    required this.surface,
    required this.density,
  });

  Layout copyWith({
    MenuItemLayout? menuItem,
    CategoriesLayout? categories,
    HeaderLayout? header,
    ButtonsLayout? buttons,
    SurfaceLayout? surface,
    DensityLayout? density,
  }) =>
      Layout(
        menuItem: menuItem ?? this.menuItem,
        categories: categories ?? this.categories,
        header: header ?? this.header,
        buttons: buttons ?? this.buttons,
        surface: surface ?? this.surface,
        density: density ?? this.density,
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
          other.density == density;

  @override
  int get hashCode => Object.hash(menuItem, categories, header, buttons, surface, density);

  @override
  String toString() =>
      'Layout(${menuItem.name}, ${categories.name}, ${header.name}, ${buttons.name}, ${surface.name}, ${density.name})';
}

/// How section and page headings are set.
class Headings {
  /// A family only headings use; null keeps the text's
  final String? font;
  final int weight;

  /// Relative to the classic heading size
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

  /// The dark scheme always, whatever the device or the customer says
  final bool forceDark;

  const StylePreset({required this.layout, required this.headings, required this.defaults, required this.forceDark});
}

const _classicHeadings = Headings(font: null, weight: 700, scale: 1, uppercase: false, tracking: 0);

const Map<StyleKey, StylePreset> styles = {
  // Ninja, the platform's signature style. The web customer app draws its own
  // motion-first page and bars for it (a deck of big cards, the order in a
  // tray, held to send); this app has no Ninja home yet, so it wears Ninja's
  // parts on the usual screens instead: wide photos, tabs, pill buttons,
  // lifted surfaces, in Ninja's faces and corners
  StyleKey.ninja: StylePreset(
    layout: Layout(
      menuItem: MenuItemLayout.hero,
      categories: CategoriesLayout.tabs,
      header: HeaderLayout.left,
      buttons: ButtonsLayout.pill,
      surface: SurfaceLayout.shadow,
      density: DensityLayout.comfortable,
    ),
    headings: Headings(font: null, weight: 800, scale: 1.1, uppercase: false, tracking: -0.02),
    defaults: StyleDefaults(radius: 'xl', fontLatin: 'Plus Jakarta Sans', fontArabic: 'IBM Plex Sans Arabic'),
    forceDark: false,
  ),
  // Today's look, exactly: the default for every business that never chose
  StyleKey.classic: StylePreset(
    layout: Layout(
      menuItem: MenuItemLayout.row,
      categories: CategoriesLayout.chips,
      header: HeaderLayout.left,
      buttons: ButtonsLayout.rounded,
      surface: SurfaceLayout.outlined,
      density: DensityLayout.comfortable,
    ),
    headings: _classicHeadings,
    defaults: StyleDefaults(),
    forceDark: false,
  ),
  // Quiet and typographic: no photos, thin headings, lots of air
  StyleKey.minimal: StylePreset(
    layout: Layout(
      menuItem: MenuItemLayout.compact,
      categories: CategoriesLayout.tabs,
      header: HeaderLayout.center,
      buttons: ButtonsLayout.square,
      surface: SurfaceLayout.flat,
      density: DensityLayout.airy,
    ),
    headings: Headings(font: null, weight: 500, scale: 0.8, uppercase: true, tracking: 0.12),
    defaults: StyleDefaults(radius: 'sm', fontLatin: 'DM Sans'),
    forceDark: false,
  ),
  // Big photos, heavy type, the cover up top
  StyleKey.bold: StylePreset(
    layout: Layout(
      menuItem: MenuItemLayout.hero,
      categories: CategoriesLayout.chips,
      header: HeaderLayout.banner,
      buttons: ButtonsLayout.pill,
      surface: SurfaceLayout.shadow,
      density: DensityLayout.comfortable,
    ),
    headings: Headings(font: null, weight: 800, scale: 1.3, uppercase: false, tracking: -0.02),
    defaults: StyleDefaults(radius: 'xl', fontLatin: 'Satoshi', fontArabic: 'Readex Pro', headerSize: 'md'),
    forceDark: false,
  ),
  // Warm: photo cards, serif headings, the cover up top
  StyleKey.cozy: StylePreset(
    layout: Layout(
      menuItem: MenuItemLayout.card,
      categories: CategoriesLayout.chips,
      header: HeaderLayout.banner,
      buttons: ButtonsLayout.rounded,
      surface: SurfaceLayout.shadow,
      density: DensityLayout.comfortable,
    ),
    headings: Headings(font: 'Playfair Display', weight: 600, scale: 1.2, uppercase: false, tracking: 0),
    defaults: StyleDefaults(radius: 'lg', fontLatin: 'Figtree', fontArabic: 'Almarai'),
    forceDark: false,
  ),
  // A bar at night: always dark, photo cards, pill buttons
  StyleKey.night: StylePreset(
    layout: Layout(
      menuItem: MenuItemLayout.card,
      categories: CategoriesLayout.tabs,
      header: HeaderLayout.center,
      buttons: ButtonsLayout.pill,
      surface: SurfaceLayout.outlined,
      density: DensityLayout.comfortable,
    ),
    headings: Headings(font: null, weight: 600, scale: 1.1, uppercase: false, tracking: 0.01),
    defaults: StyleDefaults(radius: 'md', fontLatin: 'Manrope'),
    forceDark: true,
  ),
};

const StyleKey defaultStyle = StyleKey.classic;

/// The style a theme names; classic for none or one this build does not know.
/// Ninja was first built as "counter"; a value saved under that name still means it.
StyleKey styleOf(String? style) {
  final name = style == 'counter' ? 'ninja' : style;
  return StyleKey.values.where((k) => k.name == name).firstOrNull ?? defaultStyle;
}

StylePreset presetOf(String? style) => styles[styleOf(style)]!;

T? _pick<T extends Enum>(List<T> values, Object? value) =>
    value is String ? values.where((v) => v.name == value).firstOrNull : null;

/// The layout the customer app wears: the style's, with each part the business
/// chose itself put over it. A value this build does not know falls back to
/// the style's, so an older app never breaks on a newer brand.
Layout resolveLayout(String? style, Map<String, dynamic>? overrides) {
  final layout = presetOf(style).layout;
  if (overrides == null) return layout;
  return layout.copyWith(
    menuItem: _pick(MenuItemLayout.values, overrides['menuItem']),
    categories: _pick(CategoriesLayout.values, overrides['categories']),
    header: _pick(HeaderLayout.values, overrides['header']),
    buttons: _pick(ButtonsLayout.values, overrides['buttons']),
    surface: _pick(SurfaceLayout.values, overrides['surface']),
    density: _pick(DensityLayout.values, overrides['density']),
  );
}

/// The seeds a theme paints with once its style's defaults fill what the
/// business left unset. The business's own values always win.
TenantTheme withStyleDefaults(TenantTheme theme) {
  final d = presetOf(theme.style).defaults;
  return theme.copyWith(
    radius: theme.radius ?? d.radius,
    fontLatin: theme.fontLatin ?? d.fontLatin,
    fontArabic: theme.fontArabic ?? d.fontArabic,
    headerSize: theme.headerSize ?? d.headerSize,
  );
}

extension TenantThemeStyle on TenantTheme {
  StyleKey get styleKey => styleOf(style);
  StylePreset get preset => presetOf(style);
  Layout get resolvedLayout => resolveLayout(style, layout);
}
