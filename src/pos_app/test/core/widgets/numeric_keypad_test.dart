import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/core/widgets/numeric_keypad.dart';

void main() {
  group('applyKeypadKey', () {
    test('digits append', () {
      expect(applyKeypadKey('', '1'), '1');
      expect(applyKeypadKey('1', '2'), '12');
    });

    test('a bare leading zero is replaced, not built on', () {
      expect(applyKeypadKey('0', '5'), '5');
      expect(applyKeypadKey('0', '0'), '0');
    });

    test('one decimal point, and a leading point becomes 0.', () {
      expect(applyKeypadKey('', '.'), '0.');
      expect(applyKeypadKey('12', '.'), '12.');
      expect(applyKeypadKey('12.', '.'), '12.');
      expect(applyKeypadKey('12.5', '.'), '12.5');
    });

    test('00 does nothing on an empty or zero value', () {
      expect(applyKeypadKey('', '00'), '');
      expect(applyKeypadKey('0', '00'), '0');
      expect(applyKeypadKey('5', '00'), '500');
    });

    test('backspace removes the last character', () {
      expect(applyKeypadKey('12.5', 'backspace'), '12.');
      expect(applyKeypadKey('', 'backspace'), '');
    });

    test('nine characters is the ceiling', () {
      expect(applyKeypadKey('123456789', '0'), '123456789');
      expect(applyKeypadKey('12345678', '00'), '123456780');
    });
  });
}
