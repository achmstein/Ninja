import 'dart:ui' show ImageFilter, lerpDouble;
import 'package:flutter/widgets.dart';
import 'package:forui/forui.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/app_theme.dart';

/// How long a bumped ticket takes to leave the board
const bumpDuration = Duration(milliseconds: 700);

/// A ticket marked Ready leaving the board. Its silhouette takes over the
/// card, turns the ready green and draws in to a small chip at the top —
/// "Ready #123" — which then rises toward the history in the header and
/// fades. Only after that does the card give up its slot and the board
/// close up behind it. [exit] runs 0 → 1 over [bumpDuration].
class BumpExit extends StatelessWidget {
  final Animation<double> exit;
  final String label;
  final Widget child;

  const BumpExit({super.key, required this.exit, required this.label, required this.child});

  static double _span(double t, double from, double to, [Curve curve = Curves.linear]) =>
      curve.transform(((t - from) / (to - from)).clamp(0.0, 1.0));

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final green = AppColors.emerald(theme.colors.brightness);
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final labelStyle = theme.typography.base.copyWith(fontWeight: FontWeight.w600, color: const Color(0xFFFFFFFF));

    final painter = TextPainter(
      text: TextSpan(text: label, style: labelStyle),
      textDirection: Directionality.of(context),
      textScaler: MediaQuery.maybeTextScalerOf(context) ?? TextScaler.noScaling,
      maxLines: 1,
    )..layout();
    final chipWidth = painter.width + 24 + 26;
    painter.dispose();
    const chipHeight = 40.0;

    return AnimatedBuilder(
      animation: exit,
      child: child,
      builder: (context, card) {
        final t = exit.value;
        // 0 – .18  the silhouette covers the card
        // .12 – .55 it draws in to the chip, turning green
        // .40 – .58 the chip's words come into focus
        // .62 – 1   the chip rises toward the header and fades
        final cover = _span(t, 0, 0.18);
        final shrink = _span(t, 0.12, 0.55, Motion.enter);
        final words = _span(t, 0.40, 0.58);
        final leave = _span(t, 0.62, 1, Motion.exit);

        return Stack(
          clipBehavior: Clip.none,
          children: [
            Opacity(opacity: 1 - cover, child: card),
            Positioned.fill(
              child: LayoutBuilder(
                builder: (context, box) {
                  final size = box.biggest;
                  final chipW = chipWidth.clamp(0.0, size.width);
                  final chip = Rect.fromLTWH((size.width - chipW) / 2, 8, chipW, chipHeight);
                  final whole = Offset.zero & size;
                  final rect = Rect.lerp(whole, chip, shrink)!;
                  final radius = lerpDouble(12, chipHeight / 2, shrink)!;
                  final color = Color.lerp(theme.colors.background, green, shrink)!;
                  final rise = Offset((rtl ? -1 : 1) * 36 * leave, -28 * leave);
                  return Opacity(
                    opacity: cover * (1 - leave),
                    child: Transform.translate(
                      offset: rise,
                      child: Stack(
                        children: [
                          Positioned.fromRect(
                            rect: rect,
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                color: color,
                                borderRadius: BorderRadius.circular(radius),
                                border: Border.all(color: Color.lerp(theme.colors.border, green, shrink)!),
                              ),
                            ),
                          ),
                          if (words > 0)
                            Positioned.fromRect(
                              rect: chip,
                              child: ImageFiltered(
                                imageFilter: ImageFilter.blur(sigmaX: (1 - words) * 4, sigmaY: (1 - words) * 4),
                                child: Opacity(
                                  opacity: words,
                                  child: Center(
                                    child: Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(FIcons.check, size: 18, color: const Color(0xFFFFFFFF)),
                                        const SizedBox(width: 8),
                                        Text(label, maxLines: 1, softWrap: false, style: labelStyle),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
          ],
        );
      },
    );
  }
}
