import 'dart:typed_data';

/// A 1-bit-per-pixel image in printer row order: each row is
/// `bytesPerRow` bytes, most significant bit first, a set bit is a black
/// dot. Exactly the layout `GS v 0` takes.
class MonochromeRaster {
  final int width;
  final int height;
  final Uint8List rows;

  const MonochromeRaster({required this.width, required this.height, required this.rows});

  int get bytesPerRow => (width + 7) >> 3;

  /// Rows `[from, to)` as their own raster, for sending in bands
  MonochromeRaster slice(int from, int to) => MonochromeRaster(
        width: width,
        height: to - from,
        rows: Uint8List.sublistView(rows, from * bytesPerRow, to * bytesPerRow),
      );
}

/// Threshold an RGBA bitmap into printer dots. Anything darker than
/// `threshold` (0–255 luma) prints; transparent pixels count as paper.
/// Receipts are black text on white, so a plain threshold beats dithering:
/// crisp glyphs, no speckle around the Arabic.
MonochromeRaster packMonochrome(Uint8List rgba, int width, int height, {int threshold = 160}) {
  assert(rgba.length >= width * height * 4, 'rgba holds ${rgba.length} bytes, need ${width * height * 4}');
  final bytesPerRow = (width + 7) >> 3;
  final rows = Uint8List(bytesPerRow * height);
  for (var y = 0; y < height; y++) {
    final rowStart = y * bytesPerRow;
    for (var x = 0; x < width; x++) {
      final i = (y * width + x) * 4;
      final a = rgba[i + 3];
      if (a == 0) continue;
      // Composite over white before thresholding, like paper would
      final luma = (0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2]);
      final onPaper = luma * a / 255 + 255 * (1 - a / 255);
      if (onPaper < threshold) {
        rows[rowStart + (x >> 3)] |= 0x80 >> (x & 7);
      }
    }
  }
  return MonochromeRaster(width: width, height: height, rows: rows);
}
