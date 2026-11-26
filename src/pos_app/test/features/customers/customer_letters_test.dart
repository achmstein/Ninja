import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/features/customers/customer_letters.dart';

void main() {
  group('the letter a name is filed under', () {
    test('is its first, in capitals', () {
      expect(filedUnder('ahmed'), 'A');
      expect(filedUnder('  Mona Ali'), 'M');
      expect(filedUnder('محمد'), 'م');
    });

    test('an Arabic alef is one letter however it is written', () {
      for (final name in ['أحمد', 'إبراهيم', 'آدم', 'احمد', 'ٱلله']) {
        expect(filedUnder(name), 'أ', reason: name);
      }
    });

    test('a blank name is under nothing', () {
      expect(filedUnder('   '), '');
    });
  });

  group('the strip of letters', () {
    const names = ['Mona', 'ahmed', 'Ali', 'محمد', 'أحمد', 'إيمان', 'بسمة', '0100', ''];

    test('holds only letters somebody starts with, once each, each alphabet in order', () {
      expect(lettersStrip(names, arabicFirst: false), ['A', 'M', 'أ', 'ب', 'م']);
    });

    test("starts with the till's own alphabet", () {
      expect(lettersStrip(names, arabicFirst: true), ['أ', 'ب', 'م', 'A', 'M']);
    });
  });

  test("names are listed by name, the till's alphabet first, an alef as an alef", () {
    final names = ['Mona', 'إيمان', 'ahmed', 'احمد', 'بسمة'];
    expect([...names]..sort((a, b) => compareNames(a, b, arabicFirst: false)), ['ahmed', 'Mona', 'احمد', 'إيمان', 'بسمة']);
    expect([...names]..sort((a, b) => compareNames(a, b, arabicFirst: true)), ['احمد', 'إيمان', 'بسمة', 'ahmed', 'Mona']);
  });
}
