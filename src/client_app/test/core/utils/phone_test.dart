import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/utils/phone.dart';

void main() {
  group('normalizePhone', () {
    // The same cases as the server's PhoneRulesTest: one rule, four places
    for (final typed in [
      '01012345678',
      '010 1234 5678',
      '010-1234-5678',
      '(010) 1234.5678',
      '+20 10 1234 5678',
      '+20 010 1234 5678',
      '0020 1012345678',
      '201012345678',
      '1012345678',
      '+0201012345678',
      '+201012345678',
      '٠١٠١٢٣٤٥٦٧٨',
      '+٢٠ ١٠ ١٢٣٤ ٥٦٧٨',
      '۰۱۰۱۲۳۴۵۶۷۸',
    ]) {
      test('an Egyptian mobile typed "$typed" is one number', () {
        expect(normalizePhone(typed, 'EG'), '+201012345678');
        expect(isValidPhone(typed, 'EG'), isTrue);
      });
    }

    test("what a phone's autofill hands over is the number it saved", () {
      for (final filled in ['1110970097', '01110970097', '+20 111 097 0097', '+0201110970097']) {
        expect(normalizePhone(filled, 'EG'), '+201110970097', reason: filled);
      }
    });

    test('a number is read against its own country', () {
      expect(normalizePhone('+966 51 234 5678', 'SA'), '+966512345678');
      expect(normalizePhone('512345678', 'SA'), '+966512345678');
      expect(normalizePhone('051 234 5678', 'SA'), '+966512345678');
      expect(normalizePhone('00971501234567', 'AE'), '+971501234567');
      expect(normalizePhone('07400 123456', 'GB'), '+447400123456');
      expect(normalizePhone('0044 7400 123456', 'gb'), '+447400123456');
    });

    test("a customer's number is a mobile of the business's country", () {
      expect(isValidPhone('+44 7400 123456', 'EG'), isFalse);
      expect(isValidPhone('0512345678', 'EG'), isFalse);
      expect(isValidPhone('01012345678', 'SA'), isFalse);
      expect(isValidPhone('02 2345 6789', 'EG'), isFalse);
      expect(isValidPhone('02012345678', 'EG'), isFalse);
      expect(isValidPhone('0100', 'EG'), isFalse);
      expect(isValidPhone('not-a-number', 'EG'), isFalse);
      expect(isValidPhone('', 'EG'), isFalse);
      expect(isValidPhone(null, 'EG'), isFalse);
    });

    test('what is not a number here comes back without its separators', () {
      expect(normalizePhone('  ', 'EG'), '');
      expect(normalizePhone('ahmed', 'EG'), '');
      expect(normalizePhone('010-1', 'EG'), '0101');
      expect(normalizePhone('+44 7400 123456', 'EG'), '+447400123456');
    });
  });

  group('formatPhone', () {
    test('a kept number is shown the way the country writes it', () {
      expect(formatPhone('+201012345678', 'EG'), '010 12345678');
      expect(formatPhone('01012345678', 'EG'), '010 12345678');
      // A landline shorter than the country's mobiles is not grouped by this library; it still reads the local way
      expect(formatPhone('+20223456789', 'EG'), '0223456789');
      expect(formatPhone('+447400123456', 'EG'), '+44 7400 123456');
    });

    test('what is not a number is left as it is', () {
      expect(formatPhone('19019', 'EG'), '19019');
      expect(formatPhone('ask Ahmed', 'EG'), 'ask Ahmed');
      expect(formatPhone(null, 'EG'), '');
    });
  });
}
