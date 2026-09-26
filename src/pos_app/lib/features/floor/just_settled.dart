import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../tickets/models/ticket_detail.dart';
import '../tickets/models/ticket_summary.dart';

/// The bill the till settled last, as the floor drew it — held until the
/// floor is next on screen, so it can fold that card away and let the
/// others close the gap instead of the bill having silently vanished while
/// the cashier was on the ticket. Old news after a few minutes.
class JustSettled {
  final TicketSummary ticket;
  final DateTime at;
  const JustSettled(this.ticket, this.at);

  bool get fresh => DateTime.now().difference(at) < const Duration(minutes: 5);
}

class JustSettledNotifier extends Notifier<JustSettled?> {
  @override
  JustSettled? build() => null;

  void settled(TicketDetail ticket) {
    state = JustSettled(
      TicketSummary(
        id: ticket.id,
        type: ticket.type,
        sessionId: ticket.sessionId,
        placeId: ticket.placeId,
        locationName: ticket.locationName,
        label: ticket.label,
        lineCount: ticket.lines.length,
        total: ticket.total,
        openedAt: ticket.openedAt,
      ),
      DateTime.now(),
    );
  }

  /// The floor has shown it leaving
  void shown() => state = null;
}

final justSettledProvider = NotifierProvider<JustSettledNotifier, JustSettled?>(JustSettledNotifier.new);
