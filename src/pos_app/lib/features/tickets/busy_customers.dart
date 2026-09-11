import '../rooms/models/room.dart';
import '../rooms/status.dart';
import '../sale/models/sale_line.dart';
import 'models/ticket_summary.dart';

/// The accounts that already have a bill running at this branch, so a new tab
/// is never opened for someone who has one: whoever is on an open bill's
/// lines, whoever is in a room right now, and whoever a tab was just opened
/// for on this till but has not ordered yet (that link only lives here until
/// the first round lands — see `pendingTicketCustomer` in the sale feature).
Set<String> customersOnOpenBills({
  required Iterable<TicketSummary> openTickets,
  required Iterable<RoomSession> activeSessions,
  Map<int, SaleCustomer> pending = const {},
}) {
  final ids = <String>{};
  final openIds = <int>{};
  for (final ticket in openTickets) {
    openIds.add(ticket.id);
    ids.addAll(ticket.customerIds);
  }
  for (final session in activeSessions) {
    if (!session.isActive) continue;
    ids.addAll(session.roster.map((m) => m.id));
  }
  for (final entry in pending.entries) {
    final id = entry.value.id;
    if (openIds.contains(entry.key) && id != null && id.isNotEmpty) ids.add(id);
  }
  return ids;
}
