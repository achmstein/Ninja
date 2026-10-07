import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

/// How far from the top a scroll down starts to tuck: the top bar's worth, so a nudge does not
const tuckAfter = 64.0;

/// How far a scroll must run one way before the dock follows it: a finger's jitter does not
const tuckSlack = 12.0;

/// How long the dock takes to fold or grow, during which its own effect on the scroll is ignored
const tuckSettle = Duration(milliseconds: 300);

/// The tuck a scroll to [y] (of [max]) makes, given where the last turn
/// began and the tuck till now (client_web's use-tuck.ts `tuckAt`)
({bool tucked, double from}) tuckAt(double y, double max, double from, bool tucked) {
  // At the top, or at the end (nothing more to read), the dock is whole
  if (y <= tuckAfter || y >= max - 2) return (tucked: false, from: y);
  // The anchor follows the scroll in the way the dock already agrees with
  if (tucked ? y > from : y < from) return (tucked: tucked, from: y);
  if ((y - from).abs() < tuckSlack) return (tucked: tucked, from: from);
  return (tucked: !tucked, from: y);
}

/// The dock tucked away while the customer reads on: scrolling down folds
/// the tabs (the tray or the bill's row staying, as what can be acted on
/// now), and the dock goes whole again on scrolling back up, or at the
/// page's end. One flag for the whole app.
class DockTuck extends Notifier<bool> {
  @override
  bool build() => false;

  void set(bool tucked) {
    if (state != tucked) state = tucked;
  }
}

final dockTuckProvider = NotifierProvider<DockTuck, bool>(DockTuck.new);

/// Tucks the dock as the page under it scrolls, from the page's own scroll
/// notifications, so every tab gets it without doing anything. [enabled]
/// off keeps the dock whole (an open order).
class TuckOnScroll extends ConsumerStatefulWidget {
  final Widget child;
  final bool enabled;

  const TuckOnScroll({super.key, required this.child, this.enabled = true});

  @override
  ConsumerState<TuckOnScroll> createState() => _TuckOnScrollState();
}

class _TuckOnScrollState extends ConsumerState<TuckOnScroll> {
  double _from = 0;
  DateTime _quietUntil = DateTime.fromMillisecondsSinceEpoch(0);

  /// Whether the page was last read at its end (client_web's use-tuck.ts `atEnd`)
  bool _atEnd = false;

  /// The tabs coming back at the end make the page's room under the dock grow (or, on the menu, its
  /// list shorter): read at its end, the page stays at its end, so the last card or dish and its price
  /// are not left under the dock
  bool _onMetrics(ScrollMetricsNotification n) {
    if (n.depth != 0 || n.metrics.axis != Axis.vertical) return false;
    if (!_atEnd || n.metrics.pixels >= n.metrics.maxScrollExtent - 0.5) return false;
    final position = Scrollable.maybeOf(n.context)?.position;
    if (position == null) return false;
    _quietUntil = DateTime.now().add(tuckSettle);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (position.hasPixels && position.pixels < position.maxScrollExtent) position.jumpTo(position.maxScrollExtent);
    });
    return false;
  }

  @override
  void didUpdateWidget(TuckOnScroll old) {
    super.didUpdateWidget(old);
    if (!widget.enabled && old.enabled) ref.read(dockTuckProvider.notifier).set(false);
  }

  bool _onScroll(ScrollNotification n) {
    if (!widget.enabled || n.metrics.axis != Axis.vertical) return false;
    final y = n.metrics.pixels;
    final max = n.metrics.maxScrollExtent;
    if (n.depth == 0) _atEnd = max > 0 && y >= max - 2;
    final tuck = ref.read(dockTuckProvider.notifier);
    final tucked = ref.read(dockTuckProvider);
    // Come to rest at the top or the end: the dock is whole again
    if (n is ScrollEndNotification) {
      if ((y <= tuckAfter || y >= max - 2) && tucked) {
        _from = y;
        tuck.set(false);
      }
      return false;
    }
    if (n is! ScrollUpdateNotification) return false;
    // The dock folding can move the page under it; that scroll is not the customer's
    if (DateTime.now().isBefore(_quietUntil)) {
      _from = y;
      return false;
    }
    final next = tuckAt(y, max, _from, tucked);
    _from = next.from;
    if (next.tucked != tucked) {
      _quietUntil = DateTime.now().add(tuckSettle);
      tuck.set(next.tucked);
    }
    return false;
  }

  @override
  Widget build(BuildContext context) => NotificationListener<ScrollMetricsNotification>(
        onNotification: _onMetrics,
        child: NotificationListener<ScrollNotification>(onNotification: _onScroll, child: widget.child),
      );
}
