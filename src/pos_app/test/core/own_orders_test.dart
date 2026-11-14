import 'dart:async';
import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/core/orders/own_orders.dart';

void main() {
  test('knows an order whose sale has answered', () async {
    final own = OwnOrders();
    await own.placing(() async => 101);
    expect(await own.isOwn(101), isTrue);
  });

  test("takes an order as someone else's when no sale is on its way", () async {
    expect(await OwnOrders().isOwn(202), isFalse);
  });

  test('waits for a sale in flight before deciding, since the news can beat the answer', () async {
    final own = OwnOrders();
    final answer = Completer<int>();
    final sale = own.placing(() => answer.future);
    final asked = own.isOwn(303);
    answer.complete(303);
    await sale;
    expect(await asked, isTrue);
  });

  test("does not claim another till's order that arrives while a sale is in flight", () async {
    final own = OwnOrders();
    final answer = Completer<int>();
    final sale = own.placing(() => answer.future);
    final asked = own.isOwn(404);
    answer.complete(405);
    await sale;
    expect(await asked, isFalse);
  });

  test('a sale that fails is nobody\'s order, and stops the waiting', () async {
    final own = OwnOrders();
    final asked = own.placing(() async => throw StateError('no connection')).then((_) => true, onError: (_) => false);
    final mine = own.isOwn(505);
    expect(await asked, isFalse);
    expect(await mine, isFalse);
  });

  test('stops waiting for a sale that never answers', () async {
    final own = OwnOrders(wait: const Duration(milliseconds: 20));
    unawaited(own.placing(() => Completer<int>().future));
    expect(await own.isOwn(606), isFalse);
  });
}
