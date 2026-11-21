import 'dart:ui' show FlutterView;

import 'package:flutter/widgets.dart';

import 'device_mode.dart';

/// Where the till folds for a phone. The same lines pos_web draws
/// (Tailwind's `sm` and `md`), so a screen reads the same on both tills:
/// what is side by side on a tablet stacks or moves into a sheet below them.
abstract final class Breakpoints {
  /// Below this a row of labelled buttons no longer fits: labels give way
  /// to icons and rows of actions wrap (pos_web's `max-sm:`)
  static const double compact = 640;

  /// Below this a side panel no longer fits beside the content: it becomes a
  /// sheet or stacks under it (pos_web's `max-md:`, its `useIsMobile`)
  static const double narrow = 768;

  /// A device whose short side is under this is held in the hand, not stood
  /// on a counter: a phone, whichever way it is turned
  static const double phoneShortestSide = 600;
}

extension LayoutWidth on BuildContext {
  /// Too narrow for labelled button rows
  bool get isCompact => foldsForWidth && MediaQuery.sizeOf(this).width < Breakpoints.compact;

  /// Too narrow for a panel beside the content
  bool get isNarrow => foldsForWidth && MediaQuery.sizeOf(this).width < Breakpoints.narrow;
}

/// Whether the device itself is a phone, from the view the app starts in:
/// asked before the first frame, to decide how the screen may turn.
bool isPhoneView(FlutterView view) =>
    view.physicalSize.shortestSide / view.devicePixelRatio < Breakpoints.phoneShortestSide;
