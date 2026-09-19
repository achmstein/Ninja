import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:google_fonts/google_fonts.dart';
import 'tenant_brand.dart';

const _nearBlack = Color(0xFF18181B);

/// Text and icons on a fill of [color]: white on a dark brand, near-black on
/// a light one
Color onBrandColor(Color color) =>
    ThemeData.estimateBrightnessForColor(color) == Brightness.dark ? Colors.white : _nearBlack;

/// The tenant's colors on top of a Forui palette; whatever the tenant left
/// unset stays the neutral theme's. Same rules as the web apps' brand-theme.
///
/// * primary — light: the color as given; dark: lifted so it stands on a
///   near-black page, with dark text on it
/// * accent → secondary — light: the color as given; dark: pulled down to a
///   deep tint with light text, so it reads as a surface, not a glow
/// * background, foreground — the light scheme only; dark keeps zinc
FColors brandedColors(FColors colors, TenantBrand brand) {
  final dark = colors.brightness == Brightness.dark;
  final primary = brand.primaryColor;
  final accent = brand.theme.accent;

  Color? primaryFill, primaryInk, secondaryFill, secondaryInk;
  if (primary != null) {
    if (dark) {
      final hsl = HSLColor.fromColor(primary);
      primaryFill = hsl
          .withLightness(math.max(hsl.lightness, 0.72))
          .withSaturation(math.min(hsl.saturation, 0.85))
          .toColor();
      primaryInk = _nearBlack;
    } else {
      primaryFill = primary;
      primaryInk = onBrandColor(primary);
    }
  }
  if (accent != null) {
    if (dark) {
      final hsl = HSLColor.fromColor(accent);
      secondaryFill = hsl.withLightness(0.30).withSaturation(math.min(hsl.saturation, 0.6)).toColor();
      secondaryInk = Colors.white;
    } else {
      secondaryFill = accent;
      secondaryInk = onBrandColor(accent);
    }
  }

  return colors.copyWith(
    primary: primaryFill,
    primaryForeground: primaryInk,
    secondary: secondaryFill,
    secondaryForeground: secondaryInk,
    background: dark ? null : brand.theme.background,
    foreground: dark ? null : brand.theme.foreground,
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

/// The tenant's `font` when google_fonts knows it, else null: an unknown
/// family silently keeps the app's own
String? brandFontFamily(String? font) => font != null && GoogleFonts.asMap().containsKey(font) ? font : null;

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

/// The tenant's Latin font family for the widgets below it, so [Text] built
/// outside Forui's typography (AppText) sets itself in the same face. Null
/// is the bundled Inter.
class BrandFont extends InheritedWidget {
  final String? family;

  const BrandFont({super.key, required this.family, required super.child});

  static String? of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<BrandFont>()?.family;

  @override
  bool updateShouldNotify(BrandFont oldWidget) => oldWidget.family != family;
}
