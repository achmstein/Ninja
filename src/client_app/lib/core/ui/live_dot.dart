import 'package:flutter/material.dart';

import '../motion/motion.dart';
import '../theme/ninja_theme.dart';

/// Something running now (a room's clock): a solid green dot with a soft ping
/// spreading out of it and fading, again and again, the web's `animate-ping`.
/// With reduced motion it is the dot alone.
class LiveDot extends StatefulWidget {
  final double size;
  final Color color;

  /// A ring in the colour behind it, to set it off the icon it sits on
  final Color? ring;

  const LiveDot({super.key, this.size = 8, this.color = NinjaColors.success, this.ring});

  @override
  State<LiveDot> createState() => _LiveDotState();
}

class _LiveDotState extends State<LiveDot> with SingleTickerProviderStateMixin {
  late final AnimationController _ping = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600))..repeat();

  @override
  void dispose() {
    _ping.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = widget.size;
    final ring = widget.ring;
    final dot = Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: widget.color,
        shape: BoxShape.circle,
        border: ring == null ? null : Border.all(color: ring, width: 2),
      ),
    );
    if (reduceMotion(context)) return dot;
    return SizedBox.square(
      dimension: size,
      child: Stack(
        clipBehavior: Clip.none,
        alignment: Alignment.center,
        children: [
          // The ping: out to twice the dot and gone, the first three quarters of each beat
          AnimatedBuilder(
            animation: _ping,
            builder: (context, _) {
              final t = Curves.easeOut.transform((_ping.value / 0.75).clamp(0.0, 1.0));
              return Transform.scale(
                scale: 1 + t,
                child: Container(
                  width: size,
                  height: size,
                  decoration: BoxDecoration(color: widget.color.withValues(alpha: 0.6 * (1 - t)), shape: BoxShape.circle),
                ),
              );
            },
          ),
          dot,
        ],
      ),
    );
  }
}
