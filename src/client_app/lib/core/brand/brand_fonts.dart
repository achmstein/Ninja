import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

/// One family of the brand-font catalog: the weights of 400–700 it has, and
/// whether it is a display face (for headings and the café's name).
class BrandFontEntry {
  final String family;
  final List<int> weights;
  final bool display;

  const BrandFontEntry(this.family, this.weights, {this.display = false});
}

/// The Latin families a café can choose, in the pickers' order: the same
/// list as the web apps' lib/brand-fonts.ts and Tenant.API's
/// TenantTheme.LatinFonts.
const latinFonts = [
  BrandFontEntry('Geist', [400, 500, 600, 700]),
  BrandFontEntry('Inter', [400, 500, 600, 700]),
  BrandFontEntry('Satoshi', [400, 500, 700]),
  BrandFontEntry('General Sans', [400, 500, 600, 700]),
  BrandFontEntry('Figtree', [400, 500, 600, 700]),
  BrandFontEntry('Onest', [400, 500, 600, 700]),
  BrandFontEntry('Plus Jakarta Sans', [400, 500, 600, 700]),
  BrandFontEntry('Manrope', [400, 500, 600, 700]),
  BrandFontEntry('DM Sans', [400, 500, 600, 700]),
  BrandFontEntry('Fraunces', [400, 500, 600, 700], display: true),
  BrandFontEntry('Instrument Serif', [400], display: true),
  BrandFontEntry('Playfair Display', [400, 500, 600, 700], display: true),
];

/// The Arabic families, likewise.
const arabicFonts = [
  BrandFontEntry('IBM Plex Sans Arabic', [400, 500, 600, 700]),
  BrandFontEntry('Readex Pro', [400, 500, 600, 700]),
  BrandFontEntry('Alexandria', [400, 500, 600, 700]),
  BrandFontEntry('Noto Sans Arabic', [400, 500, 600, 700]),
  BrandFontEntry('Noto Kufi Arabic', [400, 500, 600, 700]),
  BrandFontEntry('Cairo', [400, 500, 600, 700]),
  BrandFontEntry('Tajawal', [400, 500, 700]),
  BrandFontEntry('Almarai', [400, 700]),
];

/// Families google_fonts cannot fetch, bundled under assets/fonts and
/// declared in pubspec.yaml under these names (Fontshare, ITF Free Font
/// License, which allows embedding them in an app)
const bundledBrandFonts = {'Satoshi', 'General Sans'};

/// Whether the app can set text in [family]: bundled, or one google_fonts knows
bool isLoadableFont(String family) => bundledBrandFonts.contains(family) || GoogleFonts.asMap().containsKey(family);

/// [style] set in [family]: the bundled face when the app carries it,
/// otherwise fetched (and cached) by google_fonts, weight by weight
TextStyle brandFontStyle(String family, TextStyle style) =>
    bundledBrandFonts.contains(family) ? style.copyWith(fontFamily: family) : GoogleFonts.getFont(family, textStyle: style);

/// Every style of [textTheme] set in [family], as [brandFontStyle] sets one
TextTheme brandTextTheme(String family, TextTheme textTheme) {
  if (!bundledBrandFonts.contains(family)) return GoogleFonts.getTextTheme(family, textTheme);
  return textTheme.apply(fontFamily: family);
}
