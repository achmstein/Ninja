import 'dart:typed_data';
import 'image_raster.dart';

/// The handful of ESC/POS commands an 80 mm receipt printer needs from a
/// till that prints everything as an image: reset, raster bands, feed, cut
/// and the drawer kick. Bytes only — no printer profile, no code page, no
/// text commands — so Arabic and the layout never depend on the printer.
class EscPosBuilder {
  static const _esc = 0x1B;
  static const _gs = 0x1D;

  /// Rows per `GS v 0` band. One command per band keeps each transfer well
  /// inside any printer's receive buffer; the paper advances between them
  /// without a visible seam.
  static const bandRows = 512;

  final BytesBuilder _bytes = BytesBuilder();

  /// `ESC @` — reset to the printer's defaults
  EscPosBuilder init() {
    _bytes.add(const [_esc, 0x40]);
    return this;
  }

  /// `ESC a 1` — centre what follows (a raster narrower than the paper)
  EscPosBuilder alignCenter() {
    _bytes.add(const [_esc, 0x61, 0x01]);
    return this;
  }

  /// `GS v 0 0 xL xH yL yH d...` — print the bitmap, in bands
  EscPosBuilder raster(MonochromeRaster image) {
    for (var from = 0; from < image.height; from += bandRows) {
      final to = from + bandRows > image.height ? image.height : from + bandRows;
      final band = image.slice(from, to);
      final x = band.bytesPerRow;
      final y = band.height;
      _bytes.add([_gs, 0x76, 0x30, 0x00, x & 0xFF, x >> 8, y & 0xFF, y >> 8]);
      _bytes.add(band.rows);
    }
    return this;
  }

  /// `ESC d n` — feed n lines, so the cut lands past the last row
  EscPosBuilder feed(int lines) {
    _bytes.add([_esc, 0x64, lines.clamp(0, 255)]);
    return this;
  }

  /// `GS V 1` — partial cut, leaving the strip most kitchens prefer
  EscPosBuilder cut() {
    _bytes.add(const [_gs, 0x56, 0x01]);
    return this;
  }

  /// `ESC p 0 25 250` — pulse drawer pin 2 (the usual RJ11 wiring)
  EscPosBuilder kickDrawer() {
    _bytes.add(const [_esc, 0x70, 0x00, 0x19, 0xFA]);
    return this;
  }

  Uint8List toBytes() => _bytes.toBytes();
}
