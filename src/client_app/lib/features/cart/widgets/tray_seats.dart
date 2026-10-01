import 'dart:collection';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import '../../../core/motion/motion.dart';
import '../../../core/ui/ui.dart';
import '../models/cart_item.dart';
import 'tray.dart';

/// Where a dish's circle sits: its photo in the dock's stack, or on its row
/// in the open order
enum SeatKind { dock, row }

/// One circle on its way between the dock and its row
class _Seat {
  final CartItem item;
  final BuildContext row;
  final Rect from;

  /// Its own circle in the dock; the others come out from behind the stack
  final bool fromDock;

  const _Seat(this.item, this.row, this.from, {required this.fromDock});
}

/// The dishes' circles as the order opens (client_web's tray.tsx
/// `SeatFlights`): on the way up each leaves the dock and flies to its row,
/// on the way down it goes back, driven by how far the order is open, so they
/// follow a finger and come back the way they went. Only between shut and
/// open; at either end the real ones show. One for the app: the dock's
/// photos and the order's rows mark themselves here ([TraySeat]), and the
/// app's flight layer draws the circles ([TraySeatLayer]).
class TraySeats extends ChangeNotifier {
  TrayMotion? _motion;
  final _dock = LinkedHashMap<CartItem, (int, BuildContext)>.identity();
  final _rows = LinkedHashMap<CartItem, (int, BuildContext)>.identity();
  final _from = LinkedHashMap<CartItem, Rect>.identity();
  Rect? _stack;
  double _last = 0;
  int _layers = 0;

  /// The order's list, whose edges say which rows the open order shows
  final GlobalKey list = GlobalKey(debugLabel: 'tray-list');

  /// The order is fully open: the rows' own photos show, their circles having landed
  final ValueNotifier<bool> seated = ValueNotifier(false);

  TrayMotion? get motion => _motion;

  /// A layer draws the circles; with none (a test), each row shows its own photo throughout
  bool get flies => _layers > 0;

  void attach(TrayMotion motion) {
    _motion?.removeListener(_tick);
    _motion = motion;
    motion.addListener(_tick);
    _last = motion.value;
    seated.value = _last >= 0.999;
  }

  void detach(TrayMotion motion) {
    if (_motion != motion) return;
    motion.removeListener(_tick);
    _motion = null;
  }

  void _tick() {
    final v = _motion?.value ?? 0;
    // Leaving shut: the dock still has its photos where they stand at rest, so that is where each starts
    if (_last <= 0.001 && v > 0.001) _measureDock();
    _last = v;
    seated.value = v >= 0.999;
    notifyListeners();
  }

  void _measureDock() {
    _from.clear();
    _stack = null;
    var front = 1 << 30;
    for (final MapEntry(key: item, value: (index, context)) in _dock.entries) {
      final rect = _globalRect(context);
      if (rect == null) continue;
      _from[item] = rect;
      // The front of the stack stands in for the dishes without a photo of their own in the dock
      if (index < front) {
        front = index;
        _stack = rect;
      }
    }
  }

  /// The rows in the order's order, each with where its circle leaves from
  List<_Seat> _seats() {
    final rows = _rows.entries.toList()..sort((a, b) => a.value.$1.compareTo(b.value.$1));
    return [
      for (final MapEntry(key: item, value: (_, context)) in rows)
        if ((_from[item] ?? _stack) case final from?) _Seat(item, context, from, fromDock: _from.containsKey(item)),
    ];
  }

  void _mark(SeatKind kind, CartItem item, int index, BuildContext context) => (kind == SeatKind.dock ? _dock : _rows)[item] = (index, context);

  void _unmark(SeatKind kind, CartItem item, BuildContext context) {
    final marks = kind == SeatKind.dock ? _dock : _rows;
    if (marks[item]?.$2 == context) marks.remove(item);
  }
}

final traySeats = TraySeats();

Rect? _globalRect(BuildContext context) {
  final box = context.findRenderObject();
  if (box is! RenderBox || !box.attached || !box.hasSize) return null;
  return box.localToGlobal(Offset.zero) & box.size;
}

/// How far below its open place the order sheet stands now: the shell
/// moves the whole sheet with one translation, the nearest above its rows
double _lift(RenderObject row) {
  var node = row.parent;
  while (node != null && node is! RenderTransform) {
    node = node.parent;
  }
  final child = node is RenderTransform ? node.child : null;
  if (node == null || child == null) return 0;
  return child.localToGlobal(Offset.zero).dy - (node as RenderBox).localToGlobal(Offset.zero).dy;
}

/// Marks a dish's photo as a seat: in the dock it is where the circle
/// leaves from; on a row it is where it lands, and shows only once the
/// order is fully open and its circle has landed on it
class TraySeat extends StatefulWidget {
  final SeatKind kind;
  final CartItem item;

  /// Its place in the dock's stack (the front first), or the row's in the order
  final int index;
  final Widget child;

  const TraySeat({super.key, required this.kind, required this.item, required this.index, required this.child});

  @override
  State<TraySeat> createState() => _TraySeatState();
}

class _TraySeatState extends State<TraySeat> {
  @override
  void initState() {
    super.initState();
    traySeats._mark(widget.kind, widget.item, widget.index, context);
  }

  @override
  void didUpdateWidget(TraySeat old) {
    super.didUpdateWidget(old);
    if (!identical(old.item, widget.item) || old.kind != widget.kind) traySeats._unmark(old.kind, old.item, context);
    traySeats._mark(widget.kind, widget.item, widget.index, context);
  }

  @override
  void dispose() {
    traySeats._unmark(widget.kind, widget.item, context);
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (widget.kind == SeatKind.dock || !traySeats.flies || reduceMotion(context)) return widget.child;
    return ValueListenableBuilder<bool>(
      valueListenable: traySeats.seated,
      child: widget.child,
      builder: (context, seated, child) => Opacity(opacity: seated ? 1 : 0, child: child),
    );
  }
}

/// The circles in flight between the dock and the rows, over the whole app.
/// Under reduced motion there are none: the order simply opens.
class TraySeatLayer extends StatefulWidget {
  const TraySeatLayer({super.key});

  @override
  State<TraySeatLayer> createState() => _TraySeatLayerState();
}

class _TraySeatLayerState extends State<TraySeatLayer> {
  final _flow = GlobalKey(debugLabel: 'tray-seats');

  @override
  void initState() {
    super.initState();
    traySeats._layers++;
  }

  @override
  void dispose() {
    traySeats._layers--;
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (reduceMotion(context)) return const SizedBox.shrink();
    return ListenableBuilder(
      listenable: traySeats,
      builder: (context, _) {
        final motion = traySeats.motion;
        final open = motion?.value ?? 0;
        if (motion == null || !motion.sheetShown || open <= 0.001 || open >= 0.999) return const SizedBox.shrink();
        final seats = traySeats._seats();
        if (seats.isEmpty) return const SizedBox.shrink();
        return SlabInk(
          child: Flow(
            key: _flow,
            delegate: _SeatFlow(seats: seats, open: open, layer: _flow),
            children: [for (final seat in seats) _Circle(key: ObjectKey(seat.item), item: seat.item)],
          ),
        );
      },
    );
  }
}

/// The circles' size as laid out; each is scaled from it to where it is on its way
const _circle = 48.0;

/// Places each circle as the layer paints, once the dock and the rows are
/// laid out for this frame: where it left from, where its row will stand
/// with the order open, and how far along it is
class _SeatFlow extends FlowDelegate {
  final List<_Seat> seats;
  final double open;
  final GlobalKey layer;

  const _SeatFlow({required this.seats, required this.open, required this.layer});

  @override
  BoxConstraints getConstraintsForChild(int i, BoxConstraints constraints) => BoxConstraints.tight(const Size.square(_circle));

  @override
  void paintChildren(FlowPaintingContext context) {
    final box = layer.currentContext?.findRenderObject();
    if (box is! RenderBox) return;
    final origin = box.localToGlobal(Offset.zero);
    final listBox = traySeats.list.currentContext?.findRenderObject();
    // Only the rows the open order shows; the rest are simply there when it is open
    final flying = <(int, Rect)>[];
    for (final (i, seat) in seats.indexed) {
      final row = seat.row.mounted ? seat.row.findRenderObject() : null;
      if (row is! RenderBox || !row.attached || !row.hasSize) continue;
      final lift = _lift(row);
      final to = (row.localToGlobal(Offset.zero) & row.size).translate(0, -lift);
      if (listBox is RenderBox && listBox.attached && listBox.hasSize) {
        final list = (listBox.localToGlobal(Offset.zero) & listBox.size).translate(0, -lift);
        if (to.bottom > list.bottom - 4 || to.bottom < list.top) continue;
      }
      flying.add((i, to));
    }
    final count = flying.length;
    for (final (order, (i, to)) in flying.indexed) {
      final seat = seats[i];
      // Each circle leaves a touch after the one below it, so they fan out instead of moving as a block
      final lag = count > 1 ? ((count - 1 - order) / (count - 1)) * 0.25 : 0.0;
      final t = ((open - lag) / (1 - lag)).clamp(0.0, 1.0);
      final p = t * t * (3 - 2 * t);
      final from = seat.from.shift(-origin);
      final end = to.shift(-origin);
      double lerp(double a, double b) => a + (b - a) * p;
      final width = lerp(from.width, end.width);
      final height = lerp(from.height, end.height);
      // A small rise in the middle of the way, the same arc a dish takes into the tray
      final x = lerp(from.left, end.left);
      final y = lerp(from.top, end.top) - math.sin(p * math.pi) * 18;
      context.paintChild(
        i,
        transform: Matrix4.translationValues(x, y, 0)..scaleByDouble(width / _circle, height / _circle, 1, 1),
        opacity: seat.fromDock ? 1 : math.min(1, p * 3),
      );
    }
  }

  @override
  bool shouldRepaint(_SeatFlow old) => true;
}

/// A dish's circle in the air, drawn as the dock draws it: a ring of the
/// slab round the photo, a circle the whole way, only its size changing
class _Circle extends StatelessWidget {
  final CartItem item;

  const _Circle({super.key, required this.item});

  @override
  Widget build(BuildContext context) {
    final c = context.theme.colors;
    return Container(
      padding: const EdgeInsets.all(2),
      decoration: BoxDecoration(shape: BoxShape.circle, color: c.background, boxShadow: Ninja.slabShadow),
      child: ClipOval(
        child: ColoredBox(
          color: c.foreground.withValues(alpha: 0.15),
          child: SizedBox.expand(child: DishPhoto(url: item.pictureUri)),
        ),
      ),
    );
  }
}
