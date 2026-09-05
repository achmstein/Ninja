import '../../../core/models/localized_text.dart';
import 'enums.dart';

/// Where selected lines can go: an open bill, a new counter tab, a free
/// table, or a fresh ticket for the same place (the turnover split, when
/// nothing else is named).
sealed class MoveTarget {
  const MoveTarget();
}

class MoveToSplit extends MoveTarget {
  const MoveToSplit();
}

class MoveToTicket extends MoveTarget {
  final int ticketId;
  const MoveToTicket(this.ticketId);
}

class MoveToCounter extends MoveTarget {
  final String? label;
  const MoveToCounter(this.label);
}

class MoveToTable extends MoveTarget {
  final int tableId;
  final LocalizedText? tableName;
  const MoveToTable(this.tableId, this.tableName);
}

/// `POST /api/tickets/{id}/move-lines`. Both destinations null is the
/// split: Sales opens a fresh ticket for the source's own place.
class MoveLinesRequest {
  final List<int> lineIds;
  final MoveTarget target;

  const MoveLinesRequest({required this.lineIds, required this.target});

  Map<String, dynamic> toJson() => {
        'lineIds': lineIds,
        'targetTicketId': switch (target) {
          MoveToTicket(:final ticketId) => ticketId,
          _ => null,
        },
        'newTicket': switch (target) {
          MoveToCounter(:final label) => {'type': TicketType.counter.value, 'label': label},
          MoveToTable(:final tableId, :final tableName) => {
              'type': TicketType.table.value,
              'tableId': tableId,
              'tableName': tableName?.toJson(),
            },
          _ => null,
        },
      };
}
