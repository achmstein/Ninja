import 'dart:math' as math;
import 'package:flutter/gestures.dart' show kLongPressTimeout;
import 'package:flutter/material.dart';
import '../../../core/motion/motion.dart';
import '../../../core/ui/ui.dart';

/// A held press's ring for everything under it: the press that starts it may
/// sit in one place (a row's text) and the ring show in another (its photo,
/// its button), so the two meet here. A [HoldPress] with no scope round it
/// makes its own.
class HoldScope extends StatefulWidget {
  final Widget child;

  const HoldScope({super.key, required this.child});

  static HoldScopeState? maybeOf(BuildContext context) => context.dependOnInheritedWidgetOfExactType<_HoldScopeData>()?.state;

  @override
  State<HoldScope> createState() => HoldScopeState();
}

class HoldScopeState extends State<HoldScope> with SingleTickerProviderStateMixin {
  // Made on the first press: a long menu of dishes keeps no ticker each until one is held
  AnimationController? _ring;
  bool pressing = false;

  /// Fills from the finger going down to the long press landing
  Animation<double> get ring => _ring ?? kAlwaysDismissedAnimation;

  void down() {
    setState(() => pressing = true);
    (_ring ??= AnimationController(vsync: this, duration: kLongPressTimeout)).forward(from: 0);
  }

  void up() {
    if (!mounted) return;
    setState(() => pressing = false);
    _ring?.reset();
  }

  @override
  void dispose() {
    _ring?.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => _HoldScopeData(state: this, pressing: pressing, child: widget.child);
}

class _HoldScopeData extends InheritedWidget {
  final HoldScopeState state;
  final bool pressing;

  const _HoldScopeData({required this.state, required this.pressing, required super.child});

  @override
  bool updateShouldNotify(_HoldScopeData old) => old.pressing != pressing;
}

/// A dish's press the deck's way: it gives a little as the finger goes down,
/// the ring starts filling at once, a tap opens it and the full ring is the
/// long press
class HoldPress extends StatelessWidget {
  final VoidCallback onTap;
  final VoidCallback onLongPress;
  final double scale;
  final Widget child;

  const HoldPress({super.key, required this.onTap, required this.onLongPress, this.scale = 0.98, required this.child});

  @override
  Widget build(BuildContext context) {
    final press = _HoldGesture(onTap: onTap, onLongPress: onLongPress, scale: scale, child: child);
    return HoldScope.maybeOf(context) == null ? HoldScope(child: press) : press;
  }
}

class _HoldGesture extends StatelessWidget {
  final VoidCallback onTap;
  final VoidCallback onLongPress;
  final double scale;
  final Widget child;

  const _HoldGesture({required this.onTap, required this.onLongPress, required this.scale, required this.child});

  @override
  Widget build(BuildContext context) {
    final hold = HoldScope.maybeOf(context)!;
    return Semantics(
      button: true,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTapDown: (_) => hold.down(),
        onTapUp: (_) => hold.up(),
        onTapCancel: hold.up,
        onTap: onTap,
        onLongPressStart: (_) => hold.down(),
        onLongPress: () {
          hold.up();
          onLongPress();
        },
        onLongPressCancel: hold.up,
        child: AnimatedScale(
          scale: hold.pressing && !reduceMotion(context) ? scale : 1,
          duration: Motion.fast,
          curve: Motion.enter,
          child: child,
        ),
      ),
    );
  }
}

/// The ring of the [HoldScope] above it, shown only while the press is held
class HoldRing extends StatelessWidget {
  final double size;

  const HoldRing({super.key, this.size = PressRing.size});

  @override
  Widget build(BuildContext context) {
    final hold = HoldScope.maybeOf(context);
    if (hold == null) return const SizedBox.shrink();
    // Built only while held: at rest a dish carries nothing of it
    return IgnorePointer(
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 150),
        child: hold.pressing ? PressRing(progress: hold.ring, size: size) : const SizedBox.shrink(),
      ),
    );
  }
}

/// A ring that fills round a plus while a press is held, full as the long press lands
class PressRing extends StatelessWidget {
  static const size = 44.0;

  final Animation<double> progress;
  final double diameter;

  const PressRing({super.key, required this.progress, double size = PressRing.size}) : diameter = size;

  @override
  Widget build(BuildContext context) => Container(
    width: diameter,
    height: diameter,
    decoration: const BoxDecoration(color: Color(0x73000000), shape: BoxShape.circle),
    child: AnimatedBuilder(
      animation: progress,
      builder: (context, _) => CustomPaint(
        painter: _RingPainter(progress.value),
        child: Icon(LucideIcons.plus, size: diameter * 0.45, color: Colors.white),
      ),
    ),
  );
}

class _RingPainter extends CustomPainter {
  final double t;

  _RingPainter(this.t);

  @override
  void paint(Canvas canvas, Size size) {
    if (t <= 0) return;
    final rect = Rect.fromCircle(center: size.center(Offset.zero), radius: size.width / 2 - 4);
    canvas.drawArc(
      rect,
      -math.pi / 2,
      2 * math.pi * t,
      false,
      Paint()
        ..color = Colors.white
        ..style = PaintingStyle.stroke
        ..strokeWidth = 3
        ..strokeCap = StrokeCap.round,
    );
  }

  @override
  bool shouldRepaint(_RingPainter old) => old.t != t;
}
