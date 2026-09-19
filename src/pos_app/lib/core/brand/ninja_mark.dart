import 'package:flutter/material.dart';
import 'package:forui/forui.dart';

/// The platform's name. Staff-facing apps show Ninja, the product the café
/// runs on; only the customer app (and the paper the till prints) wear the
/// café's own brand.
const String ninjaName = 'Ninja';

/// The platform's mark, square: a rounded tile in the theme's primary with
/// the N. Sized like the old cup; [color] sets the tile where the theme's
/// primary would not read, such as a splash on a fixed background.
class NinjaMark extends StatelessWidget {
  final double size;
  final Color? color;

  const NinjaMark({super.key, required this.size, this.color});

  @override
  Widget build(BuildContext context) {
    final colors = context.theme.colors;
    final fill = color ?? colors.primary;
    final ink = color != null
        ? (ThemeData.estimateBrightnessForColor(fill) == Brightness.dark ? Colors.white : const Color(0xFF18181B))
        : colors.primaryForeground;
    return Container(
      width: size,
      height: size,
      alignment: Alignment.center,
      decoration: BoxDecoration(color: fill, borderRadius: BorderRadius.circular(size * 0.22)),
      child: Text(
        'N',
        style: TextStyle(color: ink, fontSize: size * 0.5, fontWeight: FontWeight.w700, height: 1),
      ),
    );
  }
}
