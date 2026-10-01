import 'package:flutter/material.dart';
import '../brand/brand_theme.dart';

/// The customer app's colours by role, the same roles as client_web's
/// styles/theme.css: the neutral slate palette unless the brand's seeds
/// (brand_theme.dart) set a role, in either scheme.
@immutable
class NinjaColors {
  final Brightness brightness;
  final Color background;
  final Color foreground;
  final Color card;
  final Color popover;
  final Color primary;
  final Color primaryForeground;
  final Color secondary;
  final Color secondaryForeground;
  final Color muted;
  final Color mutedForeground;
  final Color accent;
  final Color accentForeground;
  final Color destructive;
  final Color destructiveForeground;
  final Color border;
  final Color input;
  final Color ring;

  /// The dock, the tray, the sheets and the one dark card on a page:
  /// near-black on a light page, a raised dark surface on a dark one, a deep
  /// shade of the brand's colour when it has one
  final Color slab;
  final Color slabInk;

  const NinjaColors({
    required this.brightness,
    required this.background,
    required this.foreground,
    required this.card,
    required this.popover,
    required this.primary,
    required this.primaryForeground,
    required this.secondary,
    required this.secondaryForeground,
    required this.muted,
    required this.mutedForeground,
    required this.accent,
    required this.accentForeground,
    required this.destructive,
    required this.destructiveForeground,
    required this.border,
    required this.input,
    required this.ring,
    required this.slab,
    required this.slabInk,
  });

  static Color _o(double l, double c, double h) => Oklch(l, c, h).toColor();

  /// styles/theme.css :root
  static final light = NinjaColors(
    brightness: Brightness.light,
    background: _o(1, 0, 0),
    foreground: _o(0.129, 0.042, 264.695),
    card: _o(1, 0, 0),
    popover: _o(1, 0, 0),
    primary: _o(0.208, 0.042, 265.755),
    primaryForeground: _o(0.984, 0.003, 247.858),
    secondary: _o(0.968, 0.007, 247.896),
    secondaryForeground: _o(0.208, 0.042, 265.755),
    muted: _o(0.968, 0.007, 247.896),
    mutedForeground: _o(0.554, 0.046, 257.417),
    accent: _o(0.968, 0.007, 247.896),
    accentForeground: _o(0.208, 0.042, 265.755),
    destructive: _o(0.577, 0.245, 27.325),
    destructiveForeground: Colors.white,
    border: _o(0.929, 0.013, 255.508),
    input: _o(0.929, 0.013, 255.508),
    ring: _o(0.704, 0.04, 256.788),
    slab: _o(0.129, 0.042, 264.695),
    slabInk: Colors.white,
  );

  /// styles/theme.css .dark
  static final dark = NinjaColors(
    brightness: Brightness.dark,
    background: _o(0.129, 0.042, 264.695),
    foreground: _o(0.984, 0.003, 247.858),
    card: _o(0.14, 0.04, 259.21),
    popover: _o(0.208, 0.042, 265.755),
    primary: _o(0.929, 0.013, 255.508),
    primaryForeground: _o(0.208, 0.042, 265.755),
    secondary: _o(0.279, 0.041, 260.031),
    secondaryForeground: _o(0.984, 0.003, 247.858),
    muted: _o(0.279, 0.041, 260.031),
    mutedForeground: _o(0.704, 0.04, 256.788),
    accent: _o(0.279, 0.041, 260.031),
    accentForeground: _o(0.984, 0.003, 247.858),
    destructive: _o(0.704, 0.191, 22.216),
    destructiveForeground: Colors.white,
    border: Colors.white.withValues(alpha: 0.10),
    input: Colors.white.withValues(alpha: 0.15),
    ring: _o(0.551, 0.027, 264.364),
    slab: _o(0.235, 0.035, 262),
    slabInk: _o(0.984, 0.003, 247.858),
  );

  static NinjaColors of(Brightness brightness) => brightness == Brightness.dark ? dark : light;

  /// Status colours, the same in both schemes (index.css: emerald-400, amber-400, red-400)
  static const success = Color(0xFF34D399);
  static const warning = Color(0xFFFBBF24);
  static const error = Color(0xFFF87171);

  /// Their neighbours in the web's palette, where it reaches past the 400s:
  /// the solid fill (500), the ink on a light page (600, 700, 950) and the
  /// ink on the slab or a dark page (300, 100)
  static const successSolid = Color(0xFF10B981); // emerald-500
  static const successInk = Color(0xFF059669); // emerald-600
  static const successOnSlab = Color(0xFF6EE7B7); // emerald-300
  static const warningSolid = Color(0xFFF59E0B); // amber-500
  static const warningInk = Color(0xFFB45309); // amber-700
  static const warningInkDeep = Color(0xFF451A03); // amber-950
  static const warningOnSlab = Color(0xFFFCD34D); // amber-300
  static const warningOnSlabPale = Color(0xFFFEF3C7); // amber-100
  static const errorSolid = Color(0xFFEF4444); // red-500
  static const errorOnSlab = Color(0xFFFCA5A5); // red-300

  /// A place's other rates, beside its base one in the business's colour (client_web's optionColor: orange-500)
  static const otherRate = Color(0xFFF97316);

  NinjaColors copyWith({
    Color? background,
    Color? foreground,
    Color? card,
    Color? popover,
    Color? primary,
    Color? primaryForeground,
    Color? secondary,
    Color? secondaryForeground,
    Color? muted,
    Color? mutedForeground,
    Color? accent,
    Color? accentForeground,
    Color? destructive,
    Color? border,
    Color? input,
    Color? ring,
    Color? slab,
    Color? slabInk,
  }) =>
      NinjaColors(
        brightness: brightness,
        background: background ?? this.background,
        foreground: foreground ?? this.foreground,
        card: card ?? this.card,
        popover: popover ?? this.popover,
        primary: primary ?? this.primary,
        primaryForeground: primaryForeground ?? this.primaryForeground,
        secondary: secondary ?? this.secondary,
        secondaryForeground: secondaryForeground ?? this.secondaryForeground,
        muted: muted ?? this.muted,
        mutedForeground: mutedForeground ?? this.mutedForeground,
        accent: accent ?? this.accent,
        accentForeground: accentForeground ?? this.accentForeground,
        destructive: destructive ?? this.destructive,
        destructiveForeground: destructiveForeground,
        border: border ?? this.border,
        input: input ?? this.input,
        ring: ring ?? this.ring,
        slab: slab ?? this.slab,
        slabInk: slabInk ?? this.slabInk,
      );

  static NinjaColors lerp(NinjaColors a, NinjaColors b, double t) {
    Color l(Color x, Color y) => Color.lerp(x, y, t)!;
    return NinjaColors(
      brightness: t < 0.5 ? a.brightness : b.brightness,
      background: l(a.background, b.background),
      foreground: l(a.foreground, b.foreground),
      card: l(a.card, b.card),
      popover: l(a.popover, b.popover),
      primary: l(a.primary, b.primary),
      primaryForeground: l(a.primaryForeground, b.primaryForeground),
      secondary: l(a.secondary, b.secondary),
      secondaryForeground: l(a.secondaryForeground, b.secondaryForeground),
      muted: l(a.muted, b.muted),
      mutedForeground: l(a.mutedForeground, b.mutedForeground),
      accent: l(a.accent, b.accent),
      accentForeground: l(a.accentForeground, b.accentForeground),
      destructive: l(a.destructive, b.destructive),
      destructiveForeground: l(a.destructiveForeground, b.destructiveForeground),
      border: l(a.border, b.border),
      input: l(a.input, b.input),
      ring: l(a.ring, b.ring),
      slab: l(a.slab, b.slab),
      slabInk: l(a.slabInk, b.slabInk),
    );
  }

  @override
  bool operator ==(Object other) =>
      other is NinjaColors &&
      other.brightness == brightness &&
      other.background == background &&
      other.foreground == foreground &&
      other.card == card &&
      other.popover == popover &&
      other.primary == primary &&
      other.primaryForeground == primaryForeground &&
      other.secondary == secondary &&
      other.secondaryForeground == secondaryForeground &&
      other.muted == muted &&
      other.mutedForeground == mutedForeground &&
      other.accent == accent &&
      other.accentForeground == accentForeground &&
      other.destructive == destructive &&
      other.border == border &&
      other.input == input &&
      other.ring == ring &&
      other.slab == slab &&
      other.slabInk == slabInk;

  @override
  int get hashCode => Object.hashAll([
        brightness, background, foreground, card, popover, primary, primaryForeground, secondary,
        secondaryForeground, muted, mutedForeground, accent, accentForeground, destructive, border, input, ring, slab, slabInk,
      ]);
}

/// The type scale, one for every page (client_web's theme.css @theme): each
/// step is a job, not a size. Headings grow with the style's heading scale.
/// No family and no colour here: AppText and [BuildContext.localeText] set
/// the face, the text's place its ink.
@immutable
class NinjaTypography {
  /// A page's name, a sheet's (28 px at the Ninja heading scale)
  final TextStyle title;

  /// A section, a menu category, a card's title (20 px)
  final TextStyle headline;

  /// A dish, a row's bold value
  final TextStyle name;

  /// Labels and what is read
  final TextStyle body;

  /// What a thing is, under its name
  final TextStyle note;

  /// Small details, prices in pills, meta
  final TextStyle caption;

  /// Badges only
  final TextStyle micro;

  /// The one big number a card is about
  final TextStyle display;
  final TextStyle displayLg;

  const NinjaTypography({
    required this.title,
    required this.headline,
    required this.name,
    required this.body,
    required this.note,
    required this.caption,
    required this.micro,
    required this.display,
    required this.displayLg,
  });

  factory NinjaTypography.scaled(double headingScale) {
    TextStyle s(double size, double height) => TextStyle(fontSize: size, height: height);
    return NinjaTypography(
      title: s(25.6 * headingScale, 1.15),
      headline: s(18.4 * headingScale, 1.2),
      name: s(16, 1.25),
      body: s(15, 1.4),
      note: s(14, 1.4),
      caption: s(13, 1.35),
      micro: s(11, 1.3),
      display: s(30, 1.1),
      displayLg: s(40, 1.05),
    );
  }

  static const tabular = [FontFeature.tabularFigures()];
}

/// Corners, shadows and measures (theme.css, index.css, chrome.ts)
abstract final class Ninja {
  /// Big cards, the dock, the tray, sheets
  static const cardRadius = 28.0;
  static const sheetRadius = 28.0;

  /// Panels, notices
  static const panelRadius = 24.0;

  /// Tiles, option pills, suggestion cards
  static const tileRadius = 20.0;

  /// The page's side padding and the gap between sections
  static const pagePadding = 16.0;
  static const sectionGap = 20.0;

  /// The app is a column this wide at most, centred on a wide screen
  static const maxWidth = 512.0;

  /// A card or panel lifted off the page (--surface-shadow); on dark a hairline instead
  static const surfaceShadow = [
    BoxShadow(color: Color(0x0A000000), offset: Offset(0, 1), blurRadius: 2),
    BoxShadow(color: Color(0x29000000), offset: Offset(0, 8), blurRadius: 24, spreadRadius: -8),
  ];

  /// The dock (--slab-shadow)
  static const slabShadow = [BoxShadow(color: Color(0x47000000), offset: Offset(0, 6), blurRadius: 18, spreadRadius: -10)];

  /// The primary call to action
  static const ctaShadow = [BoxShadow(color: Color(0x73000000), offset: Offset(0, 8), blurRadius: 20, spreadRadius: -10)];

  /// A sheet over the page
  static const sheetShadow = [BoxShadow(color: Color(0x8C000000), offset: Offset(0, 24), blurRadius: 60, spreadRadius: -16)];

  /// The scrim behind a sheet, and behind the open tray
  static const sheetScrim = Color(0x73000000);
  static const trayScrim = Color(0x66000000);
}

/// The customer app's theme: colours, type, the brand's corner radius. It
/// rides on Material's ThemeData as an extension, one per brightness, and is
/// read with `context.theme`.
class NinjaTheme extends ThemeExtension<NinjaTheme> {
  final NinjaColors colors;
  final NinjaTypography typography;

  /// The brand's radius seed (the style's xl by default): the web's --radius
  final double radius;

  const NinjaTheme({required this.colors, required this.typography, this.radius = 24});

  factory NinjaTheme.neutral(Brightness brightness) {
    final colors = NinjaColors.of(brightness);
    return NinjaTheme(colors: colors, typography: NinjaTypography.scaled(1.1));
  }

  // The web's radius scale, from the seed
  double get radiusSm => (radius - 4).clamp(0, double.infinity);
  double get radiusMd => (radius - 2).clamp(0, double.infinity);
  double get radiusLg => radius;
  double get radiusXl => radius + 4;
  double get radius2xl => radius + 8;
  double get radius3xl => radius + 16;

  /// A card or panel lifted off the page: a shadow on light, a hairline on dark
  BoxDecoration surface({double? radius, Color? color}) {
    final corners = BorderRadius.circular(radius ?? radiusLg);
    if (colors.brightness == Brightness.dark) {
      return BoxDecoration(color: color ?? colors.card, borderRadius: corners, border: Border.all(color: colors.border));
    }
    return BoxDecoration(color: color ?? colors.card, borderRadius: corners, boxShadow: Ninja.surfaceShadow);
  }

  @override
  NinjaTheme copyWith({NinjaColors? colors, NinjaTypography? typography, double? radius}) => NinjaTheme(
        colors: colors ?? this.colors,
        typography: typography ?? this.typography,
        radius: radius ?? this.radius,
      );

  @override
  NinjaTheme lerp(NinjaTheme? other, double t) {
    if (other == null) return this;
    return NinjaTheme(
      colors: NinjaColors.lerp(colors, other.colors, t),
      typography: t < 0.5 ? typography : other.typography,
      radius: radius + (other.radius - radius) * t,
    );
  }
}

extension NinjaThemeContext on BuildContext {
  /// The customer app's theme for this part of the tree
  NinjaTheme get theme => Theme.of(this).extension<NinjaTheme>() ?? NinjaTheme.neutral(Theme.of(this).brightness);
}

/// Material's theme around a [NinjaTheme], for the Material widgets still in
/// use (text fields, sliders, progress, the scaffold): the same roles, set in
/// [fontFamily], with [extensions] riding along
ThemeData materialThemeFor(NinjaTheme theme, {String? fontFamily, List<ThemeExtension<dynamic>> extensions = const []}) {
  final c = theme.colors;
  return ThemeData(
    brightness: c.brightness,
    useMaterial3: true,
    fontFamily: fontFamily,
    colorScheme: ColorScheme(
      brightness: c.brightness,
      primary: c.primary,
      onPrimary: c.primaryForeground,
      secondary: c.secondary,
      onSecondary: c.secondaryForeground,
      error: c.destructive,
      onError: c.destructiveForeground,
      surface: c.background,
      onSurface: c.foreground,
      surfaceContainerHighest: c.muted,
      onSurfaceVariant: c.mutedForeground,
      outline: c.border,
      outlineVariant: c.border,
    ),
    scaffoldBackgroundColor: c.background,
    canvasColor: c.background,
    dividerColor: c.border,
    splashFactory: NoSplash.splashFactory,
    highlightColor: Colors.transparent,
    textSelectionTheme: TextSelectionThemeData(cursorColor: c.foreground, selectionHandleColor: c.primary),
    progressIndicatorTheme: ProgressIndicatorThemeData(color: c.foreground),
    extensions: [theme, ...extensions],
  );
}

/// Both schemes' Material themes, for the parts of the page that are always
/// dark (a sheet, the dock) wherever the page is light
class NinjaSchemes extends InheritedWidget {
  final ThemeData light;
  final ThemeData dark;

  const NinjaSchemes({super.key, required this.light, required this.dark, required super.child});

  /// The dark scheme: the app's own, or the neutral one outside the app (a test)
  static ThemeData darkOf(BuildContext context) =>
      context.dependOnInheritedWidgetOfExactType<NinjaSchemes>()?.dark ?? materialThemeFor(NinjaTheme.neutral(Brightness.dark));

  @override
  bool updateShouldNotify(NinjaSchemes oldWidget) => oldWidget.light != light || oldWidget.dark != dark;
}

/// [child] set in the dark scheme, as the web's `dark` class sets a sheet:
/// everything in it reads on the dark page whatever the page around it is
class DarkScope extends StatelessWidget {
  final Widget child;

  const DarkScope({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final theme = NinjaSchemes.darkOf(context);
    final ink = theme.extension<NinjaTheme>()?.colors.foreground ?? Colors.white;
    return Theme(
      data: theme,
      child: DefaultTextStyle.merge(style: TextStyle(color: ink), child: IconTheme.merge(data: IconThemeData(color: ink), child: child)),
    );
  }
}
