import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'brand_fonts.dart';
import '../theme/theme_provider.dart';
import 'brand_theme.dart';
import 'styles.dart';
import 'tenant_brand.dart';

/// The style the customer app wears (styles.dart), as the widgets read it:
/// the resolved layout, the headings, and the few measures each part moves
/// (the web's data-attribute tokens in client_web's index.css). It rides on
/// the Material theme as an extension; a context without one is classic,
/// which is the app exactly as it was before styles.
class BrandStyle extends ThemeExtension<BrandStyle> {
  final StyleKey style;
  final Layout layout;
  final Headings headings;
  final bool forceDark;

  /// The corners the brand's radius seed (or its style's default) asks
  /// for, in logical pixels; the web's --radius
  final double radius;

  const BrandStyle({
    required this.style,
    required this.layout,
    required this.headings,
    required this.forceDark,
    this.radius = 10,
  });

  static final classic = BrandStyle(
    style: StyleKey.classic,
    layout: styles[StyleKey.classic]!.layout,
    headings: styles[StyleKey.classic]!.headings,
    forceDark: false,
  );

  /// The style [theme] names, its layout with the café's own parts over it
  factory BrandStyle.fromTheme(TenantTheme theme) {
    final preset = theme.preset;
    return BrandStyle(
      style: theme.styleKey,
      layout: theme.resolvedLayout,
      headings: preset.headings,
      forceDark: preset.forceDark,
      radius: brandRadius(withStyleDefaults(theme).radius) ?? 10,
    );
  }

  static BrandStyle of(BuildContext context) => Theme.of(context).extension<BrandStyle>() ?? classic;

  /// Every spacing a style can move scales by this: the web's --space
  double get space => switch (layout.density) {
        DensityLayout.airy => 1.35,
        DensityLayout.compact => 0.7,
        DensityLayout.comfortable => 1,
      };

  /// Round add buttons and steppers: circles, unless the style squares its buttons
  double get roundRadius => layout.buttons == ButtonsLayout.square ? 4 : 20;

  /// Wide buttons (the cart bar): a pill, unless the style squares its buttons
  OutlinedBorder get buttonShape => layout.buttons == ButtonsLayout.square
      ? RoundedRectangleBorder(borderRadius: BorderRadius.circular(2))
      : const StadiumBorder();

  /// A card, a tile, a panel: a tonal fill with no edges (flat), the page
  /// with a hairline (outlined), or lifted with no border (shadow; a
  /// hairline on dark, where shadows vanish)
  BoxDecoration surface(FColors colors, {required double radius}) {
    final corners = BorderRadius.circular(radius);
    switch (layout.surface) {
      case SurfaceLayout.flat:
        return BoxDecoration(color: colors.muted, borderRadius: corners);
      case SurfaceLayout.shadow:
        if (colors.brightness == Brightness.dark) {
          return BoxDecoration(color: colors.background, border: Border.all(color: colors.border), borderRadius: corners);
        }
        return BoxDecoration(
          color: colors.background,
          borderRadius: corners,
          boxShadow: const [
            BoxShadow(color: Color(0x0A000000), offset: Offset(0, 1), blurRadius: 2),
            BoxShadow(color: Color(0x29000000), offset: Offset(0, 8), blurRadius: 24, spreadRadius: -8),
          ],
        );
      case SurfaceLayout.outlined:
        return BoxDecoration(color: colors.background, border: Border.all(color: colors.border), borderRadius: corners);
    }
  }

  /// [base] set as the style sets headings: its weight, its size scaled,
  /// its tracking, and its own family when it has one (Playfair for cozy,
  /// over the app's family for the script it lacks). Classic returns the
  /// bold [base] untouched.
  TextStyle heading(BuildContext context, TextStyle base) {
    final size = (base.fontSize ?? 16) * headings.scale;
    final style = base.copyWith(
      fontSize: size,
      fontWeight: _weight(headings.weight),
      letterSpacing: headings.tracking == 0 ? base.letterSpacing : headings.tracking * size,
    );
    final family = brandFontFamily(headings.font);
    if (family == null) return context.localeText(style);
    final text = context.localeText(style);
    final heading = brandFontStyle(family, style);
    return heading.copyWith(fontFamilyFallback: [if (text.fontFamily != null) text.fontFamily!]);
  }

  /// The text as the heading shows it: capitals when the style says so
  String headingText(String text) => headings.uppercase ? text.toUpperCase() : text;

  static FontWeight _weight(int weight) =>
      FontWeight.values.firstWhere((w) => w.value == weight, orElse: () => FontWeight.bold);

  @override
  BrandStyle copyWith({StyleKey? style, Layout? layout, Headings? headings, bool? forceDark, double? radius}) => BrandStyle(
        style: style ?? this.style,
        layout: layout ?? this.layout,
        headings: headings ?? this.headings,
        forceDark: forceDark ?? this.forceDark,
        radius: radius ?? this.radius,
      );

  @override
  BrandStyle lerp(BrandStyle? other, double t) => other == null || t < 0.5 ? this : other;
}

/// A section or page heading, set as the style sets headings
class BrandHeading extends StatelessWidget {
  final String text;
  final TextStyle style;
  final int? maxLines;
  final TextOverflow? overflow;

  const BrandHeading(this.text, {super.key, this.style = const TextStyle(fontSize: 16), this.maxLines, this.overflow});

  @override
  Widget build(BuildContext context) {
    final brandStyle = BrandStyle.of(context);
    return Text(
      brandStyle.headingText(text),
      style: brandStyle.heading(context, style),
      maxLines: maxLines,
      overflow: overflow,
    );
  }
}
