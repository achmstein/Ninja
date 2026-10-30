/// Keeps "#123" whole in Arabic: a first-strong isolate stops the hash landing after the number
String bidiIsolate(String text) => '\u2068$text\u2069';
