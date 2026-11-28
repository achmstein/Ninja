import 'package:flutter/widgets.dart';
import 'package:forui/forui.dart';

/// The kitchen display's type, as kds_web's roles (its `docs/type.md`): the
/// till's rule at the till's own sizes. A piece of text says what it IS and
/// takes its size, weight and line from that; nothing on a ticket is sized
/// by hand. Each role was a step larger, for reading at arm's length, and
/// the board read as loud: weight and colour carry a ticket now, not size.
/// Colour is not part of a role.
///
///     Text(place, style: theme.kitchen.place)
///     Text(who, style: theme.kitchen.quiet.copyWith(color: theme.colors.mutedForeground))
class KitchenType {
  final FThemeData _theme;
  const KitchenType(this._theme);

  static const _tabular = [FontFeature.tabularFigures()];

  TextStyle _role(double size, double line, FontWeight weight) =>
      _theme.typography.base.copyWith(fontSize: size, height: line / size, fontWeight: weight);

  /// Where a ticket goes: its first line
  TextStyle get place => _role(17, 24, FontWeight.w600);

  /// How long it has waited, no larger than the place: its colour says late
  TextStyle get clock => _role(17, 24, FontWeight.w600).copyWith(fontFeatures: _tabular);

  /// What is made: an item's name, and its count beside it
  TextStyle get item => _role(16, 24, FontWeight.w500);

  /// What goes with an item: its options, what the customer asked for, the order's note
  TextStyle get detail => _role(14, 20, FontWeight.w400);

  /// What is read last: the ticket's number and who to call, the stations it is split between
  TextStyle get quiet => _role(13, 20, FontWeight.w400);

  /// The words on a ticket's button, and its one word of warning
  TextStyle get action => _role(15, 20, FontWeight.w600);
}

extension KitchenTypeTheme on FThemeData {
  /// The kitchen display's type roles
  KitchenType get kitchen => KitchenType(this);
}
