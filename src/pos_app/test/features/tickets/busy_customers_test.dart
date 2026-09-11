import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/core/models/localized_text.dart';
import 'package:pos_app/features/rooms/models/room.dart';
import 'package:pos_app/features/sale/models/sale_line.dart';
import 'package:pos_app/features/tickets/busy_customers.dart';
import 'package:pos_app/features/tickets/models/ticket_summary.dart';

RoomSession _session(int id, SessionStatus status, List<String> members) => RoomSession(
      id: id,
      roomId: 1,
      roomName: const LocalizedText(en: 'Room', ar: 'روم'),
      reservationTime: DateTime(2026, 9, 11),
      status: status,
      members: [
        for (final m in members) SessionMember(customerId: m, joinedAt: DateTime(2026, 9, 11), role: 'Member'),
      ],
    );

void main() {
  test('collects the accounts on open bills, in active rooms, and on tabs just opened here', () {
    final busy = customersOnOpenBills(
      openTickets: [
        const TicketSummary(id: 1, customerIds: ['a', 'b']),
        const TicketSummary(id: 2, customerIds: ['b']),
        const TicketSummary(id: 3),
      ],
      activeSessions: [
        _session(10, SessionStatus.active, ['c']),
        // Reserved, not in the room yet: free to open a tab meanwhile
        _session(11, SessionStatus.reserved, ['d']),
      ],
      pending: {
        3: const SaleCustomer(id: 'e', name: 'E'),
        // A tab that is no longer open: its stale link does not block anyone
        99: const SaleCustomer(id: 'f', name: 'F'),
        1: const SaleCustomer(name: 'walk-in'),
      },
    );
    expect(busy, {'a', 'b', 'c', 'e'});
  });

  test('nothing open means nobody is busy', () {
    expect(customersOnOpenBills(openTickets: const [], activeSessions: const []), isEmpty);
  });
}
