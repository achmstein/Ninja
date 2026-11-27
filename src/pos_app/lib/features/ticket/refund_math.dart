import '../tickets/models/enums.dart';
import '../tickets/models/ticket_detail.dart';

/// A line that can still come back, and how much of it is left after earlier credit notes
typedef RefundEntry = ({TicketLineView line, double left});

/// A tab that paid this bill: the only tabs a refund can go back onto
typedef RefundHolder = ({String id, String name});

/// What earlier credit notes already took of each line, by line id
Map<int, double> refundedQtyByLine(TicketDetail ticket) {
  final taken = <int, double>{};
  for (final refund in ticket.refunds) {
    for (final line in refund.lines) {
      taken[line.ticketLineId] = (taken[line.ticketLineId] ?? 0) + line.qty;
    }
  }
  return taken;
}

/// The lines a refund can still take from. Discount lines cannot come back on
/// their own; everything else can, up to what is left of it
List<RefundEntry> refundEntries(TicketDetail ticket) {
  final taken = refundedQtyByLine(ticket);
  return [
    for (final line in ticket.lines)
      if (line.total > 0)
        if (line.qty - (taken[line.id] ?? 0) > 0) (line: line, left: line.qty - (taken[line.id] ?? 0)),
  ];
}

/// What is left of the bill to give back
double refundRemainder(TicketDetail ticket) {
  final left = ticket.total - ticket.refundedTotal;
  return left < 0 ? 0 : left;
}

bool everythingPicked(List<RefundEntry> entries, Map<int, double> picked) =>
    entries.isNotEmpty && entries.every((e) => (picked[e.line.id] ?? 0) >= e.left);

/// The server's arithmetic, for the figure shown before the refund is made:
/// each line gives back what was paid for it, service and VAT included; the
/// whole bill gives back the remainder. The server's answer is the one printed
double refundPreview(TicketDetail ticket, List<RefundEntry> entries, Map<int, double> picked) {
  if (everythingPicked(entries, picked)) return refundRemainder(ticket);
  final paidPerMenuPound = ticket.subtotal > 0 ? ticket.total / ticket.subtotal : 1.0;
  var sum = 0.0;
  for (final entry in entries) {
    final count = picked[entry.line.id] ?? 0;
    if (count <= 0) continue;
    final menu = entry.line.total * count / entry.line.qty;
    sum += (menu * paidPerMenuPound * 100).round() / 100;
  }
  return sum;
}

List<RefundHolder> refundHolders(TicketDetail ticket) {
  final holders = <RefundHolder>[];
  for (final payment in ticket.payments) {
    final id = payment.customerId;
    if (payment.tender == PaymentTender.account && id != null && id.isNotEmpty && !holders.any((h) => h.id == id)) {
      holders.add((id: id, name: payment.customerName ?? ''));
    }
  }
  return holders;
}

/// One step of a line's count: a whole one, or a quarter for a count that is not whole (a room's hours)
double refundStep(RefundEntry entry) =>
    entry.left == entry.left.roundToDouble() && entry.line.qty == entry.line.qty.roundToDouble() ? 1 : 0.25;
