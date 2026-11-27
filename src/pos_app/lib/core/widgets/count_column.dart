import 'package:flutter/widgets.dart';

/// How wide a list's count column is: as wide as its widest count, and never
/// under [min]. One width for every row, so the names beside the counts start
/// in one line whatever the counts are: a room's hours (1.25×) are wider than
/// a whole count (1×), and a column sized for the whole ones either cut them
/// in two or let that one row's name start further in than the rest.
double countColumnWidth(BuildContext context, Iterable<String> counts, TextStyle style, {required double min}) {
  final scaler = MediaQuery.textScalerOf(context);
  var widest = min;
  for (final count in counts.toSet()) {
    final painter = TextPainter(
      text: TextSpan(text: count, style: style),
      textDirection: TextDirection.ltr,
      textScaler: scaler,
      maxLines: 1,
    )..layout();
    final width = painter.width.ceilToDouble();
    painter.dispose();
    if (width > widest) widest = width;
  }
  return widest;
}
