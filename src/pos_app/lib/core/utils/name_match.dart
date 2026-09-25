/// A name as the server's NameSearch compares it: lower case, Arabic
/// diacritics (harakat) and tatweel removed, the letter variants that are
/// spelled either way unified (أ إ آ ٱ → ا, ة → ه, ى ئ → ي, ؤ → و),
/// apostrophes and dots dropped, hyphens and underscores read as spaces,
/// whitespace collapsed. Two names equal after this are "the same name".
String normalizeName(String? text) {
  if (text == null) return '';
  final out = StringBuffer();
  var lastWasSpace = true;
  for (final rune in text.toLowerCase().runes) {
    // Arabic harakat, superscript alef, tatweel
    if ((rune >= 0x064B && rune <= 0x065F) || rune == 0x0670 || rune == 0x0640) continue;
    final ch = switch (String.fromCharCode(rune)) {
      'أ' || 'إ' || 'آ' || 'ٱ' => 'ا',
      'ة' => 'ه',
      'ى' || 'ئ' => 'ي',
      'ؤ' => 'و',
      '\'' || '’' || '.' => '',
      '-' || '_' => ' ',
      final c => c,
    };
    if (ch.isEmpty) continue;
    if (ch.trim().isEmpty) {
      if (!lastWasSpace) out.write(' ');
      lastWasSpace = true;
      continue;
    }
    out.write(ch);
    lastWasSpace = false;
  }
  return out.toString().trim();
}

/// Whether two names read the same once spelling variants are set aside
bool sameName(String a, String b) {
  final left = normalizeName(a);
  return left.isNotEmpty && left == normalizeName(b);
}
