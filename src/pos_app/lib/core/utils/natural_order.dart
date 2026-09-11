/// Orders names the way people read them: digit runs compare by value, so
/// "Room 2" comes before "Room 10" (plain string order puts "10" first),
/// and letter case does not matter. Everything else compares as text.
int naturalCompare(String a, String b) {
  final ra = _runs(a.toLowerCase());
  final rb = _runs(b.toLowerCase());
  for (var i = 0; i < ra.length && i < rb.length; i++) {
    final x = ra[i];
    final y = rb[i];
    final nx = int.tryParse(x);
    final ny = int.tryParse(y);
    final c = nx != null && ny != null ? nx.compareTo(ny) : x.compareTo(y);
    if (c != 0) return c;
  }
  return ra.length.compareTo(rb.length);
}

final _runPattern = RegExp(r'\d+|\D+');

List<String> _runs(String s) => [for (final m in _runPattern.allMatches(s)) m.group(0)!];
