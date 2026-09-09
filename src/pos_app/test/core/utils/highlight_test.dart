import 'package:flutter/painting.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/core/utils/highlight.dart';

void main() {
  group('matchRanges', () {
    test('marks the start of any word of the name, case and hyphens aside', () {
      expect(matchRanges('Ahmed El-Hady', 'ahm'), [const MatchRange(0, 3)]);
      expect(matchRanges('Ahmed El-Hady', 'hady'), [const MatchRange(9, 13)]);
      expect(matchRanges('Ahmed El-Hady', 'ahmed el'), [const MatchRange(0, 5), const MatchRange(6, 8)], reason: 'each typed word is its own mark');
    });

    test('marks the run-together name across its spaces', () {
      expect(matchRanges('Ahmed El Hady', 'elhady'), [const MatchRange(6, 13)]);
      expect(matchRanges('Abd El Rahman', 'abdelrahman'), [const MatchRange(0, 13)]);
    });

    test('arabic letter variants match each other', () {
      expect(matchRanges('أحمد الهادي', 'احمد'), [const MatchRange(0, 4)]);
      expect(matchRanges('مصطفى', 'مصطفي'), [const MatchRange(0, 5)]);
    });

    test('a word that matches nowhere marks nothing', () {
      expect(matchRanges('Ahmed Samir', 'khaled'), isEmpty);
      expect(matchRanges('Ahmed Samir', 'hmed'), isEmpty, reason: 'a typo the server tolerated is not marked');
    });
  });

  group('phoneRanges', () {
    test('finds the digits inside a spaced phone number', () {
      expect(phoneRanges('+20 100 123 4567', '0100'), [const MatchRange(2, 7)], reason: 'digits match across the spacing, from the first digit');
      expect(phoneRanges('01001234567', '4567'), [const MatchRange(7, 11)]);
      expect(phoneRanges('01001234567', '9'), isEmpty, reason: 'one digit is too little to mark');
      expect(phoneRanges('01001234567', '0199'), isEmpty);
    });
  });

  test('highlightSpans splits the text around the marks', () {
    const mark = TextStyle(fontWeight: FontWeight.w700);
    final spans = highlightSpans('Ahmed El Hady', matchRanges('Ahmed El Hady', 'hady'), mark).cast<TextSpan>();
    expect(spans.map((s) => s.text), ['Ahmed El ', 'Hady']);
    expect(spans.last.style, mark);
    expect(highlightSpans('Ahmed', const [], mark).cast<TextSpan>().single.text, 'Ahmed');
  });
}
