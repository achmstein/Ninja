import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/shell/tuck.dart';

/// The port of client_web's use-tuck.test.ts
const _max = 2000.0;

void main() {
  test('keeps the dock whole near the top', () {
    expect(tuckAt(40, _max, 0, false).tucked, isFalse);
    expect(tuckAt(30, _max, 200, true).tucked, isFalse);
  });

  test('tucks once a scroll down runs past the slack', () {
    expect(tuckAt(305, _max, 300, false), (tucked: false, from: 300.0));
    expect(tuckAt(320, _max, 300, false), (tucked: true, from: 320.0));
  });

  test('untucks once a scroll up runs past the slack', () {
    expect(tuckAt(595, _max, 600, true), (tucked: true, from: 600.0));
    expect(tuckAt(580, _max, 600, true), (tucked: false, from: 580.0));
  });

  test('moves the anchor along with a scroll the dock agrees with', () {
    expect(tuckAt(900, _max, 600, true), (tucked: true, from: 900.0));
    expect(tuckAt(500, _max, 600, false), (tucked: false, from: 500.0));
  });

  test('brings the dock back at the end of the page', () {
    expect(tuckAt(_max, _max, 1900, true).tucked, isFalse);
  });
}
