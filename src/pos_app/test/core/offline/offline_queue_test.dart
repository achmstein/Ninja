import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/core/network/network_status.dart';
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

  @override
  Future<int> createPosOrder(PosOrderRequest request, {required String requestId}) async {
    if (failWith != null) throw failWith!;
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

  @override
  Future<int?> getTicketByOrder(int orderId) async => ++lookups == 1 ? null : 77;

  @override
  Future<SettleResult> settle(int id, SettleRequest request, {String? requestId}) async {
    if (settleFailsWith != null) throw settleFailsWith!;
    settled.add((id, request, requestId));
    return const SettleResult(receiptNumber: 1043, change: 0);
  }

  @override
  Future<List<TicketSummary>> getOpenTickets() async => const [];

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

OfflineSale sale(String id) => OfflineSale(
      id: id,
      settleRequestId: '$id-settle',
      placedAt: DateTime.utc(2026, 9, 5, 14, 30),
      branchId: 1,
      provisionalReceiptNumber: 'P-0001',
      lines: const [SaleLine(productId: 2, nameEn: 'Cappuccino', nameAr: 'كابتشينو', price: 50, quantity: 2)],
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
