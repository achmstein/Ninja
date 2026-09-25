import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/core/utils/name_match.dart';
import 'package:pos_app/core/utils/phone.dart';
import 'package:pos_app/core/utils/whatsapp.dart';

void main() {
  group('normalizePhone', () {
    // The same cases as the server's PhoneRulesTest, so the live check and the 409 agree
    for (final (typed, expected) in [
      ('01012345678', '01012345678'),
      ('010 1234 5678', '01012345678'),
      ('010-1234-5678', '01012345678'),
      ('(010) 1234.5678', '01012345678'),
      ('+20 10 1234 5678', '01012345678'),
      ('+20 010 1234 5678', '01012345678'),
      ('0020 1012345678', '01012345678'),
      ('201012345678', '01012345678'),
      ('1012345678', '01012345678'),
      ('٠١٠١٢٣٤٥٦٧٨', '01012345678'),
      ('+٢٠ ١٠ ١٢٣٤ ٥٦٧٨', '01012345678'),
      ('۰۱۰۱۲۳۴۵۶۷۸', '01012345678'),
    ]) {
      test('an Egyptian mobile typed "$typed" is $expected', () {
        expect(normalizePhone(typed, 'EG'), expected);
      });
    }

    test('a Gulf mobile loses its country code for its trunk zero', () {
      expect(normalizePhone('+966 51 234 5678', 'SA'), '0512345678');
      expect(normalizePhone('512345678', 'SA'), '0512345678');
      expect(normalizePhone('00971501234567', 'AE'), '0501234567');
    });

    test('elsewhere an international number keeps its plus', () {
      expect(normalizePhone('+44 7700 900123', 'GB'), '+447700900123');
      expect(normalizePhone('0044 7700 900123', 'GB'), '+447700900123');
      expect(normalizePhone('07700 900123', 'GB'), '07700900123');
    });

    test('nothing number-like is empty', () {
      expect(normalizePhone('  ', 'EG'), '');
      expect(normalizePhone('ahmed', 'EG'), '');
      expect(normalizePhone('010-1', 'EG'), '0101');
    });
  });

  test('a search reads as a phone when it is mostly digits', () {
    expect(looksLikePhone('0101 234'), isTrue);
    expect(looksLikePhone('٠١٠١'), isTrue);
    expect(looksLikePhone('Ahmed'), isFalse);
    expect(looksLikePhone('Ahmed 2'), isFalse);
  });

  group('WhatsApp', () {
    test('a local mobile gets the café country code', () {
      expect(whatsAppNumber('01012345678', 'EG'), '201012345678');
      expect(whatsAppNumber('0512345678', 'SA'), '966512345678');
      expect(whatsAppNumber('0501234567', 'AE'), '971501234567');
      expect(whatsAppNumber('+447700900123', 'EG'), '447700900123');
      expect(whatsAppNumber('01012345678', 'GB'), '201012345678', reason: 'an Egyptian mobile still reads as one');
    });

    test('the message rides along, spaces and Arabic encoded', () {
      final link = whatsAppLink('010 1234 5678', text: 'أهلاً https://x.test/claim?token=a.b');
      expect(link.toString(), startsWith('https://wa.me/201012345678?text='));
      expect(Uri.decodeComponent(link.query.substring('text='.length)), 'أهلاً https://x.test/claim?token=a.b');
    });
  });

  group('normalizeName', () {
    test('Arabic letter variants, harakat and tatweel do not make a different name', () {
      expect(normalizeName('أَحْمَد'), 'احمد');
      expect(normalizeName('إحمـــد'), 'احمد');
      expect(normalizeName('فاطمة'), normalizeName('فاطمه'));
      expect(normalizeName('مصطفى'), normalizeName('مصطفي'));
      expect(sameName('  Ahmed   El-Hady ', 'ahmed el hady'), isTrue);
      expect(sameName('أحمد', 'محمد'), isFalse);
      expect(sameName('', ''), isFalse);
    });
  });
}
