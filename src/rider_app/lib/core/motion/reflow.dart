import 'dart:async';
import 'package:flutter/physics.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/widgets.dart';
import 'motion.dart';

/// The frame of reference for [ReflowItem]s: positions are measured
/// against it, so a page sliding in or a dialog opening moves nothing. Put
/// it around the grid (or around the scroll view holding the grid —
/// scrolling is taken out of the measurement).
class ReflowScope extends StatefulWidget {
  final Widget child;
  const ReflowScope({super.key, required this.child});

  @override
  State<ReflowScope> createState() => _ReflowScopeState();
}

class _ReflowScopeState extends State<ReflowScope> {
  final _box = GlobalKey();

  RenderBox? get box {
    final object = _box.currentContext?.findRenderObject();
    return object is RenderBox && object.attached ? object : null;
  }

  @override
  Widget build(BuildContext context) =>
      _ReflowScopeMarker(state: this, child: KeyedSubtree(key: _box, child: widget.child));
}

class _ReflowScopeMarker extends InheritedWidget {
  final _ReflowScopeState state;
  const _ReflowScopeMarker({required this.state, required super.child});

  @override
  bool updateShouldNotify(_ReflowScopeMarker old) => old.state != state;
}

/// Layout animation, the FLIP way: when a relayout moves this child (a
/// neighbour left, the grid closed the gap, the columns reshuffled), it is
/// painted where it was and springs to where it now is. Only a paint
/// offset moves; layout is never animated and nothing ticks at rest.
///
/// Inside a sliver grid, build the children without repaint boundaries
/// (`addRepaintBoundaries: false`) so a moved child is painted again.
class ReflowItem extends StatefulWidget {
  final Widget child;
  final SpringDescription spring;
  const ReflowItem({super.key, required this.child, this.spring = Motion.spring});

  @override
  State<ReflowItem> createState() => _ReflowItemState();
}

class _ReflowItemState extends State<ReflowItem> with SingleTickerProviderStateMixin {
  late final AnimationController _c = AnimationController.unbounded(vsync: this, value: 1)..addListener(_tick);
  _RenderReflow? _render;
  _ReflowScopeState? _scope;
  ScrollableState? _scroll;
  Offset _from = Offset.zero;
  bool _pending = false;
  bool _reduce = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _scope = context.dependOnInheritedWidgetOfExactType<_ReflowScopeMarker>()?.state;
    _reduce = reduceMotion(context);
    // Only a scroll view inside the scope moves things the scope does not
    final scroll = Scrollable.maybeOf(context);
    _scroll = scroll != null && _scope != null && scroll.context.findAncestorStateOfType<_ReflowScopeState>() == _scope
        ? scroll
        : null;
  }

  @override
  void dispose() {
    _c.dispose();
    super.dispose();
  }

  void _tick() => _render?.markNeedsPaint();

  Offset get translation => _pending ? _from : _from * (1 - _c.value);

  Offset? _measure(RenderBox box) {
    final scope = _scope?.box;
    if (scope == null || !box.attached) return null;
    var position = box.localToGlobal(Offset.zero, ancestor: scope);
    final scroll = _scroll;
    if (scroll != null && scroll.mounted && scroll.position.hasPixels) {
      final pixels = scroll.position.pixels;
      position += scroll.position.axis == Axis.vertical ? Offset(0, pixels) : Offset(pixels, 0);
    }
    return position;
  }

  // Called from paint: the new offset shows in this very frame, the spring
  // starts right after it
  void _moved(Offset from) {
    if (_reduce || !mounted) return;
    _from = from;
    _pending = true;
    scheduleMicrotask(() {
      if (!mounted) return;
      _pending = false;
      _c.value = 0;
      _c.animateWith(SpringSimulation(widget.spring, 0, 1, 0));
    });
  }

  @override
  Widget build(BuildContext context) => _ReflowBox(state: this, child: widget.child);
}

class _ReflowBox extends SingleChildRenderObjectWidget {
  final _ReflowItemState state;
  const _ReflowBox({required this.state, super.child});

  @override
  RenderObject createRenderObject(BuildContext context) => _RenderReflow(state);

  @override
  void updateRenderObject(BuildContext context, _RenderReflow renderObject) => renderObject.state = state;
}

class _RenderReflow extends RenderProxyBox {
  _RenderReflow(this._state);

  _ReflowItemState _state;
  set state(_ReflowItemState value) {
    if (value == _state) return;
    _state = value;
    _state._render = this;
  }

  Offset? _last;

  @override
  void attach(PipelineOwner owner) {
    super.attach(owner);
    _state._render = this;
  }

  @override
  void detach() {
    if (_state._render == this) _state._render = null;
    _last = null;
    super.detach();
  }

  @override
  void paint(PaintingContext context, Offset offset) {
    final position = _state._measure(this);
    if (position != null) {
      final last = _last;
      if (last != null && (position - last).distanceSquared > 0.25) {
        _state._moved(last - position + _state.translation);
      }
      _last = position;
    }
    final child = this.child;
    if (child != null) context.paintChild(child, offset + _state.translation);
  }

  @override
  bool hitTestChildren(BoxHitTestResult result, {required Offset position}) {
    final child = this.child;
    if (child == null) return false;
    return result.addWithPaintOffset(
      offset: _state.translation,
      position: position,
      hitTest: (result, transformed) => child.hitTest(result, position: transformed),
    );
  }

  @override
  void applyPaintTransform(RenderBox child, Matrix4 transform) {
    final t = _state.translation;
    transform.translateByDouble(t.dx, t.dy, 0, 1);
  }
}

typedef PresenceEnterBuilder = Widget Function(BuildContext context, Key key, Widget child);
typedef PresenceExitBuilder = Widget Function(BuildContext context, Key key, Widget child, Animation<double> exit);

/// Keyed children that come and go with an animation instead of popping:
/// a child that leaves stays where it was, drawn by [exit] while its
/// animation runs 0 → 1, and only then gives up its place — which the
/// others, each a [ReflowItem], glide into. A child that arrives after the
/// first build is drawn by [enter]. Changing [epoch] (another station, a
/// finished first load) starts over without animating anything.
class Presence extends StatefulWidget {
  /// Every child must have a key
  final List<Widget> children;
  final Widget Function(BuildContext context, List<Widget> children) builder;
  final PresenceEnterBuilder? enter;
  final PresenceExitBuilder? exit;
  final Duration exitDuration;
  final Object? epoch;

  /// Wrap each child in a [ReflowItem] (needs a [ReflowScope] above)
  final bool reflow;

  const Presence({
    super.key,
    required this.children,
    required this.builder,
    this.enter,
    this.exit,
    this.exitDuration = Motion.slow,
    this.epoch,
    this.reflow = true,
  });

  @override
  State<Presence> createState() => _PresenceState();
}

class _Leaving {
  final Widget child;
  final AnimationController controller;
  _Leaving(this.child, this.controller);
}

class _PresenceState extends State<Presence> with TickerProviderStateMixin {
  List<Key> _order = [];
  final Map<Key, _Leaving> _leaving = {};
  final Set<Key> _arrived = {};

  static List<Key> _keys(List<Widget> children) => [
        for (final child in children) child.key ?? (throw ArgumentError('Presence children need keys')),
      ];

  @override
  void initState() {
    super.initState();
    _order = _keys(widget.children);
  }

  @override
  void dispose() {
    for (final leaving in _leaving.values) {
      leaving.controller.dispose();
    }
    super.dispose();
  }

  @override
  void didUpdateWidget(Presence old) {
    super.didUpdateWidget(old);
    final next = _keys(widget.children);
    if (widget.epoch != old.epoch) {
      for (final leaving in _leaving.values) {
        leaving.controller.dispose();
      }
      _leaving.clear();
      _arrived.clear();
      _order = next;
      return;
    }
    final nextSet = next.toSet();
    final previous = {for (final child in old.children) child.key!: child};

    // Back before it finished leaving: it simply stays
    for (final key in next) {
      final back = _leaving.remove(key);
      back?.controller.dispose();
    }
    for (final key in _order) {
      if (nextSet.contains(key) || _leaving.containsKey(key)) continue;
      final child = previous[key];
      if (child == null) continue;
      final controller = AnimationController(
        vsync: this,
        duration: reduceMotion(context) ? Motion.fast : widget.exitDuration,
      );
      controller.addStatusListener((status) {
        if (status != AnimationStatus.completed || !mounted) return;
        setState(() {
          _leaving.remove(key)?.controller.dispose();
          _arrived.remove(key);
          _order.remove(key);
        });
      });
      _leaving[key] = _Leaving(child, controller);
      controller.forward();
    }
    final known = _order.toSet();
    for (final key in next) {
      if (!known.contains(key)) _arrived.add(key);
    }
    _order = _merge(_order, next, _leaving.keys.toSet());
  }

  /// The new order, with each leaving child kept after whatever stood
  /// before it
  static List<Key> _merge(List<Key> old, List<Key> next, Set<Key> leaving) {
    final nextSet = next.toSet();
    final out = <Key>[];
    final emitted = <Key>{};
    var i = 0;
    for (final key in old) {
      if (nextSet.contains(key)) {
        if (emitted.contains(key)) continue;
        while (i < next.length) {
          final n = next[i++];
          if (emitted.add(n)) out.add(n);
          if (n == key) break;
        }
      } else if (leaving.contains(key) && emitted.add(key)) {
        out.add(key);
      }
    }
    while (i < next.length) {
      final n = next[i++];
      if (emitted.add(n)) out.add(n);
    }
    return out;
  }

  @override
  Widget build(BuildContext context) {
    final reduce = reduceMotion(context);
    final current = {for (final child in widget.children) child.key!: child};
    final out = <Widget>[];
    for (final key in _order) {
      final leaving = _leaving[key];
      Widget? child;
      if (leaving != null) {
        child = IgnorePointer(
          child: reduce || widget.exit == null
              ? FadeTransition(opacity: ReverseAnimation(leaving.controller), child: leaving.child)
              : widget.exit!(context, key, leaving.child, leaving.controller),
        );
      } else {
        child = current[key];
        if (child == null) continue;
        if (_arrived.contains(key) && widget.enter != null) child = widget.enter!(context, key, child);
      }
      if (widget.reflow) child = ReflowItem(child: child);
      out.add(KeyedSubtree(key: key, child: child));
    }
    return widget.builder(context, out);
  }
}
