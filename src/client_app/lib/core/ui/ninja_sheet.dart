import 'dart:ui' show ImageFilter;
import 'package:flutter/material.dart';
import '../motion/motion.dart';
import '../theme/ninja_theme.dart';
import '../theme/theme_provider.dart';

/// The one way the customer app shows a sheet, a dialog or a question
/// (client_web's components/ui/ninja-sheet.tsx): a dark slab floating off
/// the screen's edges at the dock's margins, rising where the thumb already
/// is and going back down. It is pulled away by its handle (past 96 px, or
/// flicked), or closed by a tap on the dimmed page. Everything in it is set
/// in the dark scheme, so any part used inside reads on it. The keyboard
/// lifts it.
Future<T?> showNinjaSheet<T>({
  required BuildContext context,
  required WidgetBuilder builder,
  bool dismissible = true,
  EdgeInsetsGeometry padding = const EdgeInsets.fromLTRB(20, 0, 20, 20),
}) {
  return Navigator.of(context).push<T>(_NinjaSheetRoute<T>(
    builder: builder,
    dismissible: dismissible,
    padding: padding,
    barrierLabel: MaterialLocalizations.of(context).modalBarrierDismissLabel,
    capturedThemes: InheritedTheme.capture(from: context, to: Navigator.of(context).context),
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
    final bottom = keyboard > 0 ? keyboard + 8 : (media.viewPadding.bottom > 8 ? media.viewPadding.bottom : 8.0);
    final animation = widget.route.animation!;
    final reduced = reduceMotion(context);

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
              child: Column(
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
