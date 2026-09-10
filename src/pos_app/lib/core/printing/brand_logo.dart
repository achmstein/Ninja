import 'dart:ui' as ui;
import 'package:flutter/services.dart' show rootBundle;

/// How wide the wordmark prints, in dots: about half the 544-dot content
/// width of an 80 mm receipt, roughly the height of the old 40 px text
const brandLogoWidth = 280;

Future<ui.Image>? _logo;

/// The "Chillax" wordmark, decoded once at print size. Sheets are painted
/// in a single synchronous pass outside the widget tree, so an
/// `Image.asset` would still be loading when the snapshot is taken; the
/// decoded frame is drawn with `RawImage` instead.
Future<ui.Image> brandLogo() => _logo ??= _load();

Future<ui.Image> _load() async {
  final data = await rootBundle.load('assets/images/logo.png');
  final codec = await ui.instantiateImageCodec(data.buffer.asUint8List(), targetWidth: brandLogoWidth);
  final frame = await codec.getNextFrame();
  codec.dispose();
  return frame.image;
}
