import 'package:flutter/material.dart';
import 'package:forui/forui.dart';

/// A dialog the keyboard slides over rather than pushes. It keeps its place
/// and its height when the keyboard opens; the body, a [DialogScroll],
/// gains that much bottom slack so whatever the keyboard covers can be
/// scrolled up into the part still showing. Forui's default would shove
/// the dialog up and squeeze it into the half of a landscape tablet the
/// keyboard leaves — less than most dialogs need.
///
/// A tap anywhere that is not a control while the keyboard is up — the
/// dimmed screen or the dialog's own blank space — only puts the keyboard
/// away: the cashier tapped to see the dialog again, not to throw away what
/// they typed. With no keyboard up, a tap outside dismisses, as before.
Future<T?> showPosDialog<T>(
  BuildContext context, {
  required WidgetBuilder builder,
  double maxWidth = 448,
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
      return MediaQuery.removeViewInsets(
        context: context,
        removeBottom: true,
        child: _Keyboard(
          height: keyboard,
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
                child: FDialog.raw(
                  style: style,
                  animation: animation,
                  constraints: BoxConstraints(maxWidth: maxWidth),
                  builder: (context, _) => builder(context),
                ),
              ),
            ],
          ),
        ),
      );
    },
  );
}

/// The body of a [showPosDialog]: padded like every till dialog, scrolling
/// when the content is taller than the dialog or when the keyboard covers
/// its lower part.
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
