import 'dart:ui' show ImageFilter, lerpDouble;
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
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
/// lifts it.
Future<T?> showNinjaSheet<T>({
  required BuildContext context,
  required WidgetBuilder builder,
  bool dismissible = true,
  EdgeInsetsGeometry padding = const EdgeInsets.fromLTRB(20, 0, 20, 20),
}) {
  // Over everything, the dock too: on a tab's own navigator the sheet would open under the dock
  final navigator = Navigator.of(context, rootNavigator: true);
  return navigator.push<T>(_NinjaSheetRoute<T>(
    builder: builder,
    dismissible: dismissible,
    padding: padding,
    barrierLabel: MaterialLocalizations.of(context).modalBarrierDismissLabel,
    capturedThemes: InheritedTheme.capture(from: context, to: navigator.context),
  ));
}

class _NinjaSheetRoute<T> extends PopupRoute<T> {
  final WidgetBuilder builder;
  final bool dismissible;
  final EdgeInsetsGeometry padding;
  final CapturedThemes capturedThemes;

  _NinjaSheetRoute({
    required this.builder,
    required this.dismissible,
    required this.padding,
    required this.capturedThemes,
    required String barrierLabel,
  }) : _barrierLabel = barrierLabel;

  final String _barrierLabel;

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
    return GestureDetector(
      onTap: dismissible ? () => Navigator.of(context).maybePop() : null,
      child: AnimatedBuilder(
        animation: animation,
        builder: (context, _) {
          final t = animation.value.clamp(0.0, 1.0);
          return BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 2 * t, sigmaY: 2 * t),
            child: ColoredBox(color: Ninja.sheetScrim.withValues(alpha: Ninja.sheetScrim.a * t), child: const SizedBox.expand()),
          );
        },
      ),
    );
  }
}

class _SheetFrame extends StatefulWidget {
  final PopupRoute<dynamic> route;
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
  Rect? _dockNow() {
    final box = dockSlabKey.currentContext?.findRenderObject();
    if (box is! RenderBox || !box.attached || !box.hasSize) return null;
    final rect = box.localToGlobal(Offset.zero) & box.size;
    if (rect.height < 24 || rect.top >= MediaQuery.sizeOf(context).height - 8) return null;
    return rect;
  }

  void _end(DragEndDetails details) {
    final velocity = details.primaryVelocity ?? 0;
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
    // Off the bottom edge as the dock stands (main_scaffold's floating): on Android 8 above the gesture
    // bar, which is its inset; iPhone's home indicator sits low in its inset, so the sheet rests on it
    final safe = media.viewPadding.bottom;
    final floating = Theme.of(context).platform == TargetPlatform.android ? safe + 8 : (safe > 8 ? safe : 8.0);
    final bottom = keyboard > 0 ? keyboard + 8 : floating;
    final animation = widget.route.animation!;
    final reduced = reduceMotion(context);
    final morph = !reduced && _dock != null;

    final sheet = DarkScope(
      child: Builder(
        builder: (context) {
          final c = context.theme.colors;
          return Material(
            type: MaterialType.transparency,
            child: Container(
              constraints: BoxConstraints(maxHeight: (media.size.height - bottom) * 0.88 - (keyboard > 0 ? 8 : 0)),
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
                    onVerticalDragStart: (_) => setState(() => _dragging = true),
                    onVerticalDragUpdate: (d) => setState(() => _drag = (_drag + d.delta.dy).clamp(-4, double.infinity)),
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
