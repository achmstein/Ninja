import 'package:flutter/material.dart';
import '../theme/theme_provider.dart';

/// A Text widget that automatically uses the correct font based on locale.
/// Use this instead of Text to ensure consistent font across the app.
class AppText extends StatelessWidget {
  final String data;
  final TextStyle? style;
  final TextAlign? textAlign;
  final TextDirection? textDirection;
  final bool? softWrap;
  final TextOverflow? overflow;
  final int? maxLines;
  final TextScaler? textScaler;

  const AppText(
    this.data, {
    super.key,
    this.style,
    this.textAlign,
    this.textDirection,
    this.softWrap,
    this.overflow,
    this.maxLines,
    this.textScaler,
  });

  @override
  Widget build(BuildContext context) {
    final effectiveStyle = context.localeText(style ?? const TextStyle());

    return Text(
      data,
      style: effectiveStyle,
      textAlign: textAlign,
      textDirection: textDirection,
      softWrap: softWrap,
      overflow: overflow,
      maxLines: maxLines,
      textScaler: textScaler,
    );
  }
}

/// Extension to easily apply locale font to any TextStyle
extension LocalizedTextStyle on TextStyle {
  /// Returns a copy of this TextStyle in the locale-appropriate font family
  TextStyle withLocaleFont(BuildContext context) => context.localeText(this);
}
