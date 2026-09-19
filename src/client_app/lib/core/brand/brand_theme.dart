import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:forui/forui.dart';

const _nearBlack = Color(0xFF18181B);

/// Text and icons on a fill of [color]: white on a dark brand, near-black on
/// a light one
Color onBrandColor(Color color) =>
    ThemeData.estimateBrightnessForColor(color) == Brightness.dark ? Colors.white : _nearBlack;

/// The tenant's one brand color turned into the primary pair of a Forui
/// palette; everything else stays the neutral theme. Light: the color as
/// given. Dark: lifted so it stands on a near-black page, with dark text on
/// it. Same rule as the web apps' brand-theme.
FColors brandedColors(FColors colors, Color? brand) {
  if (brand == null) return colors;
  if (colors.brightness == Brightness.dark) {
    final hsl = HSLColor.fromColor(brand);
    final lifted = hsl
        .withLightness(math.max(hsl.lightness, 0.72))
        .withSaturation(math.min(hsl.saturation, 0.85))
        .toColor();
    return colors.copyWith(primary: lifted, primaryForeground: _nearBlack);
  }
  return colors.copyWith(primary: brand, primaryForeground: onBrandColor(brand));
}
