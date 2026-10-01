import 'package:flutter/gestures.dart';
import 'package:flutter/widgets.dart';

/// Which way two fingers went: closing (out to the whole menu) or opening (back in to the cards)
enum Pinch { close, open }

/// A two-finger pinch: closing to under this share of the start distance zooms out, opening past its inverse zooms in
const pinchOut = 0.78;

/// What a pinch from [startDistance] to [distance] apart asks for, if anything yet (client_web's deck-model.ts pinchIntent)
Pinch? pinchIntent(double startDistance, double distance) {
  if (startDistance <= 0) return null;
  final ratio = distance / startDistance;
  if (ratio <= pinchOut) return Pinch.close;
  if (ratio >= 1 / pinchOut) return Pinch.open;
  return null;
}

/// Watches [child] for two fingers pinching one way ([watch]) and calls
/// [onPinch] once a pinch gets there, once per pinch. It only listens: the
/// fingers still scroll what is under them (the deck's swipes, the menu's
/// scroll), as the web's passive touch listeners do. A trackpad's pinch
/// counts too.
class PinchWatch extends StatefulWidget {
  final Pinch watch;
  final VoidCallback onPinch;
  final Widget child;

  const PinchWatch({super.key, required this.watch, required this.onPinch, required this.child});

  @override
  State<PinchWatch> createState() => _PinchWatchState();
}

class _PinchWatchState extends State<PinchWatch> {
  final _points = <int, Offset>{};
  double _start = 0;
  bool _done = false;

  double get _distance {
    final [a, b] = _points.values.toList();
    return (a - b).distance;
  }

  void _down(PointerDownEvent e) {
    if (e.kind == PointerDeviceKind.mouse) return;
    _points[e.pointer] = e.position;
    if (_points.length == 2) {
      _start = _distance;
      _done = false;
    } else {
      _start = 0;
    }
  }

  void _move(PointerMoveEvent e) {
    if (!_points.containsKey(e.pointer)) return;
    _points[e.pointer] = e.position;
    if (_points.length != 2 || _done || _start <= 0) return;
    _check(pinchIntent(_start, _distance));
  }

  void _up(PointerEvent e) {
    _points.remove(e.pointer);
    if (_points.length < 2) _start = 0;
  }

  void _check(Pinch? intent) {
    if (intent != widget.watch) return;
    _done = true;
    widget.onPinch();
  }

  @override
  Widget build(BuildContext context) => Listener(
    onPointerDown: _down,
    onPointerMove: _move,
    onPointerUp: _up,
    onPointerCancel: _up,
    onPointerPanZoomStart: (_) => _done = false,
    onPointerPanZoomUpdate: (e) {
      if (!_done) _check(pinchIntent(1, e.scale));
    },
    child: widget.child,
  );
}
