import 'package:flutter/material.dart';
import 'package:intl/intl.dart' show DateFormat;
import '../../core/theme/app_theme.dart';

/// Paper width in printer dots: 72 mm at 203 dpi, the printable width of
/// every 80 mm thermal printer. Sheets are laid out at this size 1:1.
const receiptWidth = 576.0;

const sheetInk = Color(0xFF000000);
const sheetPaper = Color(0xFFFFFFFF);

/// `dateStyle: short, timeStyle: short` for the printed sheets
String sheetDate(DateTime value, Locale locale) => DateFormat.yMd(locale.toString()).add_Hm().format(value.toLocal());

/// White paper, black ink, the language's font, the language's direction.
/// Everything the rasterizer's bare tree does not provide.
class Paper extends StatelessWidget {
  final Locale locale;
  final List<Widget> children;

  const Paper({super.key, required this.locale, required this.children});

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: locale.languageCode == 'ar' ? TextDirection.rtl : TextDirection.ltr,
      child: DefaultTextStyle(
        style: TextStyle(
          fontFamily: getFontFamily(locale),
          fontSize: 24,
          height: 1.3,
          color: sheetInk,
          fontFeatures: const [FontFeature.tabularFigures()],
        ),
        child: ColoredBox(
          color: sheetPaper,
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 24, 16, 32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: children,
            ),
          ),
        ),
      ),
    );
  }
}

class SheetCentered extends StatelessWidget {
  final List<Widget> children;
  const SheetCentered({super.key, required this.children});

  @override
  Widget build(BuildContext context) => Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [for (final child in children) DefaultTextStyle.merge(textAlign: TextAlign.center, child: child)],
      );
}

/// Label on the start side, amount on the end side, never wrapping into
/// each other
class SheetRow extends StatelessWidget {
  final String label;
  final String value;
  final double size;
  final FontWeight weight;

  const SheetRow(this.label, this.value, {super.key, this.size = 24, this.weight = FontWeight.w400});

  @override
  Widget build(BuildContext context) {
    final style = TextStyle(fontSize: size, fontWeight: weight);
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(child: Text(label, style: style)),
        const SizedBox(width: 12),
        Text(value, style: style),
      ],
    );
  }
}

class Dashes extends StatelessWidget {
  const Dashes({super.key});

  @override
  Widget build(BuildContext context) => const CustomPaint(size: Size(double.infinity, 2), painter: _DashPainter());
}

class _DashPainter extends CustomPainter {
  const _DashPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = sheetInk
      ..strokeWidth = 2;
    for (var x = 0.0; x < size.width; x += 12) {
      canvas.drawLine(Offset(x, 1), Offset(x + 6 > size.width ? size.width : x + 6, 1), paint);
    }
  }

  @override
  bool shouldRepaint(_DashPainter oldDelegate) => false;
}
