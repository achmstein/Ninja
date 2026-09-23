import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_printing/ninja_printing.dart';

/// The server's queue in memory: hands out tickets, grants claims the way
/// the server does, and records what devices report back
class _Queue implements KitchenPrintQueue {
  List<KitchenTicket> tickets;
  final Set<int> claimed = {};
  final List<int> printedJobs = [];
  final List<(int, String)> failures = [];

  _Queue(this.tickets);

  @override
  Future<List<KitchenTicket>> pending() async => tickets.where((t) => !printedJobs.contains(t.jobId)).toList();

  @override
  Future<bool> claim(int jobId, String deviceId) async => claimed.add(jobId);

  @override
  Future<void> printed(int jobId) async {
    printedJobs.add(jobId);
    claimed.remove(jobId);
  }

  @override
  Future<void> failed(int jobId, String error) async {
    failures.add((jobId, error));
    claimed.remove(jobId);
  }
}

/// A printer that keeps what it was sent, or refuses
class _Printer implements EscPosPrinter {
  final List<List<int>> jobs = [];
  final bool refuse;

  _Printer({this.refuse = false});

  @override
  Future<void> send(List<int> bytes) async {
    if (refuse) throw const PrinterException('cannot reach 10.0.0.9:9100 — Connection refused');
    jobs.add(bytes);
  }
}

final _now = DateTime.utc(2026, 9, 24, 20);

KitchenTicket _ticket(int jobId, {String? host = '10.0.0.9', DateTime? claimedAt}) => KitchenTicket(
      jobId: jobId,
      stationId: 3,
      stationName: const TicketText('Shisha', 'الشيشة'),
      printerHost: host,
      createdAt: _now,
      claimedAt: claimedAt,
      orderNumber: 100 + jobId,
    );

KitchenPrintAgent _agent(_Queue queue, _Printer printer, {String device = 'till'}) => KitchenPrintAgent(
      queue: queue,
      deviceId: device,
      render: (ticket) async => [ticket.jobId],
      printerFor: (host, port) => printer,
      now: () => _now,
    );

void main() {
  test('every waiting ticket goes to paper and is reported printed', () async {
    final queue = _Queue([_ticket(1), _ticket(2)]);
    final printer = _Printer();

    final printed = await _agent(queue, printer).drain();

    expect(printed, 2);
    expect(printer.jobs, [
      [1],
      [2],
    ]);
    expect(queue.printedJobs, [1, 2]);
  });

  test('a refused ticket is reported with the reason and let go', () async {
    final queue = _Queue([_ticket(1)]);

    await _agent(queue, _Printer(refuse: true)).drain();

    expect(queue.printedJobs, isEmpty);
    expect(queue.failures.single.$2, contains('Connection refused'));
    expect(queue.claimed, isEmpty, reason: 'any device may try it again');
  });

  test('a ticket another device is printing is left to it', () async {
    final queue = _Queue([_ticket(1, claimedAt: _now.subtract(const Duration(seconds: 10)))]);
    final printer = _Printer();

    await _agent(queue, printer).drain();

    expect(printer.jobs, isEmpty);
  });

  test('a claim left by a device that went quiet is taken over', () async {
    final queue = _Queue([_ticket(1, claimedAt: _now.subtract(const Duration(minutes: 2)))]);
    final printer = _Printer();

    await _agent(queue, printer).drain();

    expect(queue.printedJobs, [1]);
  });

  test('two devices draining at once print each ticket once', () async {
    final queue = _Queue([_ticket(1), _ticket(2), _ticket(3)]);
    final till = _Printer();
    final tablet = _Printer();

    await Future.wait([
      _agent(queue, till, device: 'till').drain(),
      _agent(queue, tablet, device: 'tablet').drain(),
    ]);

    expect(till.jobs.length + tablet.jobs.length, 3);
    expect(queue.printedJobs..sort(), [1, 2, 3]);
  });

  test('a station with no printer address is skipped, not failed', () async {
    final queue = _Queue([_ticket(1, host: null)]);

    await _agent(queue, _Printer()).drain();

    expect(queue.failures, isEmpty);
    expect(queue.claimed, isEmpty);
  });

  test('a drain already running is not started twice', () async {
    final queue = _Queue([_ticket(1)]);
    final agent = _agent(queue, _Printer());

    final results = await Future.wait([agent.drain(), agent.drain()]);

    expect(results, containsAll([1, 0]));
  });

  test('the wire shape reads into a ticket with its station\'s lines', () {
    final ticket = KitchenTicket.fromJson({
      'jobId': '7',
      'stationId': 3,
      'stationName': {'en': 'Shisha', 'ar': 'الشيشة'},
      'printerHost': '192.168.1.60',
      'printerPort': 9100,
      'createdAt': '2026-09-24T20:00:00',
      'isReprint': true,
      'orderNumber': 3121,
      'source': 'Pos',
      'items': [
        {
          'productName': {'en': 'Mint', 'ar': 'نعناع'},
          'units': 2,
          'specialInstructions': 'Extra ice',
        },
      ],
    });

    expect(ticket.jobId, 7);
    expect(ticket.createdAt.isUtc, isTrue);
    expect(ticket.isReprint, isTrue);
    expect(ticket.stationName.pick('ar'), 'الشيشة');
    expect(ticket.lines.single.units, 2);
    expect(ticket.lines.single.instructions, 'Extra ice');
  });
}
