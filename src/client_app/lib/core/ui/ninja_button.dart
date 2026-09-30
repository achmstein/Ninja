import 'package:flutter/material.dart';
import '../theme/ninja_theme.dart';
import 'pressable.dart';

/// primary: the one thing to do (`pillAction`); secondary: the muted pill
/// beside it (`pillCancel`); outline: a hairline pill; ghost: text only;
/// destructive: a red pill
enum NinjaButtonVariant { primary, secondary, outline, ghost, destructive }

/// md: 48 px, the web's `h-12`; sm: 36 px, a pill in a row
enum NinjaButtonSize { md, sm }

/// The customer app's button: a full pill, as client_web draws every button
/// (pillAction / pillCancel in components/ui/ninja-sheet.tsx). It fills its
/// width unless [mainAxisSize] is min, gives a little under the thumb, and
/// shows a spinner in place of its label while [busy]. Null [onPress] is
/// disabled.
class NinjaButton extends StatelessWidget {
  final VoidCallback? onPress;
  final Widget child;
  final Widget? prefix;
  final Widget? suffix;
  final NinjaButtonVariant variant;
  final NinjaButtonSize size;
  final MainAxisSize mainAxisSize;
  final bool busy;

  /// The primary call to action's lift off the page
  final bool lifted;

  const NinjaButton({
    super.key,
    required this.onPress,
    required this.child,
    this.prefix,
    this.suffix,
    this.variant = NinjaButtonVariant.primary,
    this.size = NinjaButtonSize.md,
    this.mainAxisSize = MainAxisSize.max,
    this.busy = false,
    this.lifted = false,
  });

  /// A round button holding an icon: a stepper's − and +, a close
  static Widget icon({
    Key? key,
    required VoidCallback? onPress,
    required Widget child,
    NinjaButtonVariant variant = NinjaButtonVariant.secondary,
    double size = 40,
    String? semanticLabel,
  }) =>
      NinjaIconButton(key: key, onPress: onPress, variant: variant, size: size, semanticLabel: semanticLabel, child: child);

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final (fill, ink, border) = _paint(theme.colors, variant);
    final enabled = onPress != null && !busy;
    final height = size == NinjaButtonSize.md ? 48.0 : 36.0;
    final text = (size == NinjaButtonSize.md ? theme.typography.body : theme.typography.caption).copyWith(
      color: ink,
      fontWeight: variant == NinjaButtonVariant.primary || variant == NinjaButtonVariant.destructive ? FontWeight.w700 : FontWeight.w600,
    );

    final label = busy
        ? SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2, color: ink))
        : Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (prefix != null) ...[prefix!, const SizedBox(width: 8)],
              Flexible(child: child),
              if (suffix != null) ...[const SizedBox(width: 8), suffix!],
            ],
          );

    return Pressable(
      onTap: enabled ? onPress : null,
      scale: 0.97,
      child: AnimatedOpacity(
        opacity: onPress == null ? 0.5 : 1,
        duration: const Duration(milliseconds: 150),
        child: Container(
          height: height,
          padding: EdgeInsets.symmetric(horizontal: size == NinjaButtonSize.md ? 20 : 14),
          decoration: ShapeDecoration(
            color: fill,
            shape: StadiumBorder(side: border == null ? BorderSide.none : BorderSide(color: border)),
            shadows: lifted && enabled ? Ninja.ctaShadow : null,
          ),
          child: Row(
            mainAxisSize: mainAxisSize,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              DefaultTextStyle.merge(
                style: text,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                child: IconTheme.merge(data: IconThemeData(color: ink, size: 18), child: label),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

(Color, Color, Color?) _paint(NinjaColors c, NinjaButtonVariant variant) => switch (variant) {
      NinjaButtonVariant.primary => (c.primary, c.primaryForeground, null),
      NinjaButtonVariant.secondary => (c.muted, c.foreground, null),
      NinjaButtonVariant.outline => (Colors.transparent, c.foreground, c.border),
      NinjaButtonVariant.ghost => (Colors.transparent, c.foreground, null),
      NinjaButtonVariant.destructive => (c.destructive, c.destructiveForeground, null),
    };

/// A round button holding an icon (the web's `grid size-10 rounded-full bg-muted`)
class NinjaIconButton extends StatelessWidget {
  final VoidCallback? onPress;
  final Widget child;
  final NinjaButtonVariant variant;
  final double size;
  final String? semanticLabel;

  const NinjaIconButton({
    super.key,
    required this.onPress,
    required this.child,
    this.variant = NinjaButtonVariant.secondary,
    this.size = 40,
    this.semanticLabel,
  });

  @override
  Widget build(BuildContext context) {
    final (fill, ink, border) = _paint(context.theme.colors, variant);
    return Pressable(
      onTap: onPress,
      scale: 0.92,
      semanticLabel: semanticLabel,
      child: AnimatedOpacity(
        opacity: onPress == null ? 0.4 : 1,
        duration: const Duration(milliseconds: 150),
        child: Container(
          width: size,
          height: size,
          alignment: Alignment.center,
          decoration: ShapeDecoration(
            color: fill,
            shape: CircleBorder(side: border == null ? BorderSide.none : BorderSide(color: border)),
          ),
          child: IconTheme.merge(data: IconThemeData(color: ink, size: size * 0.45), child: child),
        ),
      ),
    );
  }
}
