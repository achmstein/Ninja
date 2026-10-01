import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../motion/motion.dart';
import '../theme/theme_provider.dart';
import '../ui/ui.dart';

/// Under this many seconds left, the ring and the time turn red
const holdHurry = 120;

/// A count of seconds as a clock: `9:05`, or `1:02:07` past the hour
/// (client_web's formatClock)
String formatClock(double seconds) {
  final s = math.max(0, seconds.floor());
  final h = s ~/ 3600;
  final m = (s % 3600) ~/ 60;
  final ss = (s % 60).toString().padLeft(2, '0');
  return h > 0 ? '$h:${m.toString().padLeft(2, '0')}:$ss' : '$m:$ss';
}

/// What a hold made at [made] and lapsing at [until] has left at [now]: the
/// seconds, and the share of its window (the whole ring without a window)
({double? left, double share}) holdLeft(DateTime made, DateTime? until, DateTime now) {
  if (until == null) return (left: null, share: 1);
  final left = math.max(0, until.difference(now).inMilliseconds / 1000).toDouble();
  final window = math.max(1, until.difference(made).inMilliseconds / 1000);
  return (left: left, share: (left / window).clamp(0.0, 1.0));
}

/// The visit tab while a place is held (client_web's nav.tsx LiveVisit): it
/// counts down to when the hold lapses, its ring draining round the place's
/// icon (red in the last two minutes), the digits rolling like the tray's
/// total. Without a time to lapse at, the place's name stands instead. The
/// name is the tab's accessible name either way.
class LiveVisit extends StatefulWidget {
  final IconData icon;
  final String label;
  final DateTime made;
  final DateTime? until;

  /// The tab's ink, the ring's track drawn faint in it
  final Color ink;

  const LiveVisit({super.key, required this.icon, required this.label, required this.made, required this.until, required this.ink});

  @override
  State<LiveVisit> createState() => _LiveVisitState();
}

class _LiveVisitState extends State<LiveVisit> {
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  static const _ring = 26.0;

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final (:left, :share) = holdLeft(widget.made, widget.until, DateTime.now());
    final hurry = left != null && left <= holdHurry;
    final tone = hurry ? NinjaColors.error : NinjaColors.warning;
    final style = context.localeText(theme.typography.caption.copyWith(fontWeight: FontWeight.w600, color: hurry ? NinjaColors.error : widget.ink));
    return Semantics(
      label: widget.label,
      excludeSemantics: true,
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          SizedBox.square(
            dimension: _ring,
            // A short step once a second rather than a draw on every frame
            child: TweenAnimationBuilder<double>(
              tween: Tween(end: math.max(0.001, share)),
              duration: reduceMotion(context) ? Duration.zero : const Duration(milliseconds: 400),
              curve: Motion.move,
              builder: (context, share, child) => CustomPaint(
                painter: HoldRingPainter(share: share, track: widget.ink.withValues(alpha: 0.2), tone: tone),
                child: child,
              ),
              child: Center(child: Icon(widget.icon, size: 14, color: widget.ink)),
            ),
          ),
          const SizedBox(width: 6),
          Flexible(
            child: left == null
                ? Text(widget.label, maxLines: 1, overflow: TextOverflow.ellipsis, style: style)
                // Digits read left to right in Arabic too
                : Directionality(
                    textDirection: TextDirection.ltr,
                    child: RollingNumber(formatClock(left), style: style.copyWith(fontFeatures: NinjaTypography.tabular), value: left),
                  ),
          ),
        ],
      ),
    );
  }
}

/// The hold's ring: a faint track, and over it the share left drawn from the
/// top, clockwise
class HoldRingPainter extends CustomPainter {
  final double share;
  final Color track;
  final Color tone;

  const HoldRingPainter({required this.share, required this.track, required this.tone});

  static const _stroke = 2.0;

  @override
  void paint(Canvas canvas, Size size) {
    // r 11 in a 26 box, as the web's
    final rect = Rect.fromCircle(center: size.center(Offset.zero), radius: size.width / 2 - _stroke);
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = _stroke;
    canvas.drawArc(rect, 0, 2 * math.pi, false, paint..color = track);
    if (share <= 0) return;
    canvas.drawArc(rect, -math.pi / 2, 2 * math.pi * share, false, paint
      ..color = tone
      ..strokeCap = StrokeCap.round);
  }

  @override
  bool shouldRepaint(HoldRingPainter old) => old.share != share || old.tone != tone || old.track != track;
}
