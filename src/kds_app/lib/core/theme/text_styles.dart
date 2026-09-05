import 'package:flutter/widgets.dart';

/// Forui's typography styles carry the foreground colour. Inside an
/// `FButton` the button decides the colour (white on primary, foreground
/// on outline), so labels must keep the size and weight but drop the colour
/// — otherwise a primary button paints dark text on a dark fill.
extension ButtonTextStyle on TextStyle {
  TextStyle get forButton => TextStyle(
        fontFamily: fontFamily,
        fontFamilyFallback: fontFamilyFallback,
        fontSize: fontSize,
        fontWeight: fontWeight,
        letterSpacing: letterSpacing,
        height: height,
        fontFeatures: fontFeatures,
      );
}
