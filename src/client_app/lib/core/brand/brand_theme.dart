import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:google_fonts/google_fonts.dart';
import 'tenant_brand.dart';

/// A colour in OKLCH, the space the tokens are derived in: lightness 0–1,
/// chroma, hue in degrees. A port of the web apps' brand-theme, step for
/// step, so the app and the site derive the same colours from the same seeds.
class Oklch {
  final double l;
  final double c;
  final double h;

  const Oklch(this.l, this.c, this.h);

  static double _srgbToLinear(double v) => v <= 0.04045 ? v / 12.92 : math.pow((v + 0.055) / 1.055, 2.4).toDouble();
  static double _linearToSrgb(double v) => (v <= 0.0031308 ? v * 12.92 : 1.055 * math.pow(v, 1 / 2.4) - 0.055).clamp(0.0, 1.0);
  static double _cbrt(double v) => v < 0 ? -math.pow(-v, 1 / 3).toDouble() : math.pow(v, 1 / 3).toDouble();

  factory Oklch.fromColor(Color color) {
    final r = _srgbToLinear(color.r);
    final g = _srgbToLinear(color.g);
    final b = _srgbToLinear(color.b);
    final l = _cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    final m = _cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    final s = _cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    final L = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
    final a = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
    final bb = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
    final c = math.sqrt(a * a + bb * bb);
    final h = c < 1e-4 ? 0.0 : (math.atan2(bb, a) * 180 / math.pi + 360) % 360;
    return Oklch(L, c, h);
  }

  /// Linear sRGB, clipped to the gamut
  List<double> get _linearRgb {
    final a = c * math.cos(h * math.pi / 180);
    final b = c * math.sin(h * math.pi / 180);
    final l_ = math.pow(l + 0.3963377774 * a + 0.2158037573 * b, 3).toDouble();
    final m_ = math.pow(l - 0.1055613458 * a - 0.0638541728 * b, 3).toDouble();
    final s_ = math.pow(l - 0.0894841775 * a - 1.291485548 * b, 3).toDouble();
    return [
      (4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_).clamp(0.0, 1.0),
      (-1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_).clamp(0.0, 1.0),
      (-0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_).clamp(0.0, 1.0),
    ];
  }

  Color toColor() {
    final rgb = _linearRgb;
    return Color.from(alpha: 1, red: _linearToSrgb(rgb[0]), green: _linearToSrgb(rgb[1]), blue: _linearToSrgb(rgb[2]));
  }

  /// WCAG relative luminance
  double get luminance {
    final rgb = _linearRgb;
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  }

  Oklch copyWith({double? l, double? c, double? h}) => Oklch(l ?? this.l, c ?? this.c, h ?? this.h);
}

/// WCAG contrast ratio between two colours, 1 to 21
double contrastRatio(Oklch a, Oklch b) {
  final la = a.luminance;
  final lb = b.luminance;
  return (math.max(la, lb) + 0.05) / (math.min(la, lb) + 0.05);
}

const _white = Oklch(0.985, 0, 0);

/// White or near-black, whichever contrasts more with the fill
Oklch textOn(Oklch fill) {
  final ink = Oklch(0.15, 0.02, fill.h);
  return contrastRatio(fill, _white) >= contrastRatio(fill, ink) ? _white : ink;
}

/// Text and icons on a fill of [color]: white on a dark brand, near-black on a light one
Color onBrandColor(Color color) => textOn(Oklch.fromColor(color)).toColor();

/// The tenant's seeds on top of a Forui palette, for its brightness; whatever
/// the tenant left unset stays the neutral theme's. Same rules as the web
/// apps' brand-theme:
///
/// * primary — light: as given, kept off the extremes; dark: lifted and calmed
///   unless the brand gave its own; text on it by contrast
/// * accent → secondary — light: as given; dark: pulled down to a deep tint
///   unless given
/// * surface → the neutrals of both schemes, tinted by its hue: the light page
///   is the colour given, the dark page its hue at night unless given
FColors brandedColors(FColors colors, TenantBrand brand) {
  final dark = colors.brightness == Brightness.dark;
  final theme = brand.theme;
  Color? background, foreground, muted, mutedForeground, border, primary, primaryForeground, secondary, secondaryForeground;

  final surface = theme.surface == null ? null : Oklch.fromColor(theme.surface!);
  final darkSurface = theme.dark?.surface == null ? null : Oklch.fromColor(theme.dark!.surface!);
  if (!dark && surface != null) {
    final h = surface.h;
    final c = math.min(surface.c, 0.03);
    background = Oklch(surface.l.clamp(0.9, 1.0), c, h).toColor();
    foreground = Oklch(0.17, math.min(c, 0.02), h).toColor();
    muted = Oklch(0.955, c * 0.7, h).toColor();
    mutedForeground = Oklch(0.52, math.min(c, 0.02), h).toColor();
    border = Oklch(0.9, c * 0.7, h).toColor();
  }
  final darkSeed = darkSurface ?? surface;
  if (dark && darkSeed != null) {
    final h = darkSeed.h;
    final c = math.min(darkSeed.c, 0.02);
    final page = darkSurface != null ? Oklch(darkSurface.l.clamp(0.1, 0.3), c, h) : Oklch(0.16, c, h);
    background = page.toColor();
    foreground = Oklch(0.985, c * 0.3, h).toColor();
    muted = Oklch(page.l + 0.12, c, h).toColor();
    mutedForeground = Oklch(0.72, math.min(c, 0.015), h).toColor();
  }

  final primarySeed = brand.primaryColor == null ? null : Oklch.fromColor(brand.primaryColor!);
  if (primarySeed != null) {
    final Oklch fill;
    if (dark) {
      final given = theme.dark?.primary;
      fill = given != null
          ? Oklch.fromColor(given)
          : Oklch(math.max(primarySeed.l, 0.74), math.min(primarySeed.c, 0.17), primarySeed.h);
    } else {
      fill = primarySeed.copyWith(l: primarySeed.l.clamp(0.25, 0.85));
    }
    primary = fill.toColor();
    primaryForeground = textOn(fill).toColor();
  }

  final accentSeed = theme.accent == null ? null : Oklch.fromColor(theme.accent!);
  if (accentSeed != null) {
    final Oklch fill;
    if (dark) {
      final given = theme.dark?.accent;
      fill = given != null ? Oklch.fromColor(given) : Oklch(0.32, math.min(accentSeed.c, 0.09), accentSeed.h);
    } else {
      fill = accentSeed.copyWith(l: accentSeed.l.clamp(0.3, 0.9));
    }
    secondary = fill.toColor();
    secondaryForeground = textOn(fill).toColor();
  }

  return colors.copyWith(
    background: background,
    foreground: foreground,
    muted: muted,
    mutedForeground: mutedForeground,
    border: border,
    primary: primary,
    primaryForeground: primaryForeground,
    secondary: secondary,
    secondaryForeground: secondaryForeground,
  );
}

/// The corner radius a tenant's `radius` token asks for, in logical pixels;
/// null keeps Forui's own
double? brandRadius(String? radius) => switch (radius) {
      'none' => 0,
      'sm' => 6,
      'md' => 10,
      'lg' => 16,
      'xl' => 24,
      _ => null,
    };

/// [style] with the tenant's corners: the same lerping radius Forui uses, so
/// small controls do not turn into circles, and a focus ring to match
FStyle brandedStyle(FStyle style, String? radius) {
  final r = brandRadius(radius);
  if (r == null) return style;
  return style.copyWith(
    borderRadius: FLerpBorderRadius.all(Radius.circular(r), min: r * 3),
    focusedOutlineStyle: style.focusedOutlineStyle.copyWith(borderRadius: BorderRadius.all(Radius.circular(r))),
  );
}

/// A family when google_fonts knows it, else null: an unknown family
/// silently keeps the app's own
String? brandFontFamily(String? font) => font != null && GoogleFonts.asMap().containsKey(font) ? font : null;

/// The tenant's family for text in [locale]: the Arabic one for Arabic, the
/// Latin one otherwise; null keeps the bundled face
String? brandFontFor(TenantTheme theme, Locale locale) =>
    brandFontFamily(locale.languageCode == 'ar' ? theme.fontArabic : theme.fontLatin);

/// [typography] set in [font] (a family [brandFontFamily] accepted), weight
/// by weight, so bold is the family's bold and not a synthesized one
FTypography brandedTypography(FTypography typography, String font) {
  TextStyle f(TextStyle style) => GoogleFonts.getFont(font, textStyle: style);
  return typography.copyWith(
    xs: f(typography.xs),
    sm: f(typography.sm),
    base: f(typography.base),
    lg: f(typography.lg),
    xl: f(typography.xl),
    xl2: f(typography.xl2),
    xl3: f(typography.xl3),
    xl4: f(typography.xl4),
    xl5: f(typography.xl5),
    xl6: f(typography.xl6),
    xl7: f(typography.xl7),
    xl8: f(typography.xl8),
  );
}

/// The tenant's font family for the widgets below it, already chosen for
/// the app's language, so [Text] built outside Forui's typography (AppText)
/// sets itself in the same face. Null is the bundled family.
class BrandFont extends InheritedWidget {
  final String? family;

  const BrandFont({super.key, required this.family, required super.child});

  static String? of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<BrandFont>()?.family;

  @override
  bool updateShouldNotify(BrandFont oldWidget) => oldWidget.family != family;
}
