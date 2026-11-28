import 'package:flutter/widgets.dart';
import 'package:forui/forui.dart';

/// The kitchen display's type, as kds_web's roles (its `docs/type.md`): the
/// till's rule on a larger scale. A piece of text says what it IS and takes
/// its size, weight and line from that; nothing on a ticket is sized by
/// hand. A ticket is read at arm's length, so each role is a step larger
/// than its neighbour on the till. Colour is not part of a role.
///
///     Text(place, style: theme.kitchen.place)
///     Text(who, style: theme.kitchen.quiet.copyWith(color: theme.colors.mutedForeground))
class KitchenType {
  final FThemeData _theme;
  const KitchenType(this._theme);

  static const _tabular = [FontFeature.tabularFigures()];

  TextStyle _role(double size, double line, FontWeight weight) =>
      _theme.typography.base.copyWith(fontSize: size, height: line / size, fontWeight: weight);

  /// Where a ticket goes: its one biggest line
  TextStyle get place => _role(22, 28, FontWeight.w700);

  /// How long it has waited: the loudest thing on a ticket
  TextStyle get clock => _role(26, 28, FontWeight.w700).copyWith(fontFeatures: _tabular);

  /// What is made: an item's name, and its count beside it
  TextStyle get item => _role(19, 26, FontWeight.w600);

  /// What goes with an item: its options, what the customer asked for, the order's note
  TextStyle get detail => _role(15, 22, FontWeight.w400);

  /// What is read last: the ticket's number and who to call, the stations it is split between
  TextStyle get quiet => _role(14, 20, FontWeight.w400);

  /// The words on a ticket's button, and its one word of warning
  TextStyle get action => _role(18, 24, FontWeight.w600);
}

extension KitchenTypeTheme on FThemeData {
  /// The kitchen display's type roles
  KitchenType get kitchen => KitchenType(this);
}
