import 'dart:io';
import '../../features/catalog/models/catalog_item.dart';
import '../../features/catalog/services/catalog_service.dart';
import '../../features/orders/models/order.dart';
import '../../features/orders/services/order_service.dart';
import '../../features/rooms/models/room.dart';
import '../../features/rooms/services/room_service.dart';
import '../../features/sale/models/pos_order_request.dart';
import '../../features/service_requests/models/service_request.dart';
import '../../features/service_requests/services/service_requests_service.dart';
import '../../features/shifts/models/shift.dart';
import '../../features/shifts/services/shifts_service.dart';
import '../../features/tables/models/cafe_table.dart';
import '../../features/tables/services/tables_service.dart';
import '../../features/tickets/models/enums.dart';
import '../../features/tickets/models/move_lines.dart';
import '../../features/tickets/models/open_ticket.dart';
import '../../features/tickets/models/pricing.dart';
import '../../features/tickets/models/refund.dart';
import '../../features/tickets/models/settle.dart';
import '../../features/tickets/models/settled_ticket_summary.dart';
import '../../features/tickets/models/tab_payment.dart';
import '../../features/tickets/models/ticket_detail.dart';
import '../../features/tickets/models/ticket_summary.dart';
import '../../features/tickets/services/tickets_service.dart';
import '../auth/auth_service.dart';
import '../models/branch.dart';
import '../models/localized_text.dart';
import '../services/branch_service.dart';
import '../../features/sale/models/sale_line.dart';

/// Design-time mode: `flutter run --dart-define=POS_DEMO=true`.
///
/// No Keycloak, no backend — a signed-in cashier, one branch and a floor of
/// sample bills, so the screens can be compared against pos_web (and shot
/// for the store listing) on any tablet. Nothing here ships in a release
/// build unless the define is passed.
const bool kDemoMode = bool.fromEnvironment('POS_DEMO');

/// `--dart-define=POS_DEMO_LOCALE=ar` starts the demo in Arabic, so both
/// languages can be captured without touching the settings menu.
const String kDemoLocale = String.fromEnvironment('POS_DEMO_LOCALE');

/// `--dart-define=POS_DEMO_OFFLINE=true` makes the demo's order call fail
/// like a dead network, so the offline sale path can be walked on a tablet.
const bool kDemoOffline = bool.fromEnvironment('POS_DEMO_OFFLINE');

// flutter_riverpod 3 does not export the `Override` type by name, so the
// list's type is inferred from its elements instead of being spelled out.
final _demoTickets = _DemoTicketsRepository();

final demoOverrides = [
  authServiceProvider.overrideWith(_DemoAuthService.new),
  branchRepositoryProvider.overrideWithValue(_DemoBranchRepository()),
  ticketsRepositoryProvider.overrideWithValue(_demoTickets),
  catalogRepositoryProvider.overrideWithValue(_DemoCatalogRepository()),
  orderRepositoryProvider.overrideWithValue(_DemoOrderRepository(_demoTickets)),
  tablesRepositoryProvider.overrideWithValue(_DemoTablesRepository()),
  shiftsRepositoryProvider.overrideWithValue(_DemoShiftsRepository()),
  serviceRequestsRepositoryProvider.overrideWithValue(_DemoServiceRequestsRepository()),
  roomRepositoryProvider.overrideWithValue(_DemoRoomRepository()),
];

class _DemoAuthService extends AuthService {
  @override
  AuthState build() => const AuthState(
        isInitializing: false,
        isAuthenticated: true,
        isPosUser: true,
        isOwner: true,
        userId: 'demo',
        name: 'Demo Cashier',
        roles: ['Cashier'],
        branches: [1, 2],
      );

  @override
  Future<void> initialize() async {}

  @override
  Future<bool> refreshToken() async => true;

  @override
  Future<void> signOut() async {}
}

class _DemoBranchRepository implements BranchRepository {
  @override
  Future<List<Branch>> getBranches() async => [
        Branch(
          id: 1,
          name: LocalizedText.parse({'en': 'Downtown', 'ar': 'وسط البلد'}),
          isActive: true,
          displayOrder: 0,
        ),
        Branch(
          id: 2,
          name: LocalizedText.parse({'en': 'New Cairo', 'ar': 'القاهرة الجديدة'}),
          isActive: true,
          displayOrder: 1,
        ),
      ];

  @override
  Future<Branch> updateBranchSettings(int id, Map<String, dynamic> data) async =>
      (await getBranches()).firstWhere((b) => b.id == id);
}

class _DemoTicketsRepository implements TicketsRepository {
  final Map<int, TicketDetail> _tickets = {
    for (final t in _sampleTickets) t.id: t,
  };
  int _nextReceipt = 1042;

  @override
  Future<List<TicketSummary>> getOpenTickets() async => [
        for (final t in _tickets.values)
          if (t.isOpen)
            TicketSummary(
              id: t.id,
              type: t.type,
              sessionId: t.sessionId,
              roomId: t.roomId,
              tableId: t.tableId,
              locationName: t.locationName,
              label: t.label,
              lineCount: t.lines.length,
              total: t.total,
              openedAt: t.openedAt,
              lastActivityAt: t.openedAt,
            ),
      ];

  @override
  Future<TicketDetail> getTicket(int id) async {
    final ticket = _tickets[id];
    if (ticket == null) throw const TicketNotFound();
    return ticket;
  }

  final Map<int, int> _ticketByOrder = {};
  int _nextOrder = 5000;
  int _nextLine = 100;

  @override
  Future<List<SettledTicketSummary>> getSettledTickets({int pageIndex = 0, int pageSize = 50, int? receiptNumber}) async {
    final settled = _tickets.values.where((t) => t.isSettled && (receiptNumber == null || t.receiptNumber == receiptNumber)).toList()
      ..sort((a, b) => (b.receiptNumber ?? 0).compareTo(a.receiptNumber ?? 0));
    return [
      for (final t in settled.skip(pageIndex * pageSize).take(pageSize))
        SettledTicketSummary(
          id: t.id,
          receiptNumber: t.receiptNumber ?? 0,
          type: t.type,
          locationName: t.locationName,
          label: t.label,
          settledAt: t.settledAt,
          total: t.total,
          refundedTotal: t.refundedTotal,
        ),
    ];
  }

  @override
  Future<PricingView> getPricing(int branchId) async => const PricingView(vatRate: 0.14, pricesIncludeVat: true);

  @override
  Future<int?> getTicketByOrder(int orderId) async => _ticketByOrder[orderId];

  /// What `POST /api/orders/pos` does end to end: the order's lines land on
  /// the named bill, or on a fresh counter one
  int placeOrder(PosOrderRequest request) {
    final orderId = _nextOrder++;
    final lines = [
      for (final line in request.lines)
        TicketLineView(
          id: _nextLine++,
          orderId: orderId,
          description: _lt(line.nameEn, line.nameAr),
          details: _details(line),
          qty: line.quantity.toDouble(),
          unitPrice: line.price,
          total: line.total,
          customerId: request.customer?.id,
          customerName: request.customer?.name,
        ),
    ];
    final target = request.ticketId == null ? null : _tickets[request.ticketId!];
    final id = target?.id ?? (_tickets.keys.fold(100, (m, k) => k > m ? k : m) + 1);
    final all = [...?target?.lines, ...lines];
    final total = all.fold<double>(0, (sum, l) => sum + l.total);
    _tickets[id] = TicketDetail(
      id: id,
      type: target?.type ?? TicketType.counter,
      tableId: target?.tableId,
      locationName: target?.locationName,
      label: target?.label ?? request.customer?.name,
      openedAt: target?.openedAt ?? DateTime.now(),
      subtotal: total,
      total: total,
      lines: all,
    );
    _ticketByOrder[orderId] = id;
    return orderId;
  }

  @override
  Future<int> openTicket(OpenTicketRequest request, {String? requestId}) async {
    final id = _tickets.keys.fold(100, (m, k) => k > m ? k : m) + 1;
    _tickets[id] = TicketDetail(
      id: id,
      type: request.type,
      tableId: request.tableId,
      locationName: request.tableName,
      label: request.label,
      openedAt: DateTime.now(),
    );
    return id;
  }

  @override
  Future<void> discard(int id, {String? requestId}) async {
    final ticket = _tickets[id];
    if (ticket == null) throw const TicketNotFound();
    if (ticket.lines.isNotEmpty) throw const SalesException('Only an empty ticket can be discarded.');
    _tickets.remove(id);
  }

  @override
  Future<int> moveLines(int id, MoveLinesRequest request, {String? requestId}) async {
    final source = _tickets[id];
    if (source == null) throw const TicketNotFound();
    final moving = source.lines.where((l) => request.lineIds.contains(l.id)).toList();
    final staying = source.lines.where((l) => !request.lineIds.contains(l.id)).toList();
    final target = switch (request.target) {
      MoveToTicket(:final ticketId) => _tickets[ticketId] ?? (throw const TicketNotFound()),
      MoveToCounter(:final label) => TicketDetail(id: _nextTicketId(), type: TicketType.counter, label: label, openedAt: DateTime.now()),
      MoveToTable(:final tableId, :final tableName) =>
        TicketDetail(id: _nextTicketId(), type: TicketType.table, tableId: tableId, locationName: tableName, openedAt: DateTime.now()),
      MoveToSplit() => TicketDetail(
          id: _nextTicketId(),
          type: source.type,
          tableId: source.tableId,
          locationName: source.locationName,
          label: source.label,
          openedAt: DateTime.now(),
        ),
    };
    _tickets[id] = _withLines(source, staying);
    _tickets[target.id] = _withLines(target, [...target.lines, ...moving]);
    return target.id;
  }

  @override
  Future<void> assignLinesCustomer(int id,
      {required List<int> lineIds, String? customerId, required String customerName, String? requestId}) async {
    final ticket = _tickets[id];
    if (ticket == null) throw const TicketNotFound();
    _tickets[id] = _withLines(ticket, [
      for (final l in ticket.lines)
        if (lineIds.contains(l.id))
          TicketLineView(
            id: l.id,
            source: l.source,
            orderId: l.orderId,
            description: l.description,
            details: l.details,
            qty: l.qty,
            unitPrice: l.unitPrice,
            discount: l.discount,
            total: l.total,
            customerId: customerId,
            customerName: customerName,
          )
        else
          l,
    ]);
  }

  @override
  Future<void> voidTicket(int id, String reason, {String? requestId}) async {
    final ticket = _tickets[id];
    if (ticket == null) throw const TicketNotFound();
    if (!ticket.isOpen) throw const SalesException('Only an open ticket can be voided.');
    _tickets[id] = TicketDetail(
      id: ticket.id,
      type: ticket.type,
      status: TicketStatus.voided,
      tableId: ticket.tableId,
      locationName: ticket.locationName,
      label: ticket.label,
      openedAt: ticket.openedAt,
      voidedAt: DateTime.now(),
      voidedBy: 'Demo Cashier',
      voidReason: reason,
      subtotal: ticket.subtotal,
      total: ticket.total,
      lines: ticket.lines,
    );
  }

  int _nextRefund = 7;

  int _nextTabPayment = 1;

  @override
  Future<TabPaymentResult> recordTabPayment(TabPaymentRequest request, {String? requestId}) async {
    if (request.tender == PaymentTender.account) throw const SalesException('A tab cannot be paid with itself.');
    if (request.amount <= 0) throw const SalesException('A tab payment must be a positive amount.');
    return TabPaymentResult(id: _nextTabPayment, number: _nextTabPayment++);
  }

  @override
  Future<RefundResult> refund(int id, RefundRequest request, {String? requestId}) async {
    final ticket = _tickets[id];
    if (ticket == null) throw const TicketNotFound();
    if (!ticket.isSettled) throw const SalesException('Only a settled ticket can be refunded.');
    var amount = 0.0;
    final lines = <RefundLineView>[];
    for (final r in request.lines) {
      final line = ticket.lines.firstWhere((l) => l.id == r.lineId);
      final part = line.total * r.qty / line.qty;
      amount += part;
      lines.add(RefundLineView(ticketLineId: line.id, description: line.description, qty: r.qty, amount: part));
    }
    final number = _nextRefund++;
    _tickets[id] = TicketDetail(
      id: ticket.id,
      type: ticket.type,
      status: ticket.status,
      tableId: ticket.tableId,
      locationName: ticket.locationName,
      label: ticket.label,
      openedAt: ticket.openedAt,
      settledAt: ticket.settledAt,
      settledBy: ticket.settledBy,
      receiptNumber: ticket.receiptNumber,
      subtotal: ticket.subtotal,
      total: ticket.total,
      refundedTotal: ticket.refundedTotal + amount,
      change: ticket.change,
      lines: ticket.lines,
      payments: ticket.payments,
      refunds: [
        ...ticket.refunds,
        RefundView(
          id: number,
          number: number,
          amount: amount,
          reason: request.reason,
          tender: request.tender,
          customerName: request.customerName,
          refundedBy: 'Demo Owner',
          refundedAt: DateTime.now(),
          lines: lines,
        ),
      ],
    );
    return RefundResult(number: number, amount: amount);
  }

  int _nextTicketId() => _tickets.keys.fold(100, (m, k) => k > m ? k : m) + 1;

  static TicketDetail _withLines(TicketDetail t, List<TicketLineView> lines) {
    final total = lines.fold<double>(0, (s, l) => s + l.total);
    return TicketDetail(
      id: t.id,
      type: t.type,
      status: t.status,
      sessionId: t.sessionId,
      roomId: t.roomId,
      tableId: t.tableId,
      locationName: t.locationName,
      label: t.label,
      openedAt: t.openedAt,
      subtotal: total,
      total: total,
      lines: lines,
    );
  }

  @override
  Future<SettleResult> settle(int id, SettleRequest request, {String? requestId}) async {
    final ticket = _tickets[id];
    if (ticket == null || !ticket.isOpen) throw const SalesException('This bill is no longer open.');
    final paid = request.payments.fold<double>(0, (s, p) => s + p.amount);
    if (paid < ticket.total) throw const SalesException('The payments do not cover the bill.');
    final receiptNumber = _nextReceipt++;
    _tickets[id] = TicketDetail(
      id: ticket.id,
      type: ticket.type,
      status: TicketStatus.settled,
      locationName: ticket.locationName,
      label: ticket.label,
      openedAt: ticket.openedAt,
      settledAt: DateTime.now(),
      settledBy: 'Demo Cashier',
      receiptNumber: receiptNumber,
      subtotal: ticket.subtotal,
      total: ticket.total,
      change: paid - ticket.total,
      lines: ticket.lines,
      payments: [
        for (final (index, p) in request.payments.indexed)
          PaymentView(id: index + 1, tender: p.tender, amount: p.amount, customerName: p.customerName, recordedAt: DateTime.now()),
      ],
    );
    return SettleResult(receiptNumber: receiptNumber, change: paid - ticket.total);
  }
}


class _DemoOrderRepository implements OrderRepository {
  final _DemoTicketsRepository tickets;
  _DemoOrderRepository(this.tickets);

  final List<Order> _pending = [
    Order(
      id: 3117,
      userName: 'Mariam',
      date: _now.subtract(const Duration(minutes: 4)),
      status: OrderStatus.submitted,
      total: 115,
      tableId: 5,
      tableName: _lt('Table 5', 'ترابيزة 5'),
      customerNote: 'No ice please',
      items: [
        OrderItem(productId: 6, productName: _lt('Iced Americano', 'أمريكانو مثلج'), unitPrice: 45, units: 1),
        OrderItem(productId: 10, productName: _lt('Cheesecake', 'تشيز كيك'), unitPrice: 65, units: 1, specialInstructions: 'Extra fork'),
      ],
    ),
    Order(
      id: 3118,
      date: _now.subtract(const Duration(minutes: 1)),
      status: OrderStatus.submitted,
      total: 110,
      sessionId: 7,
      roomName: _lt('Room 3', 'اوضة 3'),
      guestPhone: '0100 123 4567',
      items: [OrderItem(productId: 1, productName: _lt('Latte', 'لاتيه'), unitPrice: 55, units: 2, customizationsDescription: _lt('Large', 'كبير'))],
    ),
  ];

  @override
  Future<List<Order>> getPendingOrders() async => List.of(_pending);

  @override
  Future<bool> confirmOrder(int orderId, {String? requestId}) async {
    final order = _pending.where((o) => o.id == orderId).firstOrNull;
    if (order == null) return false;
    _pending.remove(order);
    // Confirmed, the lines land on the table's or session's bill
    final target = tickets._tickets.values.where((t) => t.isOpen && (order.tableId != null && t.tableId == order.tableId || order.sessionId != null && t.sessionId == order.sessionId)).firstOrNull;
    if (target != null) {
      tickets._tickets[target.id] = _DemoTicketsRepository._withLines(target, [
        ...target.lines,
        for (final item in order.items)
          TicketLineView(
            id: tickets._nextLine++,
            orderId: order.id,
            description: item.productName,
            details: item.customizationsDescription,
            qty: item.units.toDouble(),
            unitPrice: item.unitPrice,
            total: item.unitPrice * item.units,
            customerName: order.userName,
          ),
      ]);
    }
    return true;
  }

  @override
  Future<bool> cancelOrder(int orderId, {String? requestId}) async {
    _pending.removeWhere((o) => o.id == orderId);
    return true;
  }

  @override
  Future<Order> getOrderDetails(int orderId) async => _pending.firstWhere((o) => o.id == orderId);

  @override
  Future<int> createPosOrder(PosOrderRequest request, {required String requestId}) async {
    await Future<void>.delayed(const Duration(milliseconds: 600));
    if (kDemoOffline) throw const SocketException('demo: the network is down');
    return tickets.placeOrder(request);
  }

  @override
  Future<void> assignOrderCustomer(int orderId,
      {String? customerUserId, required String customerName, String? requestId}) async {}
}

class _DemoShiftsRepository implements ShiftsRepository {
  ShiftView? _current;
  final List<ShiftView> _closed = [
    ShiftView(
      id: 41,
      status: 'Closed',
      openedAt: _now.subtract(const Duration(days: 1, hours: 9)),
      openedBy: 'Sara',
      openingFloat: 500,
      closedAt: _now.subtract(const Duration(days: 1)),
      closedBy: 'Sara',
      closingCount: 2380,
      expectedCash: 2400,
      overShort: -20,
      ticketsSettled: 38,
      salesTotal: 4210,
      tenderTotals: const [
        TenderTotal(tender: PaymentTender.cash, amount: 1900, count: 21),
        TenderTotal(tender: PaymentTender.card, amount: 1710, count: 14),
        TenderTotal(tender: PaymentTender.instaPay, amount: 600, count: 3),
      ],
      changeGiven: 145,
      payInsTotal: 0,
      payOutsTotal: 0,
      expectedInDrawer: 2400,
    ),
  ];
  int _nextId = 42;

  @override
  Future<int> openShift(double openingFloat, {String? requestId}) async {
    if (_current != null) throw const SalesException('A shift is already open.');
    _current = ShiftView(
      id: _nextId++,
      openedAt: DateTime.now(),
      openedBy: 'Demo Cashier',
      openingFloat: openingFloat,
      expectedInDrawer: openingFloat,
    );
    return _current!.id;
  }

  @override
  Future<ShiftView?> getCurrentShift() async => _current;

  @override
  Future<ShiftView> getShift(int id) async {
    if (_current?.id == id) return _current!;
    return _closed.firstWhere((s) => s.id == id, orElse: () => throw const ShiftNotFound());
  }

  @override
  Future<List<ShiftView>> getClosedShifts({int pageIndex = 0, int pageSize = 20}) async =>
      _closed.skip(pageIndex * pageSize).take(pageSize).toList();

  @override
  Future<void> addMovement(int id, CashMovementRequest request, {String? requestId}) async {
    final shift = _current;
    if (shift == null || shift.id != id) throw const SalesException('That shift is not open.');
    final delta = request.type == CashMovementType.payOut ? -request.amount : request.amount;
    _current = _copy(shift,
        movements: [
          ...shift.movements,
          CashMovementView(type: request.type, amount: request.amount, reason: request.reason, recordedBy: 'Demo Cashier', recordedAt: DateTime.now()),
        ],
        payInsTotal: shift.payInsTotal + (delta > 0 ? request.amount : 0),
        payOutsTotal: shift.payOutsTotal + (delta < 0 ? request.amount : 0),
        expectedInDrawer: shift.expectedInDrawer + delta);
  }

  @override
  Future<ShiftView> closeShift(int id, double closingCount, {String? requestId}) async {
    final shift = _current;
    if (shift == null || shift.id != id) throw const SalesException('That shift is not open.');
    final z = _copy(shift,
        status: 'Closed',
        closedAt: DateTime.now(),
        closedBy: 'Demo Cashier',
        closingCount: closingCount,
        expectedCash: shift.expectedInDrawer,
        overShort: closingCount - shift.expectedInDrawer);
    _closed.insert(0, z);
    _current = null;
    return z;
  }

  static ShiftView _copy(
    ShiftView s, {
    String? status,
    DateTime? closedAt,
    String? closedBy,
    double? closingCount,
    double? expectedCash,
    double? overShort,
    List<CashMovementView>? movements,
    double? payInsTotal,
    double? payOutsTotal,
    double? expectedInDrawer,
  }) =>
      ShiftView(
        id: s.id,
        status: status ?? s.status,
        openedAt: s.openedAt,
        openedBy: s.openedBy,
        openingFloat: s.openingFloat,
        closedAt: closedAt ?? s.closedAt,
        closedBy: closedBy ?? s.closedBy,
        closingCount: closingCount ?? s.closingCount,
        expectedCash: expectedCash ?? s.expectedCash,
        overShort: overShort ?? s.overShort,
        movements: movements ?? s.movements,
        ticketsSettled: s.ticketsSettled,
        salesTotal: s.salesTotal,
        tenderTotals: s.tenderTotals,
        changeGiven: s.changeGiven,
        refundsTotal: s.refundsTotal,
        cashRefunds: s.cashRefunds,
        payInsTotal: payInsTotal ?? s.payInsTotal,
        payOutsTotal: payOutsTotal ?? s.payOutsTotal,
        expectedInDrawer: expectedInDrawer ?? s.expectedInDrawer,
      );
}

class _DemoRoomRepository implements RoomRepository {
  final List<Room> _rooms = [
    Room(id: 1, name: _lt('Room 1', 'اوضة 1'), status: RoomStatus.available, singleRate: 60, multiRate: 90),
    Room(id: 2, name: _lt('Room 2', 'اوضة 2'), status: RoomStatus.reserved, singleRate: 60, multiRate: 90),
    Room(id: 3, name: _lt('Room 3', 'اوضة 3'), status: RoomStatus.occupied, singleRate: 80, multiRate: 120),
    Room(id: 4, name: _lt('Room 4', 'اوضة 4'), status: RoomStatus.maintenance, singleRate: 60, multiRate: 90),
  ];
  final List<RoomSession> _sessions = [
    RoomSession(
      id: 7,
      roomId: 3,
      roomName: _lt('Room 3', 'اوضة 3'),
      customerId: 'u1',
      userName: 'Ahmed',
      reservationTime: _now.subtract(const Duration(minutes: 42)),
      startTime: _now.subtract(const Duration(minutes: 42)),
      status: SessionStatus.active,
      singleRate: 80,
      multiRate: 120,
      currentPlayerMode: 'Single',
      singleRoundedHours: 0.5,
      members: [SessionMember(customerId: 'u1', customerName: 'Ahmed', joinedAt: _now.subtract(const Duration(minutes: 42)), role: 'Owner')],
      segments: [SessionSegment(playerMode: 'Single', hourlyRate: 80, startTime: _now.subtract(const Duration(minutes: 42)))],
    ),
    RoomSession(
      id: 8,
      roomId: 2,
      roomName: _lt('Room 2', 'اوضة 2'),
      userName: 'Mona',
      reservationTime: _now.subtract(const Duration(minutes: 3)),
      status: SessionStatus.reserved,
      singleRate: 60,
      multiRate: 90,
      expiresAt: _now.add(const Duration(minutes: 12)),
    ),
  ];
  int _nextSession = 9;

  Room _room(int id) => _rooms.firstWhere((r) => r.id == id);
  RoomSession _session(int id) => _sessions.firstWhere((s) => s.id == id);

  void _setStatus(int roomId, RoomStatus status) {
    final i = _rooms.indexWhere((r) => r.id == roomId);
    _rooms[i] = _rooms[i].copyWith(status: status);
  }

  void _replace(RoomSession next) => _sessions[_sessions.indexWhere((s) => s.id == next.id)] = next;

  RoomSession _copy(RoomSession s, {SessionStatus? status, DateTime? startTime, String? currentPlayerMode, String? userName, String? customerId, List<SessionMember>? members, List<SessionSegment>? segments}) =>
      RoomSession(
        id: s.id,
        roomId: s.roomId,
        roomName: s.roomName,
        customerId: customerId ?? s.customerId,
        userName: userName ?? s.userName,
        reservationTime: s.reservationTime,
        startTime: startTime ?? s.startTime,
        endTime: s.endTime,
        status: status ?? s.status,
        singleRate: s.singleRate,
        multiRate: s.multiRate,
        currentPlayerMode: currentPlayerMode ?? s.currentPlayerMode,
        singleRoundedHours: s.singleRoundedHours,
        multiRoundedHours: s.multiRoundedHours,
        expiresAt: s.expiresAt,
        members: members ?? s.members,
        segments: segments ?? s.segments,
      );

  @override
  Future<({List<Room> rooms, List<RoomSession> activeSessions})> loadRooms() async => (rooms: List.of(_rooms), activeSessions: List.of(_sessions));

  @override
  Future<void> reserveRoom(int roomId) async {
    final room = _room(roomId);
    _sessions.add(RoomSession(
      id: _nextSession++,
      roomId: roomId,
      roomName: room.name,
      reservationTime: DateTime.now(),
      status: SessionStatus.reserved,
      singleRate: room.singleRate,
      multiRate: room.multiRate,
      expiresAt: DateTime.now().add(const Duration(minutes: 15)),
    ));
    _setStatus(roomId, RoomStatus.reserved);
  }

  @override
  Future<void> startSession(int sessionId, {String? playerMode}) async {
    final s = _session(sessionId);
    final now = DateTime.now();
    final mode = playerMode ?? 'Single';
    _replace(_copy(s,
        status: SessionStatus.active,
        startTime: now,
        currentPlayerMode: mode,
        segments: [SessionSegment(playerMode: mode, hourlyRate: mode == 'Multi' ? s.multiRate : s.singleRate, startTime: now)]));
    _setStatus(s.roomId, RoomStatus.occupied);
  }

  @override
  Future<void> startWalkInSession(int roomId, {String? playerMode}) async {
    final room = _room(roomId);
    final now = DateTime.now();
    final mode = playerMode ?? 'Single';
    _sessions.add(RoomSession(
      id: _nextSession++,
      roomId: roomId,
      roomName: room.name,
      reservationTime: now,
      startTime: now,
      status: SessionStatus.active,
      singleRate: room.singleRate,
      multiRate: room.multiRate,
      currentPlayerMode: mode,
      segments: [SessionSegment(playerMode: mode, hourlyRate: mode == 'Multi' ? room.multiRate : room.singleRate, startTime: now)],
    ));
    _setStatus(roomId, RoomStatus.occupied);
  }

  @override
  Future<void> endSession(int sessionId) async {
    final s = _session(sessionId);
    _sessions.removeWhere((x) => x.id == sessionId);
    _setStatus(s.roomId, RoomStatus.available);
  }

  @override
  Future<void> cancelSession(int sessionId) => endSession(sessionId);

  @override
  Future<void> changePlayerMode(int sessionId, String playerMode) async {
    final s = _session(sessionId);
    final now = DateTime.now();
    _replace(_copy(s, currentPlayerMode: playerMode, segments: [
      for (final seg in s.segments)
        seg.endTime == null ? SessionSegment(playerMode: seg.playerMode, hourlyRate: seg.hourlyRate, startTime: seg.startTime, endTime: now) : seg,
      SessionSegment(playerMode: playerMode, hourlyRate: playerMode == 'Multi' ? s.multiRate : s.singleRate, startTime: now),
    ]));
  }

  @override
  Future<void> assignCustomerToSession(int sessionId, String customerId, String? customerName) async {
    final s = _session(sessionId);
    _replace(_copy(s, customerId: customerId, userName: customerName, members: [
      SessionMember(customerId: customerId, customerName: customerName, joinedAt: DateTime.now(), role: 'Owner'),
      ...s.members.where((m) => !m.isOwner),
    ]));
  }

  @override
  Future<void> addMemberToSession(int sessionId, String customerId, String? customerName) async {
    final s = _session(sessionId);
    _replace(_copy(s, members: [...s.members, SessionMember(customerId: customerId, customerName: customerName, joinedAt: DateTime.now(), role: 'Member')]));
  }

  @override
  Future<void> removeMemberFromSession(int sessionId, String customerId) async {
    final s = _session(sessionId);
    _replace(_copy(s, members: s.members.where((m) => m.customerId != customerId).toList()));
  }

  @override
  Future<void> createRoom(Room room) async {}

  @override
  Future<void> updateRoom(Room room) async {}

  @override
  Future<void> deleteRoom(int roomId) async {}

  @override
  Future<RoomSession?> getSession(int sessionId) async => _sessions.where((s) => s.id == sessionId).firstOrNull;

  @override
  Future<List<RoomSession>> getSessionHistory(int roomId, {int limit = 20}) async => const [];
}

class _DemoServiceRequestsRepository implements ServiceRequestsRepository {
  final List<ServiceRequest> _requests = [
    ServiceRequest(
      id: 51,
      userName: 'Ahmed',
      roomId: 3,
      roomName: _lt('Room 3', 'اوضة 3'),
      requestType: ServiceRequestType.controllerChange,
      status: ServiceRequestStatus.pending,
      createdAt: _now.subtract(const Duration(minutes: 2)),
    ),
  ];

  @override
  Future<List<ServiceRequest>> getPendingRequests() async => List.of(_requests);

  @override
  Future<void> acknowledgeRequest(int requestId) async {
    final i = _requests.indexWhere((r) => r.id == requestId);
    if (i < 0) return;
    final r = _requests[i];
    _requests[i] = ServiceRequest(
      id: r.id,
      userName: r.userName,
      roomId: r.roomId,
      roomName: r.roomName,
      requestType: r.requestType,
      status: ServiceRequestStatus.acknowledged,
      createdAt: r.createdAt,
    );
  }

  @override
  Future<void> completeRequest(int requestId) async => _requests.removeWhere((r) => r.id == requestId);
}

class _DemoTablesRepository implements TablesRepository {
  @override
  Future<List<CafeTable>> getTables() async => [
        for (var n = 1; n <= 8; n++) CafeTable(id: n, name: _lt('Table $n', 'ترابيزة $n')),
        CafeTable(id: 9, name: _lt('Garden 1', 'الجنينة 1')),
        CafeTable(id: 10, name: _lt('Garden 2', 'الجنينة 2'), isActive: false),
      ];
}

class _DemoCatalogRepository implements CatalogRepository {
  static const _coffee = 1, _cold = 2, _bakery = 3;

  @override
  Future<List<CatalogCategory>> getCategories() async => [
        CatalogCategory(id: _coffee, name: _lt('Coffee', 'قهوة'), displayOrder: 0),
        CatalogCategory(id: _cold, name: _lt('Cold drinks', 'مشروبات باردة'), displayOrder: 1),
        CatalogCategory(id: _bakery, name: _lt('Bakery', 'مخبوزات'), displayOrder: 2),
      ];

  @override
  Future<List<CatalogItem>> getItems() async => [
        CatalogItem(
          id: 1,
          name: _lt('Latte', 'لاتيه'),
          price: 55,
          catalogTypeId: _coffee,
          customizations: [
            ItemCustomization(
              id: 1,
              name: _lt('Size', 'الحجم'),
              isRequired: true,
              options: [
                CustomizationOption(id: 1, name: _lt('Regular', 'عادي'), isDefault: true),
                CustomizationOption(id: 2, name: _lt('Large', 'كبير'), priceAdjustment: 10, displayOrder: 1),
              ],
            ),
            ItemCustomization(
              id: 2,
              name: _lt('Milk', 'اللبن'),
              displayOrder: 1,
              options: [
                CustomizationOption(id: 3, name: _lt('Oat', 'شوفان'), priceAdjustment: 15),
                CustomizationOption(id: 4, name: _lt('Skimmed', 'خالي الدسم'), displayOrder: 1),
              ],
            ),
          ],
        ),
        CatalogItem(id: 2, name: _lt('Cappuccino', 'كابتشينو'), price: 50, catalogTypeId: _coffee, displayOrder: 1),
        CatalogItem(id: 3, name: _lt('Turkish coffee', 'قهوة تركي'), price: 30, catalogTypeId: _coffee, displayOrder: 2),
        CatalogItem(id: 4, name: _lt('Espresso', 'إسبريسو'), price: 35, catalogTypeId: _coffee, displayOrder: 3),
        CatalogItem(id: 5, name: _lt('Flat white', 'فلات وايت'), price: 55, catalogTypeId: _coffee, displayOrder: 4, isAvailable: false),
        CatalogItem(id: 6, name: _lt('Iced Americano', 'أمريكانو مثلج'), price: 45, catalogTypeId: _cold),
        CatalogItem(id: 7, name: _lt('Sparkling water', 'مياه غازية'), price: 20, catalogTypeId: _cold, displayOrder: 1),
        CatalogItem(id: 8, name: _lt('Fresh orange', 'برتقال فريش'), price: 60, catalogTypeId: _cold, displayOrder: 2),
        CatalogItem(id: 9, name: _lt('Croissant', 'كرواسون'), price: 35, catalogTypeId: _bakery),
        CatalogItem(id: 10, name: _lt('Cheesecake', 'تشيز كيك'), price: 65, catalogTypeId: _bakery, displayOrder: 1),
        CatalogItem(id: 11, name: _lt('Brownie', 'براوني'), price: 50, catalogTypeId: _bakery, displayOrder: 2),
      ];

  @override
  Future<void> setAvailability(int itemId, bool isAvailable, {String? requestId}) async {}
}

LocalizedText _lt(String en, String ar) => LocalizedText.parse({'en': en, 'ar': ar});

/// The chosen options in both languages, the note as typed — what Sales
/// stores on a line from a real POS order
LocalizedText? _details(SaleLine line) {
  String join(Iterable<String> parts) => parts.where((s) => s.isNotEmpty).join(', ');
  final note = line.specialInstructions ?? '';
  final en = join([for (final c in line.customizations) c.optionNameEn, note]);
  final ar = join([for (final c in line.customizations) c.optionNameAr ?? c.optionNameEn, note]);
  return en.isEmpty && ar.isEmpty ? null : LocalizedText(en: en, ar: ar);
}

TicketLineView _line(int id, String en, String ar, double qty, double unitPrice,
        {String? details, String? customerId, String? customerName}) =>
    TicketLineView(
      id: id,
      description: _lt(en, ar),
      details: details == null ? null : LocalizedText.fromString(details),
      qty: qty,
      unitPrice: unitPrice,
      total: qty * unitPrice,
      customerId: customerId,
      customerName: customerName,
    );

final _now = DateTime.now();

final List<TicketDetail> _sampleTickets = [
  TicketDetail(
    id: 98,
    type: TicketType.counter,
    status: TicketStatus.settled,
    label: 'Omar',
    openedAt: _now.subtract(const Duration(hours: 3)),
    settledAt: _now.subtract(const Duration(hours: 2, minutes: 40)),
    settledBy: 'Demo Cashier',
    receiptNumber: 1040,
    subtotal: 105,
    total: 105,
    lines: [_line(90, 'Latte', 'لاتيه', 1, 55), _line(91, 'Brownie', 'براوني', 1, 50)],
    payments: [PaymentView(id: 1, tender: PaymentTender.card, amount: 105, recordedAt: _now.subtract(const Duration(hours: 2, minutes: 40)))],
  ),
  TicketDetail(
    id: 99,
    type: TicketType.table,
    status: TicketStatus.settled,
    tableId: 1,
    locationName: _lt('Table 1', 'ترابيزة 1'),
    openedAt: _now.subtract(const Duration(hours: 2)),
    settledAt: _now.subtract(const Duration(hours: 1, minutes: 10)),
    settledBy: 'Demo Cashier',
    receiptNumber: 1041,
    subtotal: 160,
    total: 160,
    lines: [_line(92, 'Cappuccino', 'كابتشينو', 2, 50), _line(93, 'Fresh orange', 'برتقال فريش', 1, 60)],
    payments: [PaymentView(id: 1, tender: PaymentTender.cash, amount: 200, recordedAt: _now.subtract(const Duration(hours: 1, minutes: 10)))],
    change: 40,
  ),
  TicketDetail(
    id: 101,
    type: TicketType.room,
    sessionId: 7,
    roomId: 3,
    locationName: _lt('Room 3', 'اوضة 3'),
    label: 'Ahmed',
    openedAt: _now.subtract(const Duration(minutes: 42)),
    subtotal: 215,
    total: 215,
    lines: [
      _line(1, 'Latte', 'لاتيه', 2, 55, details: 'Large, oat milk', customerId: 'u1', customerName: 'Ahmed'),
      _line(2, 'Cheesecake', 'تشيز كيك', 1, 65, customerId: 'u1', customerName: 'Ahmed'),
      _line(3, 'Sparkling water', 'مياه غازية', 2, 20),
    ],
  ),
  TicketDetail(
    id: 102,
    type: TicketType.table,
    tableId: 5,
    locationName: _lt('Table 5', 'ترابيزة 5'),
    openedAt: _now.subtract(const Duration(minutes: 18)),
    subtotal: 170,
    total: 170,
    lines: [
      _line(4, 'Cappuccino', 'كابتشينو', 2, 50),
      _line(5, 'Croissant', 'كرواسون', 2, 35),
    ],
  ),
  TicketDetail(
    id: 103,
    type: TicketType.counter,
    label: 'Sara',
    openedAt: _now.subtract(const Duration(minutes: 6)),
    subtotal: 95,
    total: 95,
    lines: [
      _line(6, 'Iced Americano', 'أمريكانو مثلج', 1, 45, details: 'Extra shot'),
      _line(7, 'Brownie', 'براوني', 1, 50),
    ],
  ),
  TicketDetail(
    id: 104,
    type: TicketType.table,
    tableId: 2,
    locationName: _lt('Table 2', 'ترابيزة 2'),
    openedAt: _now.subtract(const Duration(minutes: 3)),
    subtotal: 60,
    total: 60,
    lines: [
      _line(8, 'Turkish coffee', 'قهوة تركي', 2, 30, details: 'Medium sugar'),
    ],
  ),
];
