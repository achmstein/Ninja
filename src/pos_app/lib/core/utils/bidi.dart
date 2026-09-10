/// Wraps [text] in a Unicode first-strong isolate (U+2068 … U+2069) so it
/// is laid out as its own directional unit. A number appended to a
/// mixed-script name (an Arabic room name ending in "VIP", then "#12")
/// otherwise fuses with the Latin word into one left-to-right block, and
/// in an Arabic line the number lands between the two words.
String bidiIsolate(String text) => '\u2068$text\u2069';
