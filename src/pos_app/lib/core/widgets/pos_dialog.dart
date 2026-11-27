import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import '../layout/breakpoints.dart';
import '../theme/type_roles.dart';

/// How wide a pop-up is, said by what it holds (pos_web's `DialogContent
/// size`). A width is never typed as a number: see docs/layout.md.
enum DialogSize {
  /// A question and its answers: confirm, discard, a short notice
  sm(384),

  /// A few fields or a short list: the usual pop-up
  md(448),

  /// A list to pick from, a form in steps, a keypad beside its figures
  lg(512),

  /// Two columns side by side: a report, a count beside its keypad
  xl(768);

  final double width;

  const DialogSize(this.width);
}

/// A dialog that stays whole when the keyboard opens. On a tablet the card
/// moves up into the part of the screen the keyboard leaves and sits in the
/// middle of it, as tall as it was; only a card too tall for that part is
/// held to it, and its body, a [DialogScroll], then scrolls. It gains no
/// empty room of its own: slack as tall as the keyboard under every dialog
/// made a short one (a discount, a name) end in a white gap down to the keys.
/// A phone's sheet (see [DialogPanel]) rises above the keyboard where the
/// screen has the room, and keeps the slack for the part that could not.
///
/// A tap anywhere that is not a control while the keyboard is up — the
/// dimmed screen or the dialog's own blank space — only puts the keyboard
/// away: the cashier tapped to see the dialog again, not to throw away what
/// they typed. With no keyboard up, a tap outside dismisses, as before.
Future<T?> showPosDialog<T>(
  BuildContext context, {
  required WidgetBuilder builder,
  DialogSize size = DialogSize.md,
}) {
  return showFDialog<T>(
    context: context,
    useRootNavigator: true,
    // Forui's barrier pops on any tap; ours (below) asks about the keyboard first
    barrierDismissible: false,
    builder: (context, style, animation) {
      // Read the keyboard here, above the dialog, then hide it from the
      // dialog so it stays put; the body gets it back through [_Keyboard]
      final keyboard = MediaQuery.viewInsetsOf(context).bottom;
      final sheet = context.isCompact;
      return MediaQuery.removeViewInsets(
        context: context,
        removeBottom: true,
        child: _Keyboard(
          // A tablet's card is moved clear of the keyboard below: nothing of it is covered,
          // so its body needs no slack. A phone's sheet works out its own
          height: sheet ? keyboard : 0,
          child: Stack(
            children: [
              Positioned.fill(
                child: GestureDetector(
                  behavior: HitTestBehavior.opaque,
                  excludeFromSemantics: true,
                  onTap: () {
                    if (keyboard > 0) {
                      FocusManager.instance.primaryFocus?.unfocus();
                    } else {
                      Navigator.of(context, rootNavigator: true).pop();
                    }
                  },
                ),
              ),
              // Blank space inside the dialog: controls win the tap, anything
              // else lands here
              GestureDetector(
                behavior: HitTestBehavior.translucent,
                excludeFromSemantics: true,
                onTap: keyboard > 0 ? () => FocusManager.instance.primaryFocus?.unfocus() : null,
                // The card is laid out in what the keyboard leaves: in the middle of it, and
                // no taller. The keyboard's own slide is what moves it, frame by frame
                child: Padding(
                  padding: EdgeInsets.only(bottom: sheet ? 0 : keyboard),
                  child: DialogPanel(
                    style: style,
                    animation: animation,
                    size: size,
                    builder: builder,
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}

/// What every till dialog is drawn on. A tablet gets Forui's dialog: a card
/// in the middle of the screen, no wider than its [size]. A phone gets a
/// sheet rising from the bottom edge, as pos_web's dialogs do below the same
/// width: the whole width of the screen, in thumb reach, its top corners
/// rounded and a grab handle saying where it came from. A card in the middle
/// of a phone leaves its buttons a width too small to label.
///
/// The sheet is never squeezed by the keyboard. It rises above it as far as
/// the screen has room, keeping its height; what the keyboard still covers,
/// a [DialogScroll] body can scroll up into view.
class DialogPanel extends StatelessWidget {
  final FDialogStyle style;
  final Animation<double> animation;

  /// How wide the card may grow on a tablet. A phone's sheet takes the screen's width.
  final DialogSize size;
  final WidgetBuilder builder;

  const DialogPanel({
    super.key,
    required this.style,
    required this.animation,
    required this.builder,
    this.size = DialogSize.md,
  });

  /// pos_web's `rounded-t-2xl`
  static const double _radius = 16;

  /// What stays of the screen behind above a full-height sheet, so it still
  /// reads as something laid over the screen (pos_web keeps the same 1.5rem)
  static const double _topGap = 24;

  static final Animatable<Offset> _rise = Tween<Offset>(
    begin: const Offset(0, 1),
    end: Offset.zero,
  ).chain(CurveTween(curve: Curves.easeOutCubic));

  @override
  Widget build(BuildContext context) {
    if (!context.isCompact) {
      return FDialog.raw(
        style: style,
        animation: animation,
        constraints: BoxConstraints(maxWidth: size.width),
        builder: (context, _) => builder(context),
      );
    }

    final theme = context.theme;
    final media = MediaQuery.of(context);
    // [showPosDialog] hides the keyboard from what it shows and hands it down
    // itself; a dialog opened without it still sees the screen's own
    final keyboard = media.viewInsets.bottom > 0 ? media.viewInsets.bottom : _Keyboard.of(context);
    const corners = BorderRadius.vertical(top: Radius.circular(_radius));

    return MediaQuery.removeViewInsets(
      context: context,
      removeLeft: true,
      removeTop: true,
      removeRight: true,
      removeBottom: true,
      // The keyboard goes on to the body here too, for the part of the sheet
      // that could not rise clear of it
      child: _Keyboard(
        height: keyboard,
        child: CustomSingleChildLayout(
          delegate: _SheetLayout(keyboard: keyboard, top: media.padding.top + _topGap),
          child: SlideTransition(
            position: animation.drive(_rise),
            child: DefaultTextStyle(
              style: theme.type.body.copyWith(color: theme.colors.foreground),
              child: Semantics(
                scopesRoute: true,
                explicitChildNodes: true,
                namesRoute: true,
                // A border along the top edge only, following the corners: the
                // card's colour laid one pixel lower on the border's. A box
                // cannot round a border it draws on one side.
                child: DecoratedBox(
                  decoration: BoxDecoration(color: theme.colors.border, borderRadius: corners),
                  child: Padding(
                    padding: const EdgeInsets.only(top: 1),
                    child: Container(
                      clipBehavior: Clip.antiAlias,
                      decoration: BoxDecoration(color: style.decoration.color, borderRadius: corners),
                      // Clear of the home bar
                      padding: EdgeInsets.only(bottom: media.padding.bottom),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Center(
                            child: Container(
                              margin: const EdgeInsets.only(top: 8),
                              width: 40,
                              height: 6,
                              decoration: BoxDecoration(
                                color: theme.colors.mutedForeground.withValues(alpha: 0.3),
                                borderRadius: BorderRadius.circular(3),
                              ),
                            ),
                          ),
                          Flexible(child: Builder(builder: builder)),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Sets a phone's sheet against the bottom edge at the screen's full width,
/// as tall as its content up to the screen less [top]. With the keyboard up
/// the sheet moves above it, but no further than [top]: a sheet too tall to
/// clear the keyboard stays whole and leaves its lower part under it.
class _SheetLayout extends SingleChildLayoutDelegate {
  final double keyboard;
  final double top;

  const _SheetLayout({required this.keyboard, required this.top});

  @override
  BoxConstraints getConstraintsForChild(BoxConstraints constraints) => BoxConstraints(
        minWidth: constraints.maxWidth,
        maxWidth: constraints.maxWidth,
        maxHeight: (constraints.maxHeight - top).clamp(0.0, double.infinity),
      );

  @override
  Offset getPositionForChild(Size size, Size childSize) {
    final room = (size.height - top - childSize.height).clamp(0.0, double.infinity);
    return Offset(0, size.height - childSize.height - (keyboard < room ? keyboard : room));
  }

  @override
  bool shouldRelayout(_SheetLayout old) => old.keyboard != keyboard || old.top != top;
}

/// Buttons side by side at one width, the widest one's, so the options of
/// one choice (or a pop-up's answers) stand the same whatever their words.
/// They sit at the row's end (or wherever [alignment] says) and take no more
/// room than they need.
class EqualButtons extends StatelessWidget {
  final List<Widget> children;
  final AlignmentGeometry alignment;

  const EqualButtons({super.key, required this.children, this.alignment = AlignmentDirectional.centerEnd});

  @override
  Widget build(BuildContext context) {
    return Align(
      alignment: alignment,
      heightFactor: 1,
      // Each an equal share of a row that is as wide as the widest one needs, times how many there are
      child: IntrinsicWidth(
        child: Row(
          children: [
            for (final (index, child) in children.indexed) ...[
              if (index > 0) const SizedBox(width: 8),
              Expanded(child: child),
            ],
          ],
        ),
      ),
    );
  }
}

/// A dialog's closing actions, in reading order with the main one last. A
/// tablet sets them side by side at the dialog's end, each the same width.
/// A phone's dialog is too narrow for two labelled buttons, so there each
/// takes the full width, the main one on top, as pos_web's dialog footer
/// stacks them.
class DialogActions extends StatelessWidget {
  final List<Widget> children;

  /// On a tablet the actions share the dialog's width instead of sitting at its end
  final bool fill;

  /// Where they sit on a tablet when they do not fill
  final AlignmentGeometry alignment;

  const DialogActions({
    super.key,
    required this.children,
    this.fill = false,
    this.alignment = AlignmentDirectional.centerEnd,
  });

  @override
  Widget build(BuildContext context) {
    if (context.isCompact) {
      return Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (index, child) in children.reversed.indexed) ...[
            if (index > 0) const SizedBox(height: 8),
            child,
          ],
        ],
      );
    }
    if (!fill) return EqualButtons(alignment: alignment, children: children);
    return Row(
      children: [
        for (final (index, child) in children.indexed) ...[
          if (index > 0) const SizedBox(width: 8),
          Expanded(child: child),
        ],
      ],
    );
  }
}

/// The body of a [showPosDialog]: padded like every till dialog, scrolling
/// when the content is taller than the dialog (a tablet's card held to what
/// the keyboard leaves) or when the keyboard covers the lower part of a
/// phone's sheet.
class DialogScroll extends StatelessWidget {
  final Widget child;

  const DialogScroll({super.key, required this.child});

  @override
  Widget build(BuildContext context) {
    final keyboard = _Keyboard.of(context);
    return SingleChildScrollView(
      padding: EdgeInsets.fromLTRB(24, 24, 24, 24 + keyboard),
      child: child,
    );
  }
}

class _Keyboard extends InheritedWidget {
  final double height;

  const _Keyboard({required this.height, required super.child});

  static double of(BuildContext context) => context.dependOnInheritedWidgetOfExactType<_Keyboard>()?.height ?? 0;

  @override
  bool updateShouldNotify(_Keyboard old) => old.height != height;
}
