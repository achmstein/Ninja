import 'dart:typed_data';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_printing/ninja_printing.dart';

void main() {
  test('packs a 4×2 RGBA bitmap into one byte per row, MSB first, black = 1', () {
    final rgba = Uint8List.fromList([
      // row 0: black, white, transparent, dark grey
      0, 0, 0, 255, 255, 255, 255, 255, 0, 0, 0, 0, 100, 100, 100, 255,
      // row 1: white, white, light grey, half-transparent black (reads as grey on paper)
      255, 255, 255, 255, 255, 255, 255, 255, 200, 200, 200, 255, 0, 0, 0, 128,
    ]);
    final raster = packMonochrome(rgba, 4, 2);
    expect(raster.bytesPerRow, 1);
    expect(raster.rows, [0x90, 0x10]);
  });

  test('rows are padded to whole bytes and slices keep the row stride', () {
    final width = 10, height = 3;
    final rgba = Uint8List(width * height * 4);
    for (var i = 3; i < rgba.length; i += 4) {
      rgba[i] = 255; // opaque black everywhere
    }
    final raster = packMonochrome(rgba, width, height);
    expect(raster.bytesPerRow, 2);
    expect(raster.rows, [0xFF, 0xC0, 0xFF, 0xC0, 0xFF, 0xC0]);
    final slice = raster.slice(1, 3);
    expect(slice.height, 2);
    expect(slice.rows, [0xFF, 0xC0, 0xFF, 0xC0]);
  });
}
