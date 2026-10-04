import 'dart:math' as math;
import 'dart:ui' show ImageFilter;
import 'package:flutter/material.dart' show CircularProgressIndicator;
import 'package:flutter/physics.dart';
import 'package:flutter/widgets.dart';
import 'package:forui/forui.dart';
import 'motion.dart';

/// Where a [MorphButton] is in its one action.
enum MorphPhase {
  /// Waiting to be pressed
  idle,

  /// Pressed; the work is in flight
  busy,

  /// It worked: a tick in a circle
  success,

  /// After the tick, what came of it ("Receipt #1234") as a chip
  done,

  /// It did not work: one small shake, then idle again
  error,
}

/// One button that becomes each step of its action instead of being
/// swapped for other widgets: the full-width button draws itself in to a
/// spinner pill, closes to a circle with a tick, and opens out to a chip
/// saying what came of it. Width rides [Motion.spring]; colour and corners
/// ease; the content cross-fades through a short blur. An error shakes it
/// twice, in under 200 ms, and it is a button again.
///
/// [solid] is the idle look: a filled button, or an outline one that fills
/// the moment it can be pressed.
class MorphButton extends StatefulWidget {
  final MorphPhase phase;
  final Widget label;
  final VoidCallback? onPressed;
  final bool solid;

  /// The chip after the tick; without it the tick is the last step
  final String? doneLabel;
  final IconData? doneIcon;
  final double height;
  final double radius;
  final Color? color;
  final Color? onColor;
  final Color successColor;
  final Color onSuccessColor;
  final TextStyle? labelStyle;
  final String? semanticsLabel;

  const MorphButton({
    super.key,
    required this.phase,
    required this.label,
    required this.onPressed,
    this.solid = true,
    this.doneLabel,
    this.doneIcon,
    this.height = 56,
    this.radius = 10,
    this.color,
    this.onColor,
    this.successColor = const Color(0xFF059669),
    this.onSuccessColor = const Color(0xFFFFFFFF),
    this.labelStyle,
    this.semanticsLabel,
  });

  @override
  State<MorphButton> createState() => _MorphButtonState();
}

class _MorphButtonState extends State<MorphButton> with TickerProviderStateMixin {
  // The width, in pixels, while it changes shape
  late final AnimationController _width = AnimationController.unbounded(vsync: this);
  late final AnimationController _shake = AnimationController(vsync: this, duration: const Duration(milliseconds: 200));
  double _maxWidth = 0;
  bool _pressed = false;

  bool get _enabled => widget.onPressed != null && (widget.phase == MorphPhase.idle || widget.phase == MorphPhase.error);

  @override
  void dispose() {
    _width.dispose();
    _shake.dispose();
    super.dispose();
  }

  TextStyle _doneStyle(BuildContext context) =>
      DefaultTextStyle.of(context).style.merge(widget.labelStyle).copyWith(color: widget.onSuccessColor);

  double _targetWidth(BuildContext context, double maxWidth, MorphPhase phase) {
    final h = widget.height;
    return switch (phase) {
      MorphPhase.idle || MorphPhase.error => maxWidth,
      MorphPhase.busy => math.min(maxWidth, h * 1.6),
      MorphPhase.success => math.min(maxWidth, h),
      MorphPhase.done => widget.doneLabel == null ? math.min(maxWidth, h) : math.min(maxWidth, _chipWidth(context)),
    };
  }

  double _chipWidth(BuildContext context) {
    final painter = TextPainter(
      text: TextSpan(text: widget.doneLabel, style: _doneStyle(context)),
      textDirection: Directionality.of(context),
      textScaler: MediaQuery.maybeTextScalerOf(context) ?? TextScaler.noScaling,
      maxLines: 1,
    )..layout();
    final width = painter.width + 48 + (widget.doneIcon != null ? 26 : 0);
    painter.dispose();
    return width;
  }

  @override
  void didUpdateWidget(MorphButton old) {
    super.didUpdateWidget(old);
    if (old.phase == widget.phase || _maxWidth == 0) return;
    final reduce = reduceMotion(context);
    final from = _width.isAnimating ? _width.value : _targetWidth(context, _maxWidth, old.phase);
    final to = _targetWidth(context, _maxWidth, widget.phase);
    if (reduce) {
      _width.value = to;
    } else {
      _width.value = from;
      _width.animateWith(SpringSimulation(Motion.spring, from, to, _width.velocity, tolerance: Motion.pixelTolerance));
    }
    if (widget.phase == MorphPhase.error && !reduce) _shake.forward(from: 0);
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.theme.colors;
    final reduce = reduceMotion(context);
    final phase = widget.phase;
    final primary = widget.color ?? colors.primary;
    final onPrimary = widget.onColor ?? colors.primaryForeground;
    final h = widget.height;

    final (Color fill, Color border, Color ink) = switch (phase) {
      MorphPhase.idle || MorphPhase.error => widget.solid
          ? (primary, primary, onPrimary)
          : (primary.withValues(alpha: 0), colors.border, colors.mutedForeground),
      MorphPhase.busy => (primary, primary, onPrimary),
      MorphPhase.success || MorphPhase.done => (widget.successColor, widget.successColor, widget.onSuccessColor),
    };
    final round = phase != MorphPhase.idle && phase != MorphPhase.error;
    final decoration = BoxDecoration(
      color: fill,
      border: Border.all(color: border),
      borderRadius: BorderRadius.circular(round ? h / 2 : widget.radius),
    );

    final content = switch (phase) {
      MorphPhase.idle || MorphPhase.error => DefaultTextStyle.merge(
          style: (widget.labelStyle ?? const TextStyle()).copyWith(color: ink),
          maxLines: 1,
          child: IconTheme.merge(data: IconThemeData(color: ink), child: widget.label),
        ),
      MorphPhase.busy => SizedBox.square(
          dimension: 20,
          child: CircularProgressIndicator(strokeWidth: 2.2, color: ink),
        ),
      MorphPhase.success => _Tick(color: ink, animate: !reduce),
      MorphPhase.done => widget.doneLabel == null
          ? _Tick(color: ink, animate: false)
          : Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (widget.doneIcon != null) ...[
                  Icon(widget.doneIcon, size: 18, color: ink),
                  const SizedBox(width: 8),
                ],
                Text(widget.doneLabel!, maxLines: 1, style: _doneStyle(context)),
              ],
            ),
    };

    return LayoutBuilder(
      builder: (context, constraints) {
        _maxWidth = constraints.maxWidth.isFinite ? constraints.maxWidth : 320;
        final target = _targetWidth(context, _maxWidth, phase);

        Widget shape = TweenAnimationBuilder<Decoration>(
          tween: DecorationTween(end: decoration),
          duration: reduce ? Motion.fast : Motion.base,
          curve: Motion.enter,
          builder: (context, value, child) => DecoratedBox(decoration: value, child: child),
          child: ClipRect(
            child: OverflowBox(
              maxWidth: double.infinity,
              child: AnimatedSwitcher(
                duration: reduce ? Motion.fast : Motion.base,
                switchInCurve: Motion.enter,
                switchOutCurve: Motion.exit,
                transitionBuilder: (child, animation) => reduce
                    ? FadeTransition(opacity: animation, child: child)
                    : _BlurSwap(animation: animation, child: child),
                layoutBuilder: (current, previous) =>
                    Stack(alignment: Alignment.center, children: [...previous, ?current]),
                child: KeyedSubtree(
                  key: ValueKey(phase == MorphPhase.error ? MorphPhase.idle : phase),
                  child: Padding(padding: const EdgeInsets.symmetric(horizontal: 16), child: content),
                ),
              ),
            ),
          ),
        );

        shape = AnimatedBuilder(
          animation: Listenable.merge([_width, _shake]),
          child: shape,
          builder: (context, child) {
            // The spring while it runs; exactly the target once it rests
            final w = _width.isAnimating ? _width.value.clamp(0.0, _maxWidth) : target;
            final shake = _shake.isAnimating ? math.sin(_shake.value * math.pi * 4) * 6 * (1 - _shake.value) : 0.0;
            return Transform.translate(
              offset: Offset(shake, 0),
              child: Center(child: SizedBox(width: w, height: h, child: child)),
            );
          },
        );

        return Semantics(
          button: true,
          enabled: _enabled,
          label: widget.semanticsLabel,
          liveRegion: phase == MorphPhase.done,
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTapDown: _enabled ? (_) => setState(() => _pressed = true) : null,
            onTapCancel: _enabled ? () => setState(() => _pressed = false) : null,
            onTapUp: _enabled ? (_) => setState(() => _pressed = false) : null,
            onTap: _enabled ? widget.onPressed : null,
            child: AnimatedScale(
              scale: _pressed && !reduce ? 0.97 : 1,
              duration: Motion.fast,
              curve: Motion.enter,
              child: SizedBox(height: h, child: shape),
            ),
          ),
        );
      },
    );
  }
}

/// A cross-fade that also comes into focus: the incoming content sharpens
/// from a small blur and a 92 % scale, the outgoing one goes the other way
class _BlurSwap extends StatelessWidget {
  final Animation<double> animation;
  final Widget child;
  const _BlurSwap({required this.animation, required this.child});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: animation,
      child: child,
      builder: (context, child) {
        final t = animation.value.clamp(0.0, 1.0);
        final sigma = (1 - t) * 4;
        Widget out = Opacity(opacity: t, child: Transform.scale(scale: 0.92 + 0.08 * t, child: child));
        if (sigma > 0.05) {
          out = ImageFiltered(imageFilter: ImageFilter.blur(sigmaX: sigma, sigmaY: sigma), child: out);
        }
        return out;
      },
    );
  }
}

/// A tick drawn in one stroke
class _Tick extends StatefulWidget {
  final Color color;
  final bool animate;
  const _Tick({required this.color, required this.animate});

  @override
  State<_Tick> createState() => _TickState();
}

class _TickState extends State<_Tick> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: Motion.slow, value: widget.animate ? 0 : 1);

  @override
  void initState() {
    super.initState();
    if (widget.animate) _c.forward();
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => SizedBox.square(
        dimension: 24,
        child: CustomPaint(painter: TickPainter(_c, widget.color)),
      );
}

/// The tick, drawn up to the animation's value; shared with other ticks
/// that should look the same (the kitchen's dish check)
class TickPainter extends CustomPainter {
  final Animation<double> progress;
  final Color color;
  final double strokeWidth;
  TickPainter(this.progress, this.color, {this.strokeWidth = 2.6}) : super(repaint: progress);

  @override
  void paint(Canvas canvas, Size size) {
    final t = Motion.enter.transform(progress.value.clamp(0.0, 1.0));
    if (t <= 0) return;
    final s = size.width;
    final path = Path()
      ..moveTo(s * 0.2, s * 0.53)
      ..lineTo(s * 0.42, s * 0.74)
      ..lineTo(s * 0.8, s * 0.3);
    final metric = path.computeMetrics().first;
    canvas.drawPath(
      metric.extractPath(0, metric.length * t),
      Paint()
        ..color = color
        ..style = PaintingStyle.stroke
        ..strokeWidth = strokeWidth
        ..strokeCap = StrokeCap.round
        ..strokeJoin = StrokeJoin.round,
    );
  }

  @override
  bool shouldRepaint(TickPainter old) => old.color != color || old.progress != progress;
}
