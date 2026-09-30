import '../models/cart_item.dart';

/// What the docked tray shows: the latest lines' photos, how many more there
/// are, and the running count and total (client_web's tray-model.ts)
class TraySummary {
  /// The newest first, so the dish that just went in sits at the front
  final List<CartItem> thumbs;

  /// Lines not shown as a photo
  final int more;
  final int count;
  final double total;

  const TraySummary({required this.thumbs, required this.more, required this.count, required this.total});
}

/// Two photos fit beside the total and the order button on the narrowest phone; the rest are a count
const trayThumbs = 2;

TraySummary traySummary(List<CartItem> lines, {int max = trayThumbs}) {
  final newest = lines.reversed.toList();
  return TraySummary(
    thumbs: newest.take(max).toList(),
    more: newest.length > max ? newest.length - max : 0,
    count: lines.fold(0, (sum, line) => sum + line.quantity),
    total: lines.fold(0.0, (sum, line) => sum + line.totalPrice),
  );
}

/// A line swiped sideways this far (a share of its width), or flicked fast enough, is removed
const swipeRemoveShare = 0.4;
const swipeRemoveVelocity = 600.0;

/// The tray opens when dragged up far enough or flicked up, and closes the same way down
const trayDragDistance = 60.0;
const trayDragVelocity = 400.0;

bool trayOpensAfterDrag(bool expanded, double offsetY, double velocityY) {
  if (!expanded) return offsetY <= -trayDragDistance || velocityY <= -trayDragVelocity;
  return !(offsetY >= trayDragDistance || velocityY >= trayDragVelocity);
}

/// The dock's measures (client_web's components/ninja/shell/chrome.ts): a
/// short screen draws every piece a little smaller rather than losing any
class DockMetrics {
  /// The tray's row, and the bill's
  final double row;

  /// The tabs' row, and the pill lifting the active one
  final double tabs;
  final double pill;

  const DockMetrics._(this.row, this.tabs, this.pill);

  static const regular = DockMetrics._(68, 56, 44);
  static const short = DockMetrics._(58, 48, 38);

  /// A screen this short draws the dock compact
  static const shortBelow = 740.0;

  static DockMetrics of(double screenHeight) => screenHeight < shortBelow ? short : regular;

  /// The dock's gap to the screen's edges
  static const inset = 8.0;

  /// How far the order sheet reaches down into the dock: it rises from inside it
  static const tuck = 28.0;
}
