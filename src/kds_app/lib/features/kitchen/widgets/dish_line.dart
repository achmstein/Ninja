import 'package:flutter/widgets.dart';
import 'package:forui/forui.dart';
import '../../../core/motion/motion.dart';
import '../../../core/theme/app_theme.dart';

/// The dishes the cook has ticked off on this screen, as `order:line`.
/// A working aid on this display only: nothing is sent, and Ready is still
/// what moves an order along.
final dishTicks = ValueNotifier<Set<String>>(<String>{});

String dishKey(int orderNumber, int index) => '$orderNumber:$index';

void toggleDish(String key) {
  final next = {...dishTicks.value};
  if (!next.remove(key)) next.add(key);
  dishTicks.value = next;
}

/// One dish on a kitchen ticket that can be ticked off: a tap draws a line
/// through its name, in reading order, and turns the round check at the
/// end into a filled tick. Tapped again, it comes back.
class DishLine extends StatelessWidget {
  final int orderNumber;
  final int index;
  final String units;
  final String name;
  final TextStyle unitsStyle;
  final TextStyle nameStyle;

  /// What sits under the name: modifiers, special instructions
  final List<Widget> details;

  /// False on a card that is not being worked (the history)
  final bool enabled;

  const DishLine({
    super.key,
    required this.orderNumber,
    required this.index,
    required this.units,
    required this.name,
    required this.unitsStyle,
    required this.nameStyle,
    this.details = const [],
    this.enabled = true,
  });

  @override
  Widget build(BuildContext context) {
    final key = dishKey(orderNumber, index);
    return ValueListenableBuilder<Set<String>>(
      valueListenable: dishTicks,
      builder: (context, ticks, _) {
        final done = enabled && ticks.contains(key);
        return GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: enabled ? () => toggleDish(key) : null,
          child: Semantics(
            checked: enabled ? done : null,
            child: Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(width: 28, child: Text(units, style: unitsStyle)),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        StrikeText(name, style: nameStyle, struck: done),
                        ...details,
                      ],
                    ),
                  ),
                  if (enabled) ...[const SizedBox(width: 8), DishCheck(done: done)],
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

/// Text with a line that draws itself through it when [struck], line by
/// line in reading order, while the ink fades to muted
class StrikeText extends StatefulWidget {
  final String text;
  final TextStyle style;
  final bool struck;

  const StrikeText(this.text, {super.key, required this.style, required this.struck});

  @override
  State<StrikeText> createState() => _StrikeTextState();
}

class _StrikeTextState extends State<StrikeText> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController(vsync: this, duration: Motion.base, value: widget.struck ? 1 : 0);

  @override
  void didUpdateWidget(StrikeText old) {
    super.didUpdateWidget(old);
    if (old.struck == widget.struck) return;
    if (reduceMotion(context)) {
      _c.value = widget.struck ? 1 : 0;
    } else if (widget.struck) {
      _c.animateTo(1, curve: Motion.move);
    } else {
      _c.animateBack(0, duration: Motion.fast, curve: Motion.exit);
    }
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final muted = context.theme.colors.mutedForeground;
    final ink = widget.style.color ?? context.theme.colors.foreground;
    return AnimatedBuilder(
      animation: _c,
      builder: (context, _) {
        final style = widget.style.copyWith(color: Color.lerp(ink, muted, _c.value.clamp(0.0, 1.0)));
        return CustomPaint(
          foregroundPainter: _c.value > 0
              ? _StrikePainter(
                  text: widget.text,
                  style: style,
                  progress: _c.value,
                  direction: Directionality.of(context),
                  scaler: MediaQuery.maybeTextScalerOf(context) ?? TextScaler.noScaling,
                  color: muted,
                )
              : null,
          child: Text(widget.text, style: style),
        );
      },
    );
  }
}

class _StrikePainter extends CustomPainter {
  final String text;
  final TextStyle style;
  final double progress;
  final TextDirection direction;
  final TextScaler scaler;
  final Color color;

  const _StrikePainter({required this.text, required this.style, required this.progress, required this.direction, required this.scaler, required this.color});

  @override
  void paint(Canvas canvas, Size size) {
    final painter = TextPainter(
      text: TextSpan(text: text, style: style),
      textDirection: direction,
      textScaler: scaler,
    )..layout(maxWidth: size.width);
    final lines = painter.computeLineMetrics();
    painter.dispose();
    final total = lines.fold<double>(0, (sum, line) => sum + line.width);
    var left = total * progress.clamp(0.0, 1.0);
    final paint = Paint()
      ..color = color
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;
    for (final line in lines) {
      if (left <= 0) break;
      final length = left < line.width ? left : line.width;
      left -= length;
      // Through the middle of the lowercase letters
      final y = line.baseline - line.ascent * 0.32;
      final (x0, x1) = direction == TextDirection.rtl ? (line.left + line.width, line.left + line.width - length) : (line.left, line.left + length);
      canvas.drawLine(Offset(x0, y), Offset(x1, y), paint);
    }
  }

  @override
  bool shouldRepaint(_StrikePainter old) =>
      old.progress != progress || old.text != text || old.style != style || old.direction != direction || old.color != color;
}

/// The round check at the end of a dish: an empty ring that fills and
/// draws its tick when the dish is done
class DishCheck extends StatefulWidget {
  final bool done;
  const DishCheck({super.key, required this.done});

  @override
  State<DishCheck> createState() => _DishCheckState();
}

class _DishCheckState extends State<DishCheck> with SingleTickerProviderStateMixin {
  late final AnimationController _tick = AnimationController(vsync: this, duration: Motion.base, value: widget.done ? 1 : 0);

  @override
  void didUpdateWidget(DishCheck old) {
    super.didUpdateWidget(old);
    if (old.done == widget.done) return;
    if (widget.done && !reduceMotion(context)) {
      _tick.forward(from: 0);
    } else {
      _tick.value = widget.done ? 1 : 0;
    }
  }

  @override
  void dispose() {
    _tick.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = context.theme.colors;
    final green = AppColors.emerald(colors.brightness);
    return AnimatedContainer(
      duration: Motion.fast,
      curve: Motion.enter,
      width: 24,
      height: 24,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color: widget.done ? green : green.withValues(alpha: 0),
        border: Border.all(color: widget.done ? green : colors.border, width: 1.5),
      ),
      child: CustomPaint(painter: TickPainter(_tick, const Color(0xFFFFFFFF), strokeWidth: 2.2)),
    );
  }
}
