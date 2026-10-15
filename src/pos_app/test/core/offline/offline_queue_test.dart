import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_app_core/network/api_client.dart' show branchInZone;
import 'package:ninja_app_core/network/network_status.dart';
import 'package:pos_app/core/offline/offline_kitchen_ticket.dart';
import 'package:pos_app/core/offline/offline_queue.dart';
import 'package:pos_app/core/offline/offline_sale.dart';
import 'package:pos_app/features/orders/models/order.dart';
import 'package:pos_app/features/orders/services/order_service.dart';
import 'package:pos_app/features/sale/models/pos_order_request.dart';
import 'package:pos_app/features/sale/models/sale_line.dart';
import 'package:pos_app/features/tickets/models/enums.dart';
import 'package:pos_app/features/tickets/models/pricing.dart';
import 'package:pos_app/features/tickets/models/settle.dart';
import 'package:pos_app/features/tickets/models/ticket_summary.dart';
import 'package:pos_app/features/tickets/services/tickets_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FakeOrders implements OrderRepository {
  Object? failWith;
  final List<(PosOrderRequest, String)> created = [];

  /// The branch each call would have carried as X-Branch-Id
  final List<int?> branches = [];

  @override
  Future<int> createPosOrder(PosOrderRequest request, {required String requestId}) async {
    if (failWith != null) throw failWith!;
    branches.add(branchInZone);
    created.add((request, requestId));
    return 501;
  }

  @override
  Future<List<Order>> getPendingOrders() async => const [];

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

class _FakeTickets implements TicketsRepository {
  int lookups = 0;
  Object? settleFailsWith;
  final List<(int, SettleRequest, String?)> settled = [];
  final List<int?> branches = [];

  @override
  Future<int?> getTicketByOrder(int orderId) async => ++lookups == 1 ? null : 77;

  @override
  Future<SettleResult> settle(int id, SettleRequest request, {String? requestId}) async {
    if (settleFailsWith != null) throw settleFailsWith!;
    branches.add(branchInZone);
    settled.add((id, request, requestId));
    return const SettleResult(receiptNumber: 1043, change: 0);
  }

  @override
  Future<List<TicketSummary>> getOpenTickets() async => const [];

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

OfflineSale sale(String id, {int branchId = 1, int? shiftId, List<SaleLine>? lines, String note = ''}) => OfflineSale(
      id: id,
      settleRequestId: '$id-settle',
      placedAt: DateTime.utc(2026, 9, 5, 14, 30),
      branchId: branchId,
      shiftId: shiftId,
      provisionalReceiptNumber: 'P-0001',
      lines: lines ?? const [SaleLine(productId: 2, nameEn: 'Cappuccino', nameAr: 'كابتشينو', price: 50, quantity: 2)],
      note: note,
      payments: const [SettlePayment(tender: PaymentTender.cash, amount: 100)],
      subtotal: 100,
      vat: 0,
      total: 100,
      change: 0,
    );

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late _FakeOrders orders;
  late _FakeTickets tickets;
  late ProviderContainer container;

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await initializeOfflineQueue();
    networkStatus.reportSuccess();
    orders = _FakeOrders();
    tickets = _FakeTickets();
    container = ProviderContainer(overrides: [
      orderRepositoryProvider.overrideWithValue(orders),
      ticketsRepositoryProvider.overrideWithValue(tickets),
    ]);
    addTearDown(container.dispose);
  });

  test('a replayed sale is the order dated when it was sold, then the settle dated the same', () async {
    final queue = container.read(offlineQueueProvider.notifier);
    await queue.enqueue(sale('s1'));
    await queue.drain();

    expect(container.read(offlineQueueProvider), isEmpty);
    final (request, requestId) = orders.created.single;
    expect(requestId, 's1');
    expect(request.replay, isTrue);
    expect(request.placedAt, DateTime.utc(2026, 9, 5, 14, 30));
    final (ticketId, settle, settleId) = tickets.settled.single;
    expect(ticketId, 77);
    expect(settleId, 's1-settle');
    expect(settle.settledAt, DateTime.utc(2026, 9, 5, 14, 30));
    expect(settle.provisionalReceiptNumber, 'P-0001');
    expect(settle.payments.single.amount, 100);
  });

  test('a replay is sent for the branch the sale was rung up at, not the one selected now', () async {
    final queue = container.read(offlineQueueProvider.notifier);
    await queue.enqueue(sale('s1', branchId: 4));
    await queue.drain();

    expect(orders.branches, [4]);
    expect(tickets.branches, [4]);
    expect(branchInZone, isNull);
  });

  test('a replay settles against the shift that was open when the sale was made', () async {
    final queue = container.read(offlineQueueProvider.notifier);
    await queue.enqueue(sale('s1', shiftId: 41));
    await queue.drain();

    final (_, settle, _) = tickets.settled.single;
    expect(settle.shiftId, 41);
    expect(settle.toJson()['shiftId'], 41);
  });

  test('a sale queued before the till kept the shift replays without one, as it always did', () async {
    // What an older till left in the queue: no shiftId key at all
    final legacy = sale('s2').toJson()..remove('shiftId');
    final restored = OfflineSale.fromJson(legacy);
    expect(restored.shiftId, isNull);

    final queue = container.read(offlineQueueProvider.notifier);
    await queue.enqueue(restored);
    await queue.drain();

    final (_, settle, _) = tickets.settled.single;
    expect(settle.shiftId, isNull);
    // Left out of the body, so the server falls back to the open shift
    expect(settle.toJson().containsKey('shiftId'), isFalse);
  });

  test('the shift survives the queue being saved and read back', () {
    final restored = OfflineSale.fromJson(sale('s3', shiftId: 7).toJson());
    expect(restored.shiftId, 7);
    expect(restored.copyWith(orderId: 5).shiftId, 7);
  });

  test('the kitchen chit carries the provisional number, the lines and how to make them', () {
    final chit = offlineKitchenTicket(
      sale('s1', note: ' No sugar ', lines: const [
        SaleLine(
          productId: 2,
          nameEn: 'Latte',
          nameAr: 'لاتيه',
          price: 55,
          quantity: 3,
          specialInstructions: 'extra hot',
          customizations: [
            SaleCustomization(customizationId: 1, customizationNameEn: 'Milk', customizationNameAr: 'الحليب', optionId: 9, optionNameEn: 'Oat', optionNameAr: 'شوفان'),
          ],
        ),
      ]),
      title: 'Kitchen · offline',
    );

    expect(chit.numberLabel, 'P-0001');
    expect(chit.stationName.pick('en'), 'Kitchen · offline');
    expect(chit.source, 'Pos');
    expect(chit.customerNote, 'No sugar');
    final line = chit.lines.single;
    expect(line.units, 3);
    expect(line.name.pick('ar'), 'لاتيه');
    expect(line.customizations!.pick('en'), 'Milk: Oat');
    expect(line.customizations!.pick('ar'), 'الحليب: شوفان');
    expect(line.instructions, 'extra hot');
  });

  test('a network still down keeps the sale queued and marks the till offline', () async {
    orders.failWith = const SocketException('down');
    final queue = container.read(offlineQueueProvider.notifier);
    await queue.enqueue(sale('s1'));
    await queue.drain();

    final state = container.read(offlineQueueProvider);
    expect(state.single.status, OfflineSaleStatus.queued);
    expect(networkStatus.online.value, isFalse);
  });

  test('a refusal keeps the sale as failed with the reason, remembering how far it got', () async {
    tickets.settleFailsWith = const SalesException('Payments do not cover the ticket total.');
    final queue = container.read(offlineQueueProvider.notifier);
    await queue.enqueue(sale('s1'));
    await queue.drain();

    final failed = container.read(offlineQueueProvider).single;
    expect(failed.status, OfflineSaleStatus.failed);
    expect(failed.error, 'Payments do not cover the ticket total.');
    expect(failed.orderId, 501);
    expect(failed.ticketId, 77);

    // A retry does not place the order again — it goes straight to the settle
    tickets.settleFailsWith = null;
    await queue.retry('s1');
    expect(container.read(offlineQueueProvider), isEmpty);
    expect(orders.created.length, 1);
    expect(tickets.settled.single.$1, 77);
  });

  test('the queue survives a restart', () async {
    await container.read(offlineQueueProvider.notifier).enqueue(sale('s9'));
    await initializeOfflineQueue();
    final fresh = ProviderContainer();
    addTearDown(fresh.dispose);
    expect(fresh.read(offlineQueueProvider).single.id, 's9');
  });

  test('a counter sale is priced the way Sales prices it', () {
    final inclusive = counterBill(114, const PricingView(vatRate: 0.14, pricesIncludeVat: true));
    expect(inclusive.total, 114);
    expect(inclusive.vat, 14);
    final exclusive = counterBill(100, const PricingView(vatRate: 0.14));
    expect(exclusive.vat, 14);
    expect(exclusive.total, 114);
    expect(inclusive.serviceCharge, 0);
  });
}
