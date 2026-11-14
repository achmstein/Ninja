import 'dart:async';

/// The orders this till rang up itself, so it can stay quiet about them: the
/// cashier just pressed the button, and a "new order" alert about their own
/// sale is noise that teaches them to ignore the ones that matter. Other tills
/// still hear of it. The same rule as pos_web's lib/own-orders.ts.
///
/// The news of an order can arrive before the answer to the call that made it,
/// so asking "is this one mine?" waits for any sale still on its way out.
class OwnOrders {
  OwnOrders({this.wait = const Duration(seconds: 5)});

  /// How long the news waits for a sale in flight before it is taken as someone else's
  final Duration wait;

  /// Old numbers are let go: nothing asks about an order from hours ago
  static const _keep = 200;

  final _own = <int>{};
  int _placing = 0;
  Completer<void>? _settled;

  /// Runs a sale and remembers the order it made as this till's
  Future<int> placing(Future<int> Function() send) async {
    _placing++;
    try {
      final orderId = await send();
      if (orderId > 0) {
        _own.add(orderId);
        if (_own.length > _keep) _own.remove(_own.first);
      }
      return orderId;
    } finally {
      _placing--;
      if (_placing == 0) {
        _settled?.complete();
        _settled = null;
      }
    }
  }

  /// Whether this till rang the order up, once any sale still in flight has answered
  Future<bool> isOwn(int orderId) async {
    if (_own.contains(orderId)) return true;
    if (_placing == 0) return false;
    final settled = _settled ??= Completer<void>();
    await settled.future.timeout(wait, onTimeout: () {});
    return _own.contains(orderId);
  }
}

/// The till's one memory of its own orders
final ownOrders = OwnOrders();
