/// Normalize text for menu search: lowercase, strip Arabic harakat + tatweel,
/// and unify letter variants (أإآ→ا, ة→ه, ى→ي, ؤ→و, ئ→ي). Lets "قهوه" match
/// "قهوة" and ignores case — smarter matching without a full fuzzy engine.
/// Mirrors client_web's normalizeSearch (kept small so both apps carry a copy).
String normalizeSearch(String? input) {
  if (input == null || input.isEmpty) return '';
  var s = input.toLowerCase();
  s = s.replaceAll(RegExp('[ً-ْٰـ]'), ''); // harakat + tatweel
  s = s.replaceAll(RegExp('[أإآ]'), 'ا'); // أإآ → ا
  s = s.replaceAll('ى', 'ي'); // ى → ي
  s = s.replaceAll('ؤ', 'و'); // ؤ → و
  s = s.replaceAll('ئ', 'ي'); // ئ → ي
  s = s.replaceAll('ة', 'ه'); // ة → ه
  return s.trim();
}
