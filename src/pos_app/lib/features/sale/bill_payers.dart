import '../tickets/models/ticket_detail.dart';

/// One payer on a bill: a person and their lines, or the bill's own lines
/// that were for nobody
class Payer {
  /// Who they are as the bill keeps them apart: an account, else the name
  /// told, else empty for the lines that were nobody's
  final String key;

  /// Null for the bill's own lines
  final String? name;
  final List<int> lineIds;
  final double subtotal;

  /// Their lines, to say what they had in one line
  final List<TicketLineView> lines;

  const Payer({required this.key, required this.name, required this.lineIds, required this.subtotal, required this.lines});
}

double _round2(double n) => (n * 100).round() / 100;

/// Who could pay their own part of this bill: each person something was sent
/// for, and the lines that were nobody's as the bill's own. The room's time
/// is the room's: it is never one person's own, and is paid with the bill's
/// rest. Lines already paid for are done. Fewer than two, and there is
/// nothing to choose between. The web till's `payersOf` is the same.
List<Payer> payersOf(List<TicketLineView> lines) {
  final keys = <String>[];
  final names = <String, String?>{};
  final theirs = <String, List<TicketLineView>>{};
  for (final line in lines) {
    // Paid for already, or the room's time: neither is anybody's part to pay now
    if (line.source == 'SessionTime' || line.paid) continue;
    final id = line.customerId ?? '';
    final name = line.customerName ?? '';
    final key = id.isNotEmpty ? 'id:$id' : (name.isNotEmpty ? 'name:$name' : '');
    if (!theirs.containsKey(key)) {
      keys.add(key);
      names[key] = name.isEmpty ? null : name;
      theirs[key] = [];
    }
    theirs[key]!.add(line);
  }
  return [
    for (final key in keys)
      Payer(
        key: key,
        name: names[key],
        lineIds: [for (final line in theirs[key]!) line.id],
        subtotal: theirs[key]!.fold(0, (sum, line) => sum + line.total),
        lines: theirs[key]!,
      ),
  ];
}

/// What one payer's items come to with their share of the bill's service,
/// tax and discount: their subtotal, scaled as the bill's total is to all
/// its lines. Nothing when the bill has no lines to share it by
double payerShare(Payer payer, List<TicketLineView> lines, double billTotal) {
  final menu = lines.fold<double>(0, (sum, line) => sum + line.total);
  return menu > 0 ? _round2(payer.subtotal * (billTotal / menu)) : 0;
}

/// What is still to pay: the bill less what was taken in parts already
double billLeftToPay(TicketDetail ticket) {
  final left = _round2(ticket.total - ticket.partPaid);
  return left < 0 ? 0 : left;
}

/// What a customer is likely to hand over for [due] in cash: the exact
/// amount, then the notes it rounds up to. Four at most, each once
List<double> cashNotes(double due) {
  final notes = <double>[due];
  for (final step in const [50, 100, 200]) {
    final note = (due / step).ceil() * step.toDouble();
    if (!notes.contains(note)) notes.add(note);
  }
  return notes.take(4).toList();
}

/// The change out of [handed] for [due]
double changeFor(double handed, double due) => _round2(handed - due);
