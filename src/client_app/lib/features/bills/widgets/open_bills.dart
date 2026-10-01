import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/shell/dock_bill.dart' show formingOrdersProvider;
import '../../orders/models/order.dart';
import '../../orders/services/order_service.dart';
import '../models/bill.dart';
import '../services/bills_service.dart';
import 'bill_swipe.dart';
import 'bill_tile.dart';

/// The bill forming out of orders that have no open bill to land on yet
/// (client_web's live-bills.ts): no lines of its own, only its rounds on
/// their way, and what they come to
Bill formingBill(List<Order> orders) => Bill(
      id: -1,
      type: 'Dine',
      status: 'Open',
      branchId: 0,
      locationName: orders.firstOrNull?.placeName,
      placeKind: orders.firstOrNull?.placeKind,
      openedAt: orders.map((o) => o.date).reduce((a, b) => a.isBefore(b) ? a : b),
      lastActivityAt: orders.map((o) => o.date).reduce((a, b) => a.isAfter(b) ? a : b),
      lines: const [],
      subtotal: 0,
      discount: 0,
      serviceCharge: 0,
      serviceChargeRate: 0,
      vat: 0,
      vatRate: 0,
      vatIncluded: true,
      total: orders.fold(0.0, (sum, o) => sum + o.total - o.loyaltyDiscount),
      refundedTotal: 0,
    );

/// The customer's bills running now (client_web's open-bills.tsx): the bill
/// forming out of orders on their way, then each open bill with the rounds
/// on their way to it, swiped between when there are two or more. The dock's
/// sheet, the room and the Bills page show the same.
class OpenBills extends ConsumerWidget {
  const OpenBills({super.key});

  /// Whether there is a bill to show: one open, or one forming
  static bool any(WidgetRef ref) =>
      (ref.watch(myBillsProvider).value?.any((b) => b.isOpen) ?? false) || ref.watch(formingOrdersProvider).isNotEmpty;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final bills = ref.watch(myBillsProvider).value ?? const <Bill>[];
    final orders = ref.watch(ordersProvider).orders;
    final ordersById = {for (final order in orders) order.id: order};
    final open = bills.where((b) => b.isOpen).toList();
    final pending = placeRounds(bills, orders);
    final forming = ref.watch(formingOrdersProvider);
    final onBills = {for (final bill in bills) for (final line in bill.lines) line.orderId};
    return BillSwipe(children: [
      if (forming.isNotEmpty)
        BillTile(
          key: const ValueKey('forming'),
          bill: formingBill(forming),
          ordersById: ordersById,
          forming: true,
          pending: [
            for (final order in forming.reversed)
              PendingRound(order, adding: order.status == OrderStatus.confirmed && !onBills.contains(order.id)),
          ],
        ),
      for (final bill in open) BillTile(key: ValueKey(bill.id), bill: bill, ordersById: ordersById, pending: pending[bill.id] ?? const []),
    ]);
  }
}
