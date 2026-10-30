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
///
/// A search ([aboveKeyboard]) is the exception: what is typed is only worth
/// it for the results under it, so the dialog rises into the space the
/// keyboard leaves, its body sized to that space ([DialogSearchBody]): the
/// field and the first results stay in view, the rest scrolls on its own.
Future<T?> showPosDialog<T>(
  BuildContext context, {
  required WidgetBuilder builder,
  double maxWidth = 448,
  bool aboveKeyboard = false,
}) {
  return showFDialog<T>(
    context: context,
    useRootNavigator: true,
    // Forui's barrier pops on any tap; ours (below) asks about the keyboard first
    barrierDismissible: false,
    builder: (context, style, animation) {
      // Read the keyboard here, above the dialog, then hide it from the
      // dialog so it stays put; the body gets it back through [_Keyboard].
      // A search keeps it, so Forui lifts the dialog clear of the keyboard
      final keyboard = MediaQuery.viewInsetsOf(context).bottom;
      return MediaQuery.removeViewInsets(
        context: context,
        removeBottom: !aboveKeyboard,
        child: _Keyboard(
          height: aboveKeyboard ? 0 : keyboard,
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

/// The body of a search dialog ([showPosDialog] with `aboveKeyboard`): its
/// [header] (title, field) and [footer] (the way out) always in view and
/// the [results] scrolling between them, all within the room the dialog
/// has, which shrinks to the space above the keyboard while it is up.
class DialogSearchBody extends StatelessWidget {
  final Widget header;
  final Widget results;
  final Widget footer;

  const DialogSearchBody({super.key, required this.header, required this.results, required this.footer});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          header,
          Flexible(child: SingleChildScrollView(child: results)),
          footer,
        ],
      ),
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
