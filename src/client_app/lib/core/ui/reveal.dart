import 'package:flutter/material.dart';

import '../motion/motion.dart';

/// Something that has just slid open (a receipt printed out of its card, a
/// booking under its place): it comes in from just above, fading up, and
/// once its box has grown the page or sheet it is on scrolls to show all of
/// it, so it does not open below the edge or under the dock.
class Reveal extends StatefulWidget {
  final Widget child;

  /// How far it comes down from as it fades in, like paper out of a printer
  final double from;

  const Reveal({super.key, required this.child, this.from = -12});

  @override
  State<Reveal> createState() => _RevealState();
}

class _RevealState extends State<Reveal> with SingleTickerProviderStateMixin {
  late final AnimationController _in = AnimationController(vsync: this, duration: Motion.slow)..forward();

  @override
  void initState() {
    super.initState();
    // After the box around it has grown
    Future.delayed(Motion.slow, _bringIntoView);
  }

  /// As far as needed to show its end above the dock (the page's bottom padding is the dock),
  /// never so far that its own top leaves the view
  void _bringIntoView() {
    if (!mounted) return;
    final scrollable = Scrollable.maybeOf(context);
    final box = context.findRenderObject();
    final view = scrollable?.context.findRenderObject();
    if (scrollable == null || box is! RenderBox || view is! RenderBox || !box.attached || !view.attached) return;
    const room = 16.0;
    final dock = MediaQuery.paddingOf(context).bottom;
    final top = box.localToGlobal(Offset.zero).dy;
    final end = top + box.size.height;
    final viewTop = view.localToGlobal(Offset.zero).dy;
    final viewEnd = viewTop + view.size.height - dock - room;
    final by = (end - viewEnd).clamp(double.negativeInfinity, top - viewTop - room);
    if (by <= 0) return;
    final position = scrollable.position;
    final to = (position.pixels + by).clamp(position.minScrollExtent, position.maxScrollExtent);
    reduceMotion(context) ? position.jumpTo(to) : position.animateTo(to, duration: Motion.slow, curve: Motion.enter);
  }

  @override
  void dispose() {
    _in.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // What it holds may arrive after it opens (a receipt still loading) and grow: it is followed into view
    final child = NotificationListener<SizeChangedLayoutNotification>(
      onNotification: (_) {
        WidgetsBinding.instance.addPostFrameCallback((_) => _bringIntoView());
        return true;
      },
      child: SizeChangedLayoutNotifier(child: widget.child),
    );
    if (reduceMotion(context)) return child;
    return AnimatedBuilder(
      animation: _in,
      builder: (context, child) {
        final t = Motion.enter.transform(_in.value);
        return Opacity(opacity: t, child: Transform.translate(offset: Offset(0, widget.from * (1 - t)), child: child));
      },
      child: child,
    );
  }
}
