/// An order number with its hash, read first in either language: a
/// right-to-left mark after the hash lets it take the line's direction, so
/// in Arabic it sits on the number's right and in English stays "#123"
String hashNumber(Object number) => '#\u200f$number';
