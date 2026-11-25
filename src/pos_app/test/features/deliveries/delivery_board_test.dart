import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/features/deliveries/models/delivery_board.dart';
import 'package:pos_app/features/deliveries/models/delivery_order.dart';

DeliveryOrder _order(int number, {String stage = 'Waiting', String? rider, double total = 100, String? cashIn}) => DeliveryOrder.fromJson({
      'orderNumber': number,
      'total': total,
      'delivery': {
        'address': 'Road 9',
        'phone': '01001234567',
        'stage': stage,
        'riderUserId': rider,
        'riderName': rider?.toUpperCase(),
        'cashHandedInAt': cashIn,
      },
    });

DeliveryOrder _withCourier(int number, {String stage = 'Assigned', double? collected, double? toCollect}) => DeliveryOrder.fromJson({
      'orderNumber': number,
      'total': 115,
      'toCollect': toCollect ?? 115,
      'delivery': {
        'address': 'Road 9',
        'phone': '01001234567',
        'stage': stage,
        'courierProviderId': 7,
        'courierProvider': 'Fast Couriers',
        'courierName': 'Hassan',
        'courierFee': 30,
        'courierCollected': collected,
      },
    });

void main() {
  group('the board', () {
    test('reads a courier company that has it, and names it as the till would', () {
      final d = _withCourier(1).delivery;
      expect(d.hasCourier, isTrue);
      expect(d.courierFee, 30);
      expect(d.holderName, 'Fast Couriers · Hassan');
      expect(_withCourier(2, toCollect: 0).toCollect, 0, reason: 'paid online ahead: nothing to collect');
    });

    test('takes a courier delivery off the board once its collection is said: nothing is taken in at the till', () {
      final lanes = byLane([_withCourier(1), _withCourier(2, stage: 'Delivered', collected: 115), _withCourier(3, stage: 'Delivered', collected: 0)]);
      expect(lanes[BoardLane.withRiders]!.map((o) => o.orderNumber), [1]);
      expect(lanes[BoardLane.cashDue], isEmpty);
    });

    test('groups a courier company apart from the riders, under its name', () {
      final groups = byRider([_order(1, stage: 'Assigned', rider: 'ali'), _withCourier(2), _withCourier(3, stage: 'OnTheWay')]);
      expect(groups.map((g) => g.riderName), ['ALI', 'Fast Couriers']);
      expect(groups[1].orders.map((o) => o.orderNumber), [2, 3]);
    });

    test('puts each delivery in its column, coming back holding both failed and returned, settled ones off it', () {
      final lanes = byLane([
        _order(1),
        _order(2, stage: 'Assigned', rider: 'ali'),
        _order(3, stage: 'OnTheWay', rider: 'ali'),
        _order(4, stage: 'Failed', rider: 'omar'),
        _order(5, stage: 'Returned', rider: 'omar'),
        _order(6, stage: 'Delivered', rider: 'ali'),
        _order(7, stage: 'Delivered', rider: 'ali', cashIn: '2026-10-06T10:00:00Z'),
      ]);
      expect(lanes[BoardLane.waiting]!.map((o) => o.orderNumber), [1]);
      expect(lanes[BoardLane.withRiders]!.map((o) => o.orderNumber), [2, 3]);
      expect(lanes[BoardLane.comingBack]!.map((o) => o.orderNumber), [4, 5]);
      expect(lanes[BoardLane.cashDue]!.map((o) => o.orderNumber), [6]);
    });

    test('groups a column by rider, each rider once in the order they first stand, with what they owe', () {
      final groups = byRider([
        _order(1, stage: 'Delivered', rider: 'ali', total: 120),
        _order(2, stage: 'Delivered', rider: 'omar', total: 80),
        _order(3, stage: 'Delivered', rider: 'ali', total: 95.5),
        _order(4, stage: 'Delivered'),
      ]);
      expect(groups.map((g) => g.riderName), ['ALI', 'OMAR', null]);
      expect(groups.first.orders.map((o) => o.orderNumber), [1, 3]);
      expect(groups.first.total, 215.5);
      expect(groups.last.riderUserId, isNull, reason: 'no rider named: a group of its own, not lost');
    });
  });

  group('a rider\'s hand-in', () {
    final orders = [
      _order(1, stage: 'Delivered', rider: 'ali', total: 120),
      _order(2, stage: 'Delivered', rider: 'ali', total: 80),
      _order(3, stage: 'Delivered', rider: 'ali', total: 45.25),
    ];

    test('counted exactly: every bill gets its total', () {
      expect(splitCounted(orders, 245.25), {1: 120, 2: 80, 3: 45.25});
    });

    test('over: the extra goes on the bill chosen, else the last', () {
      expect(splitCounted(orders, 250.25), {1: 120, 2: 80, 3: 50.25});
      expect(splitCounted(orders, 250.25, differenceOn: 1), {1: 125, 2: 80, 3: 45.25});
    });

    test('short: taken from the bill chosen, then from the others, last first, never below zero', () {
      expect(splitCounted(orders, 235.25, differenceOn: 2), {1: 120, 2: 70, 3: 45.25});
      // 100 short on #2 (80): it goes to nothing and the other 20 comes off #3
      expect(splitCounted(orders, 145.25, differenceOn: 2), {1: 120, 2: 0, 3: 25.25});
      expect(splitCounted(orders, 0), {1: 0, 2: 0, 3: 0});
    });

    test('to the cent: no floating-point crumbs', () {
      final cents = [_order(1, total: 0.1), _order(2, total: 0.2)];
      expect(splitCounted(cents, 0.3), {1: 0.1, 2: 0.2});
    });
  });
}
