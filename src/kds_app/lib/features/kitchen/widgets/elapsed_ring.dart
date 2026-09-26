import 'dart:math' as math;
import 'package:flutter/widgets.dart';
import 'package:forui/forui.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/app_theme.dart';
import '../status.dart';

/// How far an order is through its time, as a thin ring beside the clock:
/// it fills from the top over the minutes until the order is late
/// ([delayedAfterMinutes]), its colour easing calm → amber → red at the
/// board's own thresholds. Only a late order moves at rest — a slow
/// breathing of the ring's opacity, once every 1.6 s.
class ElapsedRing extends StatefulWidget {
  final DateTime? since;
  final DateTime now;
  final double size;

  const ElapsedRing({super.key, required this.since, required this.now, this.size = 20});

  @override
  State<ElapsedRing> createState() => _ElapsedRingState();
}

class _ElapsedRingState extends State<ElapsedRing> with SingleTickerProviderStateMixin {
  late final AnimationController _pulse = AnimationController(vsync: this, duration: const Duration(milliseconds: 1600));

  @override
  void dispose() {
    _pulse.dispose();
    super.dispose();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _syncPulse(_isLate());
  }

  @override
  void didUpdateWidget(ElapsedRing old) {
    super.didUpdateWidget(old);
    _syncPulse(_isLate());
  }

  bool _isLate() => orderUrgency(widget.since, widget.now) == OrderUrgency.delayed && !reduceMotion(context);

  void _syncPulse(bool late) {
    if (late && !_pulse.isAnimating) {
      _pulse.repeat();
    } else if (!late && _pulse.isAnimating) {
      _pulse
        ..stop()
        ..value = 0;
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final since = widget.since;
    final urgency = orderUrgency(since, widget.now);
    final minutes = since == null ? 0.0 : widget.now.difference(since).inMilliseconds / 60000;
    final progress = (minutes / delayedAfterMinutes).clamp(0.0, 1.0);
    final color = switch (urgency) {
      OrderUrgency.fresh => theme.colors.mutedForeground,
      OrderUrgency.warning => AppColors.amber(theme.colors.brightness),
      OrderUrgency.delayed => theme.colors.destructive,
    };
    final late = _pulse.isAnimating;

    return RepaintBoundary(
      child: TweenAnimationBuilder<Color?>(
        tween: ColorTween(end: color),
        duration: const Duration(milliseconds: 600),
        curve: Motion.move,
        builder: (context, ink, _) => AnimatedBuilder(
          animation: _pulse,
          builder: (context, _) {
            // 1 → 0.45 → 1, smoothly, once per cycle
            final breath = late ? 0.725 + 0.275 * math.cos(_pulse.value * 2 * math.pi) : 1.0;
            return Opacity(
              opacity: breath,
              child: SizedBox.square(
                dimension: widget.size,
                child: CustomPaint(painter: _RingPainter(progress: progress, color: ink ?? color)),
              ),
            );
          },
        ),
      ),
    );
  }
}

class _RingPainter extends CustomPainter {
  final double progress;
  final Color color;
  const _RingPainter({required this.progress, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    const stroke = 2.5;
    final rect = (Offset.zero & size).deflate(stroke / 2);
    canvas.drawOval(
      rect,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..color = color.withValues(alpha: color.a * 0.2),
    );
    if (progress <= 0) return;
    canvas.drawArc(
      rect,
      -math.pi / 2,
      2 * math.pi * progress,
      false,
      Paint()
        ..style = PaintingStyle.stroke
        ..strokeWidth = stroke
        ..strokeCap = StrokeCap.round
        ..color = color,
    );
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.progress != progress || old.color != color;
}
