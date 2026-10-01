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

/// The room kept at the side for the neighbour: a 12 gap and an 18 sliver of it
const _peekRoom = 30.0;
const _peekGap = 12.0;

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
              // The bill in view, and a sliver of its neighbour at the side: the next one, or on the last the
              // one before it. Enough to say there is more and which way, not enough to read
              child: LayoutBuilder(
                builder: (context, row) => Stack(
                  children: [
                    Padding(
                      padding: EdgeInsetsDirectional.only(start: index == cards.length - 1 ? _peekRoom : 0, end: index == cards.length - 1 ? 0 : _peekRoom),
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
                    _Peek(
                      atEnd: index < cards.length - 1,
                      width: row.maxWidth - _peekRoom,
                      onTap: () => _go(index < cards.length - 1 ? index + 1 : index - 1),
                      child: cards[index < cards.length - 1 ? index + 1 : index - 1],
                    ),
                  ],
                ),
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

/// The neighbour's edge, beside the bill in view: the side of it nearest the bill, as tall as the bill
/// in view at most, and a tap away
class _Peek extends StatelessWidget {
  /// The next bill, at the end; else the one before, at the start
  final bool atEnd;

  /// The bills' own width, the one in view's: the neighbour is laid out at it and then cut
  final double width;
  final VoidCallback onTap;
  final Widget child;

  const _Peek({required this.atEnd, required this.width, required this.onTap, required this.child});

  @override
  Widget build(BuildContext context) {
    return PositionedDirectional(
      top: 0,
      bottom: 0,
      start: atEnd ? null : 0,
      end: atEnd ? 0 : null,
      width: _peekRoom - _peekGap,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: LayoutBuilder(
          builder: (context, box) {
            // Laid out at the bill's own width, then cut to the sliver of it nearest the one in view
            final full = MediaQuery.sizeOf(context).width;
            return ClipRect(
              child: OverflowBox(
                alignment: atEnd ? AlignmentDirectional.topStart : AlignmentDirectional.topEnd,
                minWidth: 0,
                maxWidth: full,
                maxHeight: double.infinity,
                child: IgnorePointer(
                  child: SizedBox(width: full, child: child),
                ),
              ),
            );
          },
        ),
      ),
    );
  }
}
