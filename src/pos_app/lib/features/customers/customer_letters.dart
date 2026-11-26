/// The first letters of the customer search: which letter a name is filed
/// under, the strip of letters to jump by, and the order names are listed in.
/// A till in Arabic still has customers written in English, and the other
/// way round, so both alphabets are always in play.
library;

final _letter = RegExp(r'\p{L}', unicode: true);
final _arabic = RegExp(r'[؀-ۿ]');

/// An alef however it is written: with a hamza above or below, a madda, a wasla
const _alefs = {'أ', 'إ', 'آ', 'ا', 'ٱ'};

/// Whether [letter] is written in the Arabic alphabet
bool isArabicLetter(String letter) => _arabic.hasMatch(letter);

/// The letter a name is filed under: its first, an Arabic alef read as one
/// letter however it is written. Empty for a blank name.
String filedUnder(String name) {
  final trimmed = name.trim();
  if (trimmed.isEmpty) return '';
  final first = String.fromCharCode(trimmed.runes.first);
  return _alefs.contains(first) ? 'أ' : first.toUpperCase();
}

/// The letters [names] really start with, each alphabet in its own order and
/// the till's own alphabet first. A name starting with a digit or a sign is
/// under no letter.
List<String> lettersStrip(Iterable<String> names, {required bool arabicFirst}) {
  final letters = {for (final name in names) filedUnder(name)}.where(_letter.hasMatch).toList()..sort();
  return [
    ...letters.where((l) => isArabicLetter(l) == arabicFirst),
    ...letters.where((l) => isArabicLetter(l) != arabicFirst),
  ];
}

// A name as it is sorted: an alef is an alef, and case is nothing
String _sortKey(String name) => name.trim().runes.map((r) {
      final ch = String.fromCharCode(r);
      return _alefs.contains(ch) ? 'ا' : ch.toLowerCase();
    }).join();

/// The order of the list: by name, the till's own alphabet before the other
int compareNames(String a, String b, {required bool arabicFirst}) {
  final first = filedUnder(a), second = filedUnder(b);
  final ours = isArabicLetter(first) == arabicFirst, theirs = isArabicLetter(second) == arabicFirst;
  if (ours != theirs) return ours ? -1 : 1;
  return _sortKey(a).compareTo(_sortKey(b));
}
