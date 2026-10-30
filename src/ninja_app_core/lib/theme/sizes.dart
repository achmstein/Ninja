import 'package:flutter/widgets.dart';
import 'package:forui/forui.dart';

/// The one scale every staff app (till, kitchen, rider) is built from, so a
/// button, an icon or a heading is the same size wherever it appears. A size
/// that is not here is a size the apps do not use.
abstract final class Sizes {
  // ----- controls: what a finger taps -----

  /// Chips, filter pills, the stepper's buttons, an icon button inside a row
  static const double controlSmall = 40;

  /// Every ordinary button, field and tappable row
  static const double control = 48;

  /// The screen's one main action: Charge, Settle, Open shift, Deliver
  static const double controlLarge = 56;

  /// A column's header row (8 + [control] + 8), so neighbouring headers' rules meet in one line
  static const double header = 64;

  // ----- icons -----

  /// Beside small text, inside a [controlSmall]
  static const double iconSmall = 16;

  /// In an ordinary button or row
  static const double icon = 20;

  /// The way back and the header's own buttons
  static const double iconNav = 24;

  /// An empty or finished state's picture
  static const double iconHero = 48;

  // ----- space -----

  static const double gapXs = 4;
  static const double gapSm = 8;
  static const double gap = 12;
  static const double gapLg = 16;
  static const double gapXl = 24;

  // ----- corners -----

  /// Buttons, fields, rows
  static const double radius = 10;

  /// Cards and dialogs
  static const double radiusCard = 14;
}

/// The text roles, on Forui's type scale: name the role, not the size. The
/// apps use these six and nothing between them.
extension TypeRoles on FTypography {
  /// 12: a timestamp, a count, a hint under a field
  TextStyle get caption => xs;

  /// 14: a label, a secondary line, a small button
  TextStyle get label => sm;

  /// 16: body text, a row's name, an ordinary button
  TextStyle get body => base;

  /// 18: a card's or a dialog's title, the main action's words
  TextStyle get title => lg;

  /// 20: a screen's heading
  TextStyle get heading => xl;

  /// 30: an amount or a number that is the point of the screen
  TextStyle get figure => xl3;
}
