import 'dart:ui' show ImageFilter;
import 'package:flutter/widgets.dart';
import 'motion.dart';

/// A content swap (client_web's blurSwap): the new child sharpens in from a
/// small blur and a 92 % scale while the old one goes the other way. Give
/// each state's child its own key. Reduce motion leaves a plain fade.
class BlurSwap extends StatelessWidget {
  final Widget child;
  final Duration duration;
  final AlignmentGeometry alignment;

  const BlurSwap({super.key, required this.child, this.duration = Motion.base, this.alignment = AlignmentDirectional.centerStart});

  @override
  Widget build(BuildContext context) {
    final reduced = reduceMotion(context);
    return AnimatedSwitcher(
      duration: reduced ? Motion.fast : duration,
      switchInCurve: Motion.enter,
      switchOutCurve: Motion.exit,
      layoutBuilder: (current, previous) => Stack(
        alignment: alignment,
        children: [...previous, ?current],
      ),
      transitionBuilder: (child, animation) {
        if (reduced) return FadeTransition(opacity: animation, child: child);
        return AnimatedBuilder(
          animation: animation,
          child: child,
          builder: (context, child) {
            final t = animation.value;
            final blur = (1 - t) * 4;
            return Opacity(
              opacity: t.clamp(0.0, 1.0),
              child: Transform.scale(
                scale: 0.92 + 0.08 * t,
                child: blur < 0.05 ? child : ImageFiltered(imageFilter: ImageFilter.blur(sigmaX: blur, sigmaY: blur), child: child),
              ),
            );
          },
        );
      },
      child: child,
    );
  }
}
