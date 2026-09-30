import 'package:flutter/physics.dart';
import 'package:flutter/widgets.dart';
import '../motion/motion.dart';

/// A row of equal slots with the active one lifted by a pill that slides
/// like liquid: moving on, its leading edge darts ahead on a quick spring
/// and its trailing edge follows on a slower one, so it stretches on the
/// way and settles back to the slot's width (client_web's LiquidPill and
/// use-liquid.ts). The dock's tabs and the segmented control use it.
class LiquidSlots extends StatefulWidget {
  final int count;
  final int active;
  final double pillHeight;
  final Decoration pill;

  /// Room at the row's ends, inside which the slots share the width
  final double inset;
  final Widget Function(BuildContext context, int index, bool active) builder;

  const LiquidSlots({
    super.key,
    required this.count,
    required this.active,
    required this.pillHeight,
    required this.pill,
    required this.builder,
    this.inset = 0,
  });

  @override
  State<LiquidSlots> createState() => _LiquidSlotsState();
}

class _LiquidSlotsState extends State<LiquidSlots> with TickerProviderStateMixin {
  // The pill's edges, in slots from the row's start: 0..count
  late final AnimationController _start = AnimationController.unbounded(vsync: this, value: widget.active.toDouble());
  late final AnimationController _end = AnimationController.unbounded(vsync: this, value: widget.active + 1.0);

  @override
  void didUpdateWidget(LiquidSlots old) {
    super.didUpdateWidget(old);
    if (old.active == widget.active && old.count == widget.count) return;
    final to = widget.active.toDouble();
    if (reduceMotion(context)) {
      _start.value = to;
      _end.value = to + 1;
      return;
    }
    // Moving towards the end, the end edge leads; towards the start, the start edge
    final forward = to > _start.value;
    _run(_start, to, forward ? Motion.pillTrail : Motion.pillLead);
    _run(_end, to + 1, forward ? Motion.pillLead : Motion.pillTrail);
  }

  void _run(AnimationController edge, double to, SpringDescription spring) {
    edge.animateWith(SpringSimulation(spring, edge.value, to, edge.velocity, tolerance: const Tolerance(distance: 0.002, velocity: 0.01)));
  }

  @override
  void dispose() {
    _start.dispose();
    _end.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final rtl = Directionality.of(context) == TextDirection.rtl;
    return LayoutBuilder(
      builder: (context, constraints) {
        final slot = (constraints.maxWidth - widget.inset * 2) / widget.count;
        return Stack(
          children: [
            AnimatedBuilder(
              animation: Listenable.merge([_start, _end]),
              builder: (context, _) {
                final from = widget.inset + _start.value * slot;
                final width = (_end.value - _start.value) * slot;
                return Positioned(
                  left: rtl ? null : from,
                  right: rtl ? from : null,
                  width: width.clamp(0, double.infinity),
                  top: 0,
                  bottom: 0,
                  child: Center(child: Container(height: widget.pillHeight, decoration: widget.pill)),
                );
              },
            ),
            Padding(
              padding: EdgeInsets.symmetric(horizontal: widget.inset),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  for (var i = 0; i < widget.count; i++) Expanded(child: widget.builder(context, i, i == widget.active)),
                ],
              ),
            ),
          ],
        );
      },
    );
  }
}
