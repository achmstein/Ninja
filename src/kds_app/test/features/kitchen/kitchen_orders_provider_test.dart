import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kds_app/features/kitchen/models/kitchen_order.dart';
import 'package:kds_app/features/kitchen/models/kitchen_station.dart';
import 'package:kds_app/features/kitchen/providers/kitchen_orders_provider.dart';
import 'package:kds_app/features/kitchen/providers/station_provider.dart';
import 'package:kds_app/features/kitchen/services/kitchen_service.dart';

/// The server in memory: answers the board, records every tap, and can be
/// held open or made to refuse
class _FakeKitchen implements KitchenRepository {
  List<KitchenOrder> orders = [];
  Object? failWith;
  Completer<void>? gate;
  final List<(int, bool, String)> calls = [];

  /// The station each board fetch and each tap was for; null is the pass
  final List<int?> boardsFor = [];
  final List<int?> tapsFor = [];

  @override
  Future<List<KitchenOrder>> getKitchenOrders({int? stationId}) async {
    boardsFor.add(stationId);
    return List.of(orders);
  }

  @override
  Future<List<KitchenStation>> getStations() async => const [];

  @override
  Future<void> setReady(int orderNumber, bool ready, {int? stationId, required String requestId}) async {
    calls.add((orderNumber, ready, requestId));
    tapsFor.add(stationId);
    if (gate != null) await gate!.future;
    if (failWith != null) throw failWith!;
    orders = [
      for (final order in orders)
        if (order.orderNumber == orderNumber) order.withReadyAt(ready ? DateTime.now().toUtc() : null) else order,
    ];
  }
}

final _now = DateTime.utc(2026, 9, 5, 20, 0);

KitchenOrder order(int number, {required int minutesAgo, DateTime? confirmedAt, DateTime? readyAt}) => KitchenOrder(
      orderNumber: number,
      date: _now.subtract(Duration(minutes: minutesAgo)),
      confirmedAt: confirmedAt,
      readyAt: readyAt,
    );

void main() {
  late _FakeKitchen kitchen;
  late ProviderContainer container;

  setUp(() {
    kitchen = _FakeKitchen();
    container = ProviderContainer(overrides: [kitchenRepositoryProvider.overrideWithValue(kitchen)]);
    // Disposing cancels the poll timer, so the test does not hang on it
    addTearDown(container.dispose);
  });

  test('the board is oldest first by confirmation, the history newest ready first', () async {
    kitchen.orders = [
      order(3, minutesAgo: 2, confirmedAt: _now.subtract(const Duration(minutes: 2))),
      order(1, minutesAgo: 30, confirmedAt: _now.subtract(const Duration(minutes: 10))),
      order(2, minutesAgo: 5, readyAt: _now.subtract(const Duration(minutes: 1))),
      order(4, minutesAgo: 8, readyAt: _now.subtract(const Duration(minutes: 4))),
    ];
    final board = await container.read(kitchenOrdersProvider.future);
    expect([for (final o in board) o.orderNumber], [1, 4, 2, 3]);
    expect([for (final o in openOrders(board)) o.orderNumber], [1, 3]);
    expect([for (final o in finishedOrders(board)) o.orderNumber], [2, 4]);
  });

  test('a station display asks for its own board and readies its own part', () async {
    final grill = ProviderContainer(overrides: [
      kitchenRepositoryProvider.overrideWithValue(kitchen),
      selectedStationIdProvider.overrideWithValue(12),
    ]);
    addTearDown(grill.dispose);
    kitchen.orders = [order(7, minutesAgo: 3)];

    await grill.read(kitchenOrdersProvider.future);
    await grill.read(kitchenOrdersProvider.notifier).setReady(7, true);

    expect(kitchen.boardsFor, everyElement(12));
    expect(kitchen.tapsFor, [12]);
  });

  test('the pass asks for every order whole', () async {
    kitchen.orders = [order(7, minutesAgo: 3)];

    await container.read(kitchenOrdersProvider.future);
    await container.read(kitchenOrdersProvider.notifier).setReady(7, true);

    expect(kitchen.boardsFor, everyElement(isNull));
    expect(kitchen.tapsFor, [null]);
  });

  test('a tap moves the card at once, and each tap carries its own request id', () async {
    kitchen.orders = [order(7, minutesAgo: 3)];
    await container.read(kitchenOrdersProvider.future);
    final notifier = container.read(kitchenOrdersProvider.notifier);

    kitchen.gate = Completer<void>();
    final tap = notifier.setReady(7, true);
    final optimistic = container.read(kitchenOrdersProvider).value!.single;
    expect(optimistic.isReady, isTrue);
    kitchen.gate!.complete();
    await tap;
    expect(container.read(kitchenOrdersProvider).value!.single.readyAt, isNotNull);

    // Bring back: on the board again, the ready time forgotten
    kitchen.gate = null;
    await notifier.setReady(7, false);
    final back = container.read(kitchenOrdersProvider).value!.single;
    expect(back.isReady, isFalse);
    expect(back.readyAt, isNull);

    final ids = [for (final call in kitchen.calls) call.$3];
    expect(ids, hasLength(2));
    expect(ids.every((id) => id.isNotEmpty), isTrue);
    expect(ids.toSet(), hasLength(2));
  });

  test('a refusal puts the card back and surfaces the reason', () async {
    kitchen.orders = [order(9, minutesAgo: 3)];
    await container.read(kitchenOrdersProvider.future);
    final notifier = container.read(kitchenOrdersProvider.notifier);

    kitchen.failWith = StateError('only a confirmed order is in the kitchen');
    await expectLater(notifier.setReady(9, true), throwsStateError);
    final card = container.read(kitchenOrdersProvider).value!.single;
    expect(card.isReady, isFalse);
    expect(card.readyAt, isNull);
    expect(kitchen.calls.single.$2, isTrue);
  });
}
