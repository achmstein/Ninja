import 'dart:math' as math;
import 'dart:ui' show ImageFilter, lerpDouble;
import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';
import 'package:flutter/rendering.dart';
import '../../features/cart/widgets/tray_model.dart' show DockMetrics, trayOpensAfterDrag;
import '../shell/tuck.dart';
import '../motion/motion.dart';
import '../theme/ninja_theme.dart';
import '../theme/theme_provider.dart';

/// The one way the customer app shows a sheet, a dialog or a question
/// (client_web's components/ui/ninja-sheet.tsx): a dark slab floating off
/// the screen's edges at the dock's margins, grown out of the dock itself: it
/// opens as the dock's slab, clipped to the dock's shape where the dock
/// stands, and grows up into the sheet, what it holds fading in; closed, it
/// folds back down into the dock. With no dock on screen (tucked away, a page
/// pushed over the tabs) it rises from the bottom and goes back down. It is pulled away by its handle (past 96 px, or
/// flicked), or closed by a tap on the dimmed page. Everything in it is set
/// in the dark scheme, so any part used inside reads on it. The keyboard
/// lifts it. Opened from the dock's row ([fromRow]) it comes out of the row
/// as the order comes out of the tray's ([RowOpen]).
Future<T?> showNinjaSheet<T>({
  required BuildContext context,
  required WidgetBuilder builder,
  bool dismissible = true,
  EdgeInsetsGeometry padding = const EdgeInsets.fromLTRB(20, 0, 20, 20),
  RowOpen? fromRow,
}) {
  // Over everything, the dock too: on a tab's own navigator the sheet would open under the dock
  final navigator = Navigator.of(context, rootNavigator: true);
  return navigator.push<T>(_NinjaSheetRoute<T>(
    builder: builder,
    dismissible: dismissible,
    padding: padding,
    row: fromRow,
    barrierLabel: MaterialLocalizations.of(context).modalBarrierDismissLabel,
    capturedThemes: InheritedTheme.capture(from: context, to: navigator.context),
  ));
}

/// A sheet opened out of the dock's row (the bill's, dock_bill.dart) moves as
/// the order does out of the tray's row: it rises out of the row's top edge
/// on the order's spring, the dock under it as it was, and folds back down
/// into it. Tapped, it springs open; pulled up by the row ([held]), it
/// follows the finger from the first pixel and on letting go settles open
/// or shut by the order's own rule ([trayOpensAfterDrag]).
class RowOpen {
  /// Opened under a finger: it stands where [update] puts it until [end]
  final bool held;

  RowOpen({this.held = false});

  _NinjaSheetRoute<dynamic>? _route;
  double _dragged = 0;

  /// The finger moved [dy] (down positive)
  void update(double dy) {
    _dragged += dy;
    _route?._follow(dy);
  }

  /// The finger let go at [velocity] (down positive)
  void end(double velocity) => _route?._settle(trayOpensAfterDrag(false, _dragged, velocity), velocity);
}

/// The dock's slab where it stands on the screen: none while it is tucked away below the screen's edge
Rect? _dockRect(double screenHeight) {
  final box = dockSlabKey.currentContext?.findRenderObject();
  if (box is! RenderBox || !box.attached || !box.hasSize) return null;
  final rect = box.localToGlobal(Offset.zero) & box.size;
  if (rect.height < 24 || rect.top >= screenHeight - 8) return null;
  return rect;
}

class _NinjaSheetRoute<T> extends PopupRoute<T> {
  final WidgetBuilder builder;
  final bool dismissible;
  final EdgeInsetsGeometry padding;
  final CapturedThemes capturedThemes;

  /// Opened out of the dock's row, and the dock where it stood then: none, it opens as any sheet
  final RowOpen? row;
  Rect? _rowDock;

  _NinjaSheetRoute({
    required this.builder,
    required this.dismissible,
    required this.padding,
    required this.capturedThemes,
    required String barrierLabel,
    this.row,
  }) : _barrierLabel = barrierLabel;

  final String _barrierLabel;

  /// The sheet itself, whose height is how far a finger takes it from shut to open
  final _sheet = GlobalKey(debugLabel: 'sheet');
  double get _travel => _sheet.currentContext?.size?.height ?? 320;

  /// How fast the finger let go (down positive), for the spring shutting it to start from
  double _letGo = 0;

  /// Out of the row and moving under the order's spring: not under reduced motion, where it simply fades
  bool get _fromRow => _rowDock != null;
  bool get _springs => _fromRow && !(MediaQuery.maybeDisableAnimationsOf(navigator!.context) ?? false);

  void _springTo(double target, double velocity) {
    final spring = SpringSimulation(Motion.springTray, controller!.value, target, velocity, tolerance: const Tolerance(distance: 0.001, velocity: 0.01));
    if (target <= 0) {
      controller!.animateBackWith(spring);
      return;
    }
    // Come to rest within the spring's tolerance: the last hair of the way, so it stands where it belongs
    controller!.animateWith(spring).whenComplete(() {
      if (isActive && controller!.value != 1) controller!.value = 1;
    });
  }

  @override
  TickerFuture didPush() {
    final pushed = super.didPush();
    final row = this.row;
    if (row != null) {
      row._route = this;
      _rowDock = _dockRect(MediaQuery.sizeOf(navigator!.context).height);
      if (row.held) {
        // Under the finger from its first pixel
        controller!
          ..stop()
          ..value = 0;
        navigator!.didStartUserGesture();
      } else if (_springs) {
        _springTo(1, 0);
      }
    }
    return pushed;
  }

  @override
  bool didPop(T? result) {
    final popped = super.didPop(result);
    if (_springs) _springTo(0, -_letGo / _travel);
    _letGo = 0;
    return popped;
  }

  /// A finger on the row or the sheet's handle moved it [dy] (down positive)
  void _follow(double dy) {
    if (!isActive) return;
    controller!.value = (controller!.value - dy / _travel).clamp(0.0, 1.0);
  }

  /// The finger let go: [open] it springs up, else it folds back into the row
  void _settle(bool open, double velocity) {
    if (!isActive) return;
    if (navigator!.userGestureInProgress) navigator!.didStopUserGesture();
    if (open && _springs) {
      _springTo(1, -velocity / _travel);
    } else if (open) {
      controller!.value = 1;
    } else {
      _letGo = velocity;
      isCurrent ? navigator!.pop() : navigator!.removeRoute(this);
    }
  }

  @override
  Color? get barrierColor => null;

  @override
  bool get barrierDismissible => dismissible;

  @override
  String? get barrierLabel => _barrierLabel;

  @override
  Duration get transitionDuration => Motion.slow;

  @override
  Duration get reverseTransitionDuration => const Duration(milliseconds: 200);

  @override
  Widget buildModalBarrier() => _Scrim(route: this, dismissible: dismissible);

  @override
  Widget buildPage(BuildContext context, Animation<double> animation, Animation<double> secondaryAnimation) =>
      capturedThemes.wrap(_SheetFrame(route: this, padding: padding, builder: builder));
}

/// The page dimmed and a touch blurred behind the sheet
class _Scrim extends StatelessWidget {
  final PopupRoute<dynamic> route;
  final bool dismissible;

  const _Scrim({required this.route, required this.dismissible});

  @override
  Widget build(BuildContext context) {
    final animation = route.animation!;
    // Out of the dock's row, the dock stays as it was under it, as under the open order
    final dock = route is _NinjaSheetRoute ? (route as _NinjaSheetRoute)._rowDock : null;
    return GestureDetector(
      onTap: dismissible ? () => Navigator.of(context).maybePop() : null,
      child: AnimatedBuilder(
        animation: animation,
        builder: (context, _) {
          final t = animation.value.clamp(0.0, 1.0);
          final scrim = BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 2 * t, sigmaY: 2 * t),
            child: ColoredBox(color: Ninja.sheetScrim.withValues(alpha: Ninja.sheetScrim.a * t), child: const SizedBox.expand()),
          );
          return dock == null ? scrim : ClipPath(clipper: _AllBut(dock), child: scrim);
        },
      ),
    );
  }
}

/// The whole screen but the dock's slab
class _AllBut extends CustomClipper<Path> {
  final Rect hole;

  const _AllBut(this.hole);

  @override
  Path getClip(Size size) => Path()
    ..fillType = PathFillType.evenOdd
    ..addRect(Offset.zero & size)
    ..addRRect(RRect.fromRectAndRadius(hole, const Radius.circular(Ninja.cardRadius)));

  @override
  bool shouldReclip(_AllBut old) => old.hole != hole;
}

/// The sheet's own box, and all round it but under it: what is lower than its bottom edge (the row it
/// comes out of) is not drawn, its shadow above and at the sides is
class _ClipUnder extends CustomClipper<Rect> {
  const _ClipUnder();

  @override
  Rect getClip(Size size) => Rect.fromLTRB(-64, -64, size.width + 64, size.height);

  @override
  bool shouldReclip(_ClipUnder old) => false;
}

class _SheetFrame extends StatefulWidget {
  final _NinjaSheetRoute<dynamic> route;
  final EdgeInsetsGeometry padding;
  final WidgetBuilder builder;

  const _SheetFrame({required this.route, required this.padding, required this.builder});

  @override
  State<_SheetFrame> createState() => _SheetFrameState();
}

class _SheetFrameState extends State<_SheetFrame> {
  double _drag = 0;
  bool _dragging = false;

  /// The dock it grew out of, on the screen, as it opened: null with no dock to grow from
  Rect? _dock;
  bool _looked = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_looked) return;
    _looked = true;
    _dock = _dockNow();
  }

  /// The dock where it stands now: none while it is tucked away below the screen's edge
  Rect? _dockNow() => _dockRect(MediaQuery.sizeOf(context).height);

  /// Out of the row, the handle moves the sheet itself, as the open order's does: down it goes with the
  /// finger, and let go it shuts or springs back up by the order's rule
  double _pulled = 0;

  void _start(DragStartDetails _) {
    if (widget.route._fromRow) {
      _pulled = 0;
      widget.route.navigator?.didStartUserGesture();
      return;
    }
    setState(() => _dragging = true);
  }

  void _update(DragUpdateDetails d) {
    if (widget.route._fromRow) {
      _pulled += d.delta.dy;
      widget.route._follow(d.delta.dy);
      return;
    }
    setState(() => _drag = (_drag + d.delta.dy).clamp(-4, double.infinity));
  }

  void _end(DragEndDetails details) {
    final velocity = details.primaryVelocity ?? 0;
    if (widget.route._fromRow) {
      widget.route._settle(trayOpensAfterDrag(true, _pulled, velocity), velocity);
      return;
    }
    setState(() => _dragging = false);
    if (_drag > 96 || velocity > 600) {
      Navigator.of(context).maybePop();
    } else {
      setState(() => _drag = 0);
    }
  }

  @override
  Widget build(BuildContext context) {
    final media = MediaQuery.of(context);
    final keyboard = media.viewInsets.bottom;
    final bottom = keyboard > 0 ? keyboard + 8 : (media.viewPadding.bottom > 8 ? media.viewPadding.bottom : 8.0);
    final animation = widget.route.animation!;
    final reduced = reduceMotion(context);
    // Out of the dock's row: on the row's top edge, as wide as the dock, a gap over it
    final row = widget.route._rowDock;
    final rowBottom = row == null ? 0.0 : math.max(media.size.height - row.top + DockMetrics.inset, keyboard + 8);
    final maxHeight = row != null
        ? media.size.height - rowBottom - media.padding.top - 8
        : (media.size.height - bottom) * 0.88 - (keyboard > 0 ? 8 : 0);
    final morph = !reduced && _dock != null && row == null;

    final sheet = DarkScope(
      child: Builder(
        builder: (context) {
          final c = context.theme.colors;
          return Material(
            type: MaterialType.transparency,
            child: Container(
              key: widget.route._sheet,
              constraints: BoxConstraints(maxHeight: maxHeight),
              decoration: BoxDecoration(
                color: c.background,
                borderRadius: BorderRadius.circular(Ninja.sheetRadius),
                boxShadow: Ninja.sheetShadow,
              ),
              clipBehavior: Clip.antiAlias,
              // Out of the dock, what it holds comes in once the slab has grown some way, and goes first
              child: _fadeInside(
                morph,
                animation,
                Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // The handle the sheet is pulled down by
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onVerticalDragStart: _start,
                    onVerticalDragUpdate: _update,
                    onVerticalDragEnd: _end,
                    child: SizedBox(
                      height: 28,
                      child: Center(
                        child: Container(
                          width: 40,
                          height: 4,
                          decoration: BoxDecoration(color: c.foreground.withValues(alpha: 0.25), borderRadius: BorderRadius.circular(2)),
                        ),
                      ),
                    ),
                  ),
                  Flexible(
                    child: SingleChildScrollView(
                      padding: widget.padding,
                      child: DefaultTextStyle.merge(
                        style: context.localeText(TextStyle(color: c.foreground)),
                        child: widget.builder(context),
                      ),
                    ),
                  ),
                ],
              ),
              ),
            ),
          );
        },
      ),
    );

    if (row != null) {
      // Out of the row, under the order's spring: drawn down by how far it is from open, and nothing of it
      // under its bottom edge, so it rises out of the row's top as the order does
      return Align(
        alignment: Alignment.bottomCenter,
        child: Padding(
          padding: EdgeInsets.only(left: row.left, right: media.size.width - row.right, bottom: rowBottom),
          child: AnimatedBuilder(
            animation: animation,
            child: sheet,
            builder: (context, child) => reduced
                ? Opacity(opacity: animation.value.clamp(0.0, 1.0), child: child)
                : ClipRect(
                    clipper: const _ClipUnder(),
                    child: FractionalTranslation(translation: Offset(0, 1 - animation.value), child: child),
                  ),
          ),
        ),
      );
    }

    return Align(
      alignment: Alignment.bottomCenter,
      child: Padding(
        padding: EdgeInsets.only(left: 8, right: 8, bottom: bottom),
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: Ninja.maxWidth - 16),
          child: AnimatedBuilder(
            animation: animation,
            // Under the finger it follows; let go short of closing, it goes back up
            child: TweenAnimationBuilder<double>(
              tween: Tween(end: _drag),
              duration: _dragging ? Duration.zero : Motion.base,
              curve: Motion.enter,
              builder: (context, y, child) => Transform.translate(offset: Offset(0, y), child: child),
              child: sheet,
            ),
            builder: (context, child) {
              final forward = animation.status != AnimationStatus.reverse;
              final t = (forward ? Motion.enter : Motion.exit.flipped).transform(animation.value.clamp(0.0, 1.0));
              if (reduced) return Opacity(opacity: t, child: child);
              if (morph) {
                // Folding back, into wherever the dock stands now (the tabs back, a row come)
                final dock = forward ? _dock! : (_dockNow() ?? _dock!);
                return _DockMorph(grown: t, dock: dock, dockRadius: Ninja.cardRadius, radius: Ninja.sheetRadius, child: child);
              }
              return Transform.translate(
                offset: Offset(0, 72 * (1 - t)),
                child: Transform.scale(
                  scale: 0.96 + 0.04 * t,
                  alignment: Alignment.bottomCenter,
                  child: Opacity(opacity: t, child: child),
                ),
              );
            },
          ),
        ),
      ),
    );
  }
}

/// What the sheet holds, faded in behind the slab growing out of the dock
Widget _fadeInside(bool morph, Animation<double> animation, Widget child) =>
    morph ? FadeTransition(opacity: CurvedAnimation(parent: animation, curve: const Interval(0.35, 1)), child: child) : child;

/// The sheet clipped to the dock's box ([grown] 0) growing to its own (1),
/// the corners easing from the dock's to its own: the dock's slab opening
/// up into the sheet
class _DockMorph extends SingleChildRenderObjectWidget {
  final double grown;

  /// The dock's box on the screen
  final Rect dock;
  final double dockRadius;
  final double radius;

  const _DockMorph({required this.grown, required this.dock, required this.dockRadius, required this.radius, required super.child});

  @override
  RenderObject createRenderObject(BuildContext context) => _RenderDockMorph(grown, dock, dockRadius, radius);

  @override
  void updateRenderObject(BuildContext context, _RenderDockMorph renderObject) => renderObject
    ..grown = grown
    ..dock = dock
    ..dockRadius = dockRadius
    ..radius = radius;
}

class _RenderDockMorph extends RenderProxyBox {
  _RenderDockMorph(this._grown, this._dock, this._dockRadius, this._radius);

  double _grown;
  set grown(double v) {
    if (v == _grown) return;
    _grown = v;
    markNeedsPaint();
  }

  Rect _dock;
  set dock(Rect v) {
    if (v == _dock) return;
    _dock = v;
    markNeedsPaint();
  }

  double _dockRadius;
  set dockRadius(double v) {
    if (v == _dockRadius) return;
    _dockRadius = v;
    markNeedsPaint();
  }

  double _radius;
  set radius(double v) {
    if (v == _radius) return;
    _radius = v;
    markNeedsPaint();
  }

  Rect _clip() {
    final own = Offset.zero & size;
    final dock = _dock.shift(-localToGlobal(Offset.zero));
    return Rect.lerp(dock.intersect(own.inflate(0.5)), own, _grown)!;
  }

  @override
  bool hitTestSelf(Offset position) => false;

  @override
  bool hitTest(BoxHitTestResult result, {required Offset position}) => _clip().contains(position) && super.hitTest(result, position: position);

  @override
  void paint(PaintingContext context, Offset offset) {
    if (child == null) return;
    // Grown, the sheet whole, its shadow too
    if (_grown >= 1) {
      layer = null;
      super.paint(context, offset);
      return;
    }
    final corner = Radius.circular(lerpDouble(_dockRadius, _radius, _grown)!);
    layer = context.pushClipRRect(
      needsCompositing,
      offset,
      Offset.zero & size,
      RRect.fromRectAndRadius(_clip(), corner),
      super.paint,
      oldLayer: layer as ClipRRectLayer?,
    );
  }
}

/// A question or a short dialog inside a [showNinjaSheet]: a headline, what
/// it is about, and full-width pills with the action on top (the web's
/// sheetFooterClass)
class NinjaDialog extends StatelessWidget {
  final Widget title;
  final Widget? body;
  final List<Widget> actions;

  const NinjaDialog({super.key, required this.title, this.body, this.actions = const []});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        DefaultTextStyle.merge(
          style: context.localeText(theme.typography.headline.copyWith(fontWeight: FontWeight.w800, color: theme.colors.foreground)),
          child: title,
        ),
        if (body != null) ...[const SizedBox(height: 12), body!],
        if (actions.isNotEmpty) ...[
          const SizedBox(height: 20),
          // The action first (the thumb's nearest last), then the way out under it
          for (final (i, action) in actions.reversed.indexed) ...[if (i > 0) const SizedBox(height: 8), action],
        ],
      ],
    );
  }
}
