import 'package:flutter/material.dart';

import '../../../core/motion/motion.dart';
import '../../../core/ui/ui.dart';

/// Two bills or more, one at a time (client_web's open-bills.tsx `Swipe`):
/// a finger swipes between them, the dots under them say which is in view
/// and step to one. The row is as tall as the bill in view, not the tallest
/// one, and eases to the next one's height as it comes in.
class BillSwipe extends StatefulWidget {
  final List<Widget> children;

  const BillSwipe({super.key, required this.children});

  @override
  State<BillSwipe> createState() => _BillSwipeState();
}

class _BillSwipeState extends State<BillSwipe> {
  int _index = 0;

  /// Which way the last step went, for the side the next bill comes in from
  int _step = 1;

  void _go(int to) {
    if (to < 0 || to >= widget.children.length || to == _index) return;
    setState(() {
      _step = to > _index ? 1 : -1;
      _index = to;
    });
  }

  @override
  Widget build(BuildContext context) {
    final cards = widget.children;
    if (cards.length < 2) return Column(crossAxisAlignment: CrossAxisAlignment.stretch, children: cards);
    final index = _index.clamp(0, cards.length - 1);
    final c = context.theme.colors;
    final rtl = Directionality.of(context) == TextDirection.rtl;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        GestureDetector(
          // A swipe towards the start brings the next bill in, as a scroll would
          onHorizontalDragEnd: (details) {
            final v = details.primaryVelocity ?? 0;
            if (v.abs() < 200) return;
            final forward = rtl ? v > 0 : v < 0;
            _go(index + (forward ? 1 : -1));
          },
          child: ClipRect(
            child: AnimatedSize(
              duration: Motion.slow,
              curve: Motion.enter,
              alignment: Alignment.topCenter,
              child: AnimatedSwitcher(
                duration: Motion.slow,
                switchInCurve: Motion.enter,
                switchOutCurve: Motion.exit,
                layoutBuilder: (current, previous) => Stack(alignment: Alignment.topCenter, children: [...previous, ?current]),
                transitionBuilder: (child, animation) {
                  final incoming = child.key == ValueKey(index);
                  final dx = (incoming ? 1.0 : -1.0) * _step * (rtl ? -1 : 1);
                  return FadeTransition(
                    opacity: animation,
                    child: SlideTransition(
                      position: Tween(begin: Offset(dx * 0.3, 0), end: Offset.zero).animate(animation),
                      child: child,
                    ),
                  );
                },
                child: KeyedSubtree(key: ValueKey(index), child: cards[index]),
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            for (var i = 0; i < cards.length; i++)
              GestureDetector(
                behavior: HitTestBehavior.opaque,
                onTap: () => _go(i),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 3, vertical: 6),
                  child: AnimatedContainer(
                    duration: Motion.base,
                    width: i == index ? 16 : 6,
                    height: 6,
                    decoration: BoxDecoration(
                      color: c.foreground.withValues(alpha: i == index ? 1 : 0.25),
                      borderRadius: BorderRadius.circular(3),
                    ),
                  ),
                ),
              ),
          ],
        ),
      ],
    );
  }
}
