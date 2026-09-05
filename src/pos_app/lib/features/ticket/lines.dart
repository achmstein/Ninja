import 'dart:convert';
import 'package:collection/collection.dart';
import '../tickets/models/ticket_detail.dart';

/// A bill reads by item, not by round. Ordering the same thing twice in an
/// evening writes two lines — two orders, two kitchen tickets, two audit
/// rows, all of which stay exactly as they are underneath — but on screen
/// they add up to "Cappuccino 2 ×". Only identical lines merge: same item,
/// same options, same price, same discount, same origin.
List<TicketLineView> mergeIdenticalLines(List<TicketLineView> lines) {
  final merged = <TicketLineView>[];
  final seen = <String, int>{};

  for (final line in lines) {
    // JSON rather than a delimiter: no separator can collide with an item
    // name, however it is punctuated
    final key = json.encode([
      line.source,
      line.description?.en ?? '',
      line.description?.ar ?? '',
      line.details ?? '',
      line.unitPrice,
      line.discount,
    ]);

    final at = seen[key];
    if (at == null) {
      seen[key] = merged.length;
      merged.add(line);
      continue;
    }

    final first = merged[at];
    merged[at] = TicketLineView(
      id: first.id,
      source: first.source,
      orderId: first.orderId,
      description: first.description,
      details: first.details,
      qty: first.qty + line.qty,
      unitPrice: first.unitPrice,
      discount: first.discount,
      total: first.total + line.total,
      customerId: first.customerId,
      customerName: first.customerName,
      guestId: first.guestId,
    );
  }

  return merged;
}

/// Lines in arrival order, grouped by whoever they were rung up for.
class LineGroup {
  /// One person is one group however they were named: an account holder by
  /// their account, a guest by the id Ordering gave them, and a name the
  /// till was only told by the name itself. Null is the table's own lines.
  final String? key;
  String? name;
  final List<TicketLineView> lines;
  double total;

  LineGroup({required this.key, required this.name, required this.lines, required this.total});

  bool get unattributed => key == null;
}

/// Insertion order keeps the first person named at the top instead of
/// reshuffling the bill every time someone orders again.
List<LineGroup> groupLinesByCustomer(List<TicketLineView> lines) {
  final groups = <LineGroup>[];
  for (final line in lines) {
    final customerId = line.customerId;
    final guestId = line.guestId;
    final customerName = line.customerName;
    final key = customerId != null && customerId.isNotEmpty
        ? 'account:$customerId'
        : guestId != null && guestId.isNotEmpty
            ? 'guest:$guestId'
            : customerName != null && customerName.isNotEmpty
                ? 'name:$customerName'
                : null;
    final name = customerName != null && customerName.isNotEmpty ? customerName : null;
    final existing = groups.firstWhereOrNull((g) => g.key == key);
    if (existing != null) {
      existing.lines.add(line);
      existing.total += line.total;
      existing.name ??= name;
    } else {
      groups.add(LineGroup(key: key, name: name, lines: [line], total: line.total));
    }
  }
  return groups;
}
