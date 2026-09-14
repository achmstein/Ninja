import '../../core/models/localized_text.dart';
import '../rooms/models/room.dart';
import '../rooms/status.dart';
import '../sale/models/sale_line.dart';
import 'models/enums.dart';
import 'models/ticket_summary.dart';

/// Where an account's running bill is: the place's name when it has one, a
/// tab's label, or just the kind of bill — shown the way the floor titles it.
typedef BillPlace = ({LocalizedText? name, String? label, TicketType? type});

/// The accounts that already have a bill running at this branch, each with
/// where it is, so a new tab is never opened for someone who has one:
/// whoever is on an open bill's lines, whoever is in a room right now, and
/// whoever a tab was just opened for on this till but has not ordered yet
/// (that link only lives here until the first round lands — see
/// `pendingTicketCustomer` in the sale feature).
Map<String, BillPlace> customersOnOpenBills({
  required Iterable<TicketSummary> openTickets,
  required Iterable<RoomSession> activeSessions,
  Map<int, SaleCustomer> pending = const {},
}) {
  final where = <String, BillPlace>{};
  final open = <int, BillPlace>{};
  for (final ticket in openTickets) {
    final place = (name: ticket.locationName, label: ticket.label, type: ticket.type);
    open[ticket.id] = place;
    for (final id in ticket.customerIds) {
      where[id] = place;
    }
  }
  for (final session in activeSessions) {
    if (!session.isActive) continue;
    for (final member in session.roster) {
      where[member.id] = (name: session.roomName, label: null, type: TicketType.room);
    }
  }
  for (final entry in pending.entries) {
    final id = entry.value.id;
    final place = open[entry.key];
    if (place != null && id != null && id.isNotEmpty) where[id] = place;
  }
  return where;
}
