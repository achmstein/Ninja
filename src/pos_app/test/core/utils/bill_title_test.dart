import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/core/models/friendly_day.dart';
import 'package:pos_app/core/utils/bidi.dart';

void main() {
  test('a delivery label is laid out in its parts, any other title isolated whole', () {
    expect(billTitleText('#42 · Mona'), '#\u200f42 · \u2068Mona\u2069');
    expect(billTitleText('#42'), '#\u200f42');
    expect(billTitleText('Table 4'), '\u2068Table 4\u2069');
  });

  test('two moments share a day key only on the same local day', () {
    expect(dayKey(DateTime(2026, 11, 28, 1)), dayKey(DateTime(2026, 11, 28, 23, 59)));
    expect(dayKey(DateTime(2026, 11, 28)), isNot(dayKey(DateTime(2026, 11, 27, 23, 59))));
  });
}
