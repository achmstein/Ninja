import 'package:flutter/widgets.dart';
import 'motion.dart';

/// Something new in a list arriving: it slides in from the reading edge
/// (the left in English, the right in Arabic) and fades up, once, when it
/// is first built. [highlight] draws a border in that colour over it that
/// fades away after the slide — a single "this one is new", no glow.
class SlideInItem extends StatefulWidget {
  final Widget child;

  /// False builds the child as it is (an item that was already there)
  final bool animate;

  /// How far it travels, in logical pixels
  final double distance;

  /// Where it comes from; the reading start edge when null
  final AxisDirection? from;
  final Duration delay;
  final Color? highlight;
  final BorderRadius highlightRadius;
  final Duration highlightFade;

  const SlideInItem({
    super.key,
    required this.child,
    this.animate = true,
    this.distance = 24,
    this.from,
    this.delay = Duration.zero,
    this.highlight,
    this.highlightRadius = const BorderRadius.all(Radius.circular(12)),
    this.highlightFade = const Duration(milliseconds: 1400),
  });

  @override
  State<SlideInItem> createState() => _SlideInItemState();
}

class _SlideInItemState extends State<SlideInItem> with SingleTickerProviderStateMixin {
  late final AnimationController _c;
  late final Duration _total;

  @override
  void initState() {
    super.initState();
    final slide = widget.delay + Motion.slow;
    final glow = widget.highlight == null ? Duration.zero : slide + widget.highlightFade;
    _total = glow > slide ? glow : slide;
    _c = AnimationController(vsync: this, duration: _total, value: widget.animate ? 0 : 1);
    if (widget.animate) _c.forward();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  double _interval(double startMs, double endMs, Curve curve) {
    final total = _total.inMicroseconds / 1000;
    final t = (_c.value * total - startMs) / (endMs - startMs);
    return curve.transform(t.clamp(0.0, 1.0));
  }

  Offset _direction(TextDirection text) {
    final from = widget.from ?? (text == TextDirection.rtl ? AxisDirection.right : AxisDirection.left);
    return switch (from) {
      AxisDirection.left => const Offset(-1, 0),
      AxisDirection.right => const Offset(1, 0),
      AxisDirection.up => const Offset(0, -1),
      AxisDirection.down => const Offset(0, 1),
    };
  }

  @override
  Widget build(BuildContext context) {
    final reduce = reduceMotion(context);
    final direction = _direction(Directionality.of(context)) * widget.distance;
    final delay = widget.delay.inMicroseconds / 1000;
    final slideEnd = delay + Motion.slow.inMilliseconds;

    return AnimatedBuilder(
      animation: _c,
      child: widget.child,
      builder: (context, child) {
        if (_c.isCompleted) return child!;
        final opacity = _interval(delay, delay + Motion.base.inMilliseconds, Curves.linear);
        final travel = reduce ? 0.0 : 1 - _interval(delay, slideEnd, Motion.enter);
        Widget out = Opacity(opacity: opacity, child: child);
        if (travel != 0) out = Transform.translate(offset: direction * travel, child: out);
        final color = widget.highlight;
        if (color != null) {
          // Full strength while it lands, then one long fade
          final strength = 1 - _interval(slideEnd, slideEnd + widget.highlightFade.inMilliseconds, Curves.easeOut);
          if (strength > 0) {
            out = CustomPaint(
              foregroundPainter: _BorderPainter(color.withValues(alpha: color.a * strength), widget.highlightRadius),
              child: out,
            );
          }
        }
        return out;
      },
    );
  }
}

class _BorderPainter extends CustomPainter {
  final Color color;
  final BorderRadius radius;
  const _BorderPainter(this.color, this.radius);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2
      ..color = color;
    canvas.drawRRect(radius.toRRect(Offset.zero & size).deflate(1), paint);
  }

  @override
  bool shouldRepaint(_BorderPainter old) => old.color != color || old.radius != radius;
}
