import 'delivery_order.dart';

/// The board's four columns, each a question the cashier asks: who still
/// needs a rider, who is out with whom, what is coming back, and whose cash
/// is still to take in
enum BoardLane { waiting, withRiders, comingBack, cashDue }

/// The column a delivery stands in; null once it is settled (off the board)
BoardLane? boardLaneOf(DeliveryOrder order) => switch (order.lane) {
      DeliveryLane.waiting => BoardLane.waiting,
      DeliveryLane.withRider => BoardLane.withRiders,
      DeliveryLane.failed || DeliveryLane.returned => BoardLane.comingBack,
      DeliveryLane.cashDue => BoardLane.cashDue,
      DeliveryLane.done => null,
    };

/// The board's deliveries by column, each column in the board's own order
Map<BoardLane, List<DeliveryOrder>> byLane(Iterable<DeliveryOrder> deliveries) {
  final lanes = {for (final lane in BoardLane.values) lane: <DeliveryOrder>[]};
  for (final order in deliveries) {
    final lane = boardLaneOf(order);
    if (lane != null) lanes[lane]!.add(order);
  }
  return lanes;
}

/// One rider's share of a column: their deliveries, and the cash on them
class RiderGroup {
  /// Null for deliveries with no rider named (an older order, a rider since removed)
  final String? riderUserId;
  final String? riderName;
  final List<DeliveryOrder> orders;

  const RiderGroup({required this.riderUserId, required this.riderName, required this.orders});

  /// What the rider was sent to collect, across their deliveries
  double get total => orders.fold(0.0, (sum, o) => sum + o.total);
}

/// A column's deliveries by rider: each rider once, in the order their first
/// delivery stands, their deliveries in the column's order
List<RiderGroup> byRider(Iterable<DeliveryOrder> orders) {
  final groups = <String, List<DeliveryOrder>>{};
  final names = <String, String?>{};
  for (final order in orders) {
    final key = order.delivery.riderUserId ?? '';
    groups.putIfAbsent(key, () => []).add(order);
    names.putIfAbsent(key, () => order.delivery.riderName);
  }
  return [
    for (final e in groups.entries)
      RiderGroup(riderUserId: e.key.isEmpty ? null : e.key, riderName: names[e.key], orders: e.value),
  ];
}

/// What each delivery of a rider's hand-in is counted in at, when the cash
/// counted is not what the bills come to. Every bill gets its total; the
/// difference goes on the one the cashier chose ([differenceOn]): over, on
/// top of it; short, taken from it, and where it is more than that bill, from
/// the others, last first. Never below zero, and to the cent. Counted at or
/// above the total settles every bill; short leaves the short ones open for
/// the till, as one delivery's cash does.
Map<int, double> splitCounted(List<DeliveryOrder> orders, double counted, {int? differenceOn}) {
  int cents(double v) => (v * 100).round();
  final amounts = {for (final o in orders) o.orderNumber: cents(o.total)};
  if (amounts.isEmpty) return const {};
  final on = differenceOn != null && amounts.containsKey(differenceOn) ? differenceOn : orders.last.orderNumber;
  final difference = cents(counted) - amounts.values.fold<int>(0, (a, b) => a + b);

  if (difference >= 0) {
    amounts[on] = amounts[on]! + difference;
  } else {
    var short = -difference;
    for (final id in [on, ...orders.reversed.map((o) => o.orderNumber).where((id) => id != on)]) {
      if (short == 0) break;
      final take = short < amounts[id]! ? short : amounts[id]!;
      amounts[id] = amounts[id]! - take;
      short -= take;
    }
  }
  return {for (final e in amounts.entries) e.key: e.value / 100};
}
