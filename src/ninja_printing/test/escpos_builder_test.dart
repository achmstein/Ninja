import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_printing/ninja_printing.dart';

void main() {
  test('init, feed, cut and drawer kick are the documented bytes', () {
    final bytes = EscPosBuilder().init().feed(3).cut().kickDrawer().toBytes();
    expect(bytes, [0x1B, 0x40, 0x1B, 0x64, 3, 0x1D, 0x56, 1, 0x1B, 0x70, 0, 25, 250]);
  });

  test('raster writes the GS v 0 header with little-endian byte width and row count', () {
    final image = MonochromeRaster(width: 12, height: 2, rows: Uint8List.fromList([0xFF, 0xF0, 0x0F, 0x00]));
    final bytes = EscPosBuilder().raster(image).toBytes();
    // 12 px → 2 bytes per row, 2 rows
    expect(bytes.sublist(0, 8), [0x1D, 0x76, 0x30, 0x00, 2, 0, 2, 0]);
    expect(bytes.sublist(8), [0xFF, 0xF0, 0x0F, 0x00]);
  });

  test('a tall raster goes out in bands of at most 512 rows', () {
    const height = 1100;
    final image = MonochromeRaster(width: 8, height: height, rows: Uint8List(height));
    final bytes = EscPosBuilder().raster(image).toBytes();
    final headers = <List<int>>[];
    var i = 0;
    while (i < bytes.length) {
      headers.add(bytes.sublist(i, i + 8));
      final rows = bytes[i + 6] | (bytes[i + 7] << 8);
      i += 8 + rows;
    }
    expect(headers.map((h) => h[6] | (h[7] << 8)), [512, 512, 76]);
    expect(i, bytes.length);
  });
}
