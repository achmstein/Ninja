import 'package:flutter/painting.dart';

/// Where a customer's name matches what the cashier typed, so the eye lands
/// on the right Ahmed. Mirrors the server's matching closely enough to mark
/// the same letters: case and Arabic letter variants are ignored, hyphens
/// read as spaces, every typed word marks the start of a word of the name
/// or of the name run together ("elhady" marks "El Hady"), and digits mark
/// the phone number. A typo the server tolerated marks nothing — the row is
/// still there, just not underlined.
class MatchRange {
  final int start;
  final int end;
  const MatchRange(this.start, this.end);

  @override
  bool operator ==(Object other) => other is MatchRange && other.start == start && other.end == end;

  @override
  int get hashCode => Object.hash(start, end);

  @override
  String toString() => '[$start, $end)';
}

// Same length in and out, so ranges found here index the original text
String _normalizeChar(String ch) => switch (ch) {
      'أ' || 'إ' || 'آ' || 'ٱ' => 'ا',
      'ة' => 'ه',
      'ى' || 'ئ' => 'ي',
      'ؤ' => 'و',
      '-' || '_' => ' ',
      _ => ch.toLowerCase(),
    };

String _normalize(String text) => text.runes.map((r) => _normalizeChar(String.fromCharCode(r))).join();

/// The [start, end) ranges of [text] to mark for [term]. Each typed word is
/// walked from every word boundary of the text, skipping the text's spaces,
/// so a word matches either a word prefix or the run-together name.
List<MatchRange> matchRanges(String text, String term) {
  final source = _normalize(text).runes.map((r) => String.fromCharCode(r)).toList();
  final words = _normalize(term).split(' ').map((w) => w.replaceAll(RegExp("['’.]"), '')).where((w) => w.isNotEmpty).toList();
  if (words.isEmpty || source.isEmpty) return const [];

  final ranges = <MatchRange>[];
  for (final word in words) {
    final letters = word.runes.map((r) => String.fromCharCode(r)).toList();
    for (var start = 0; start < source.length; start++) {
      if (start > 0 && source[start - 1] != ' ') continue;
      if (source[start] == ' ') continue;
      var j = start;
      var k = 0;
      while (k < letters.length && j < source.length) {
        if (source[j] == ' ') {
          j++;
          continue;
        }
        if (source[j] != letters[k]) break;
        j++;
        k++;
      }
      if (k == letters.length) ranges.add(MatchRange(start, j));
    }
  }
  return _merge(ranges);
}

/// The digits of [term] inside [phone], skipping the phone's own spacing.
List<MatchRange> phoneRanges(String phone, String term) {
  final digits = term.replaceAll(RegExp(r'\D'), '');
  if (digits.length < 2) return const [];
  final isDigit = RegExp(r'\d');
  for (var start = 0; start < phone.length; start++) {
    if (!isDigit.hasMatch(phone[start])) continue;
    var j = start;
    var k = 0;
    while (k < digits.length && j < phone.length) {
      if (!isDigit.hasMatch(phone[j])) {
        j++;
        continue;
      }
      if (phone[j] != digits[k]) break;
      j++;
      k++;
    }
    if (k == digits.length) return [MatchRange(start, j)];
  }
  return const [];
}

List<MatchRange> _merge(List<MatchRange> ranges) {
  final sorted = [...ranges]..sort((a, b) => a.start.compareTo(b.start));
  final merged = <MatchRange>[];
  for (final range in sorted) {
    if (merged.isNotEmpty && range.start <= merged.last.end) {
      final last = merged.removeLast();
      merged.add(MatchRange(last.start, range.end > last.end ? range.end : last.end));
    } else {
      merged.add(range);
    }
  }
  return merged;
}

/// [text] as spans, the matched parts in [markStyle].
List<InlineSpan> highlightSpans(String text, List<MatchRange> ranges, TextStyle markStyle) {
  if (ranges.isEmpty) return [TextSpan(text: text)];
  // Ranges index runes; slice by rune so a surrogate pair is never split
  final runes = text.runes.toList();
  String slice(int a, int b) => String.fromCharCodes(runes.sublist(a, b));
  final spans = <InlineSpan>[];
  var cursor = 0;
  for (final range in ranges) {
    if (range.start > cursor) spans.add(TextSpan(text: slice(cursor, range.start)));
    spans.add(TextSpan(text: slice(range.start, range.end), style: markStyle));
    cursor = range.end;
  }
  if (cursor < runes.length) spans.add(TextSpan(text: slice(cursor, runes.length)));
  return spans;
}
