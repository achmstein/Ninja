import 'dart:ui';

import 'package:flutter/painting.dart' show HSLColor;

/// The compact sale pad marks each item with its category's colour down the
/// tile's start edge, so a cashier finds the drinks or the grills by colour
/// in a long run of text tiles. Nobody picks it: it comes from the
/// category's id, so it is the same on every till and after every restart
/// (pos_web's category-colour.ts spaces the hues the same way).
///
/// The golden angle puts consecutive ids far apart on the colour wheel; a
/// middle lightness reads as a colour on a white card and on a dark one.
Color categoryColour(int categoryId) {
  final hue = ((categoryId * 137.508) % 360 + 360) % 360;
  return HSLColor.fromAHSL(1, hue, 0.6, 0.55).toColor();
}

/// How many compact tiles to a row for the menu's own width (not the
/// screen's): six beside the sale on a 1280 tablet, eight on a 1920 one, and
/// on anything narrower as many as fit at 112 wide.
int compactColumns(double width, {double gap = 8}) {
  if (width >= 1280) return 8;
  if (width >= 1024) return 7;
  if (width >= 768) return 6;
  final fit = (width + gap) ~/ (112 + gap);
  return fit < 1 ? 1 : fit;
}
