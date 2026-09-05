import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:kds_app/features/kitchen/models/kitchen_order.dart';
import 'package:kds_app/features/kitchen/providers/kitchen_orders_provider.dart';
import 'package:kds_app/features/kitchen/services/kitchen_service.dart';

/// The server in memory: answers the board, records every tap, and can be
/// held open or made to refuse
class _FakeKitchen implements KitchenRepository {
  List<KitchenOrder> orders = [];
  Object? failWith;
  Completer<void>? gate;
  final List<(int, PreparationStatus, String)> calls = [];

  @override
  Future<List<KitchenOrder>> getKitchenOrders() async => List.of(orders);

  @override
  Future<void> setPreparation(int orderNumber, PreparationStatus target, {required String requestId}) async {
    calls.add((orderNumber, target, requestId));
    if (gate != null) await gate!.future;
    if (failWith != null) throw failWith!;
    orders = [
      for (final order in orders)
        if (order.orderNumber == orderNumber)
          order.copyWith(
            preparation: target,
            preparingAt: target == PreparationStatus.preparing ? (order.preparingAt ?? DateTime.now().toUtc()) : order.preparingAt,
            readyAt: target == PreparationStatus.ready ? DateTime.now().toUtc() : null,
            clearReadyAt: target != PreparationStatus.ready,
          )
        else
          order,
    ];
  }
}

final _now = DateTime.utc(2026, 9, 5, 20, 0);

KitchenOrder order(int number, {required int minutesAgo, DateTime? confirmedAt, PreparationStatus preparation = PreparationStatus.notStarted, DateTime? readyAt}) =>
    KitchenOrder(
      orderNumber: number,
      date: _now.subtract(Duration(minutes: minutesAgo)),
      confirmedAt: confirmedAt,
      preparation: preparation,
      preparingAt: preparation == PreparationStatus.notStarted ? null : _now.subtract(Duration(minutes: minutesAgo - 1)),
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

  test('the board is oldest first by confirmation, then split into lanes', () async {
    kitchen.orders = [
      order(3, minutesAgo: 2, confirmedAt: _now.subtract(const Duration(minutes: 2))),
      order(1, minutesAgo: 30, confirmedAt: _now.subtract(const Duration(minutes: 10)), preparation: PreparationStatus.preparing),
      order(2, minutesAgo: 5, preparation: PreparationStatus.ready, readyAt: _now.subtract(const Duration(minutes: 1))),
    ];
    final board = await container.read(kitchenOrdersProvider.future);
    expect([for (final o in board) o.orderNumber], [1, 2, 3]);
    expect(laneOrders(board, PreparationStatus.notStarted).single.orderNumber, 3);
    expect(laneOrders(board, PreparationStatus.preparing).single.orderNumber, 1);
    expect(laneOrders(board, PreparationStatus.ready).single.orderNumber, 2);
  });

  test('a tap moves the card at once, and each tap carries its own request id', () async {
    kitchen.orders = [order(7, minutesAgo: 3)];
    await container.read(kitchenOrdersProvider.future);
    final notifier = container.read(kitchenOrdersProvider.notifier);

    kitchen.gate = Completer<void>();
    final start = notifier.setPreparation(7, PreparationStatus.preparing);
    final optimistic = container.read(kitchenOrdersProvider).value!.single;
    expect(optimistic.preparation, PreparationStatus.preparing);
    expect(optimistic.preparingAt, isNotNull);
    kitchen.gate!.complete();
    await start;

    kitchen.gate = null;
    await notifier.setPreparation(7, PreparationStatus.ready);
    final ready = container.read(kitchenOrdersProvider).value!.single;
    expect(ready.preparation, PreparationStatus.ready);
    expect(ready.readyAt, isNotNull);

    // Recall: back to In progress, the ready time forgotten, the start kept
    await notifier.setPreparation(7, PreparationStatus.preparing);
    final recalled = container.read(kitchenOrdersProvider).value!.single;
    expect(recalled.preparation, PreparationStatus.preparing);
    expect(recalled.readyAt, isNull);
    expect(recalled.preparingAt, isNotNull);

    final ids = [for (final call in kitchen.calls) call.$3];
    expect(ids, hasLength(3));
    expect(ids.every((id) => id.isNotEmpty), isTrue);
    expect(ids.toSet(), hasLength(3));
  });

  test('a refusal puts the card back and surfaces the reason', () async {
    kitchen.orders = [order(9, minutesAgo: 3)];
    await container.read(kitchenOrdersProvider.future);
    final notifier = container.read(kitchenOrdersProvider.notifier);

    kitchen.failWith = StateError('cannot go back to NotStarted');
    await expectLater(notifier.setPreparation(9, PreparationStatus.ready), throwsStateError);
    final card = container.read(kitchenOrdersProvider).value!.single;
    expect(card.preparation, PreparationStatus.notStarted);
    expect(card.readyAt, isNull);
    expect(kitchen.calls.single.$2, PreparationStatus.ready);
  });
}
