import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../menu/models/menu_item.dart';
import '../models/cart_item.dart';

/// What became of the order on its way to another branch (client_web's
/// lib/order-move.ts)
class OrderMove {
  final List<CartItem> items;

  /// Not served there: the dish, or one of its options, is off that branch's menu or sold out
  final List<CartItem> dropped;

  /// Kept, at that branch's price
  final List<CartItem> repriced;

  const OrderMove({required this.items, this.dropped = const [], this.repriced = const []});

  bool get changed => dropped.isNotEmpty || repriced.isNotEmpty;
}

/// The order taken to another branch's menu. The menu is the business's own
/// everywhere; a branch only prices a dish its own way or does not serve it
/// (and sells out an option). So each line stays as the customer made it, at
/// the price there, and a line that cannot be had there goes. The options'
/// own prices are the business's, the same at every branch.
OrderMove moveLines(List<CartItem> items, List<MenuItem> menu) {
  final byId = {for (final item in menu) item.id: item};
  final kept = <CartItem>[];
  final dropped = <CartItem>[];
  final repriced = <CartItem>[];

  for (final line in items) {
    final item = byId[line.productId];
    if (item == null || !item.isAvailable || item.isOutOfStock) {
      dropped.add(line);
      continue;
    }
    final options = {
      for (final c in item.customizations)
        for (final o in c.options) o.id: o,
    };
    final missing = line.selectedCustomizations.any((c) => options[c.optionId]?.isOutOfStock ?? true);
    if (missing) {
      dropped.add(line);
      continue;
    }
    final original = item.isOnOffer ? item.price : null;
    if ((item.effectivePrice - line.unitPrice).abs() > 0.004 || original != line.originalUnitPrice) {
      final moved = CartItem(
        productId: line.productId,
        productName: line.productName,
        unitPrice: item.effectivePrice,
        originalUnitPrice: original,
        pictureUri: line.pictureUri,
        quantity: line.quantity,
        specialInstructions: line.specialInstructions,
        selectedCustomizations: line.selectedCustomizations,
        suggestion: line.suggestion,
      );
      if ((item.effectivePrice - line.unitPrice).abs() > 0.004) repriced.add(moved);
      kept.add(moved);
    } else {
      kept.add(line);
    }
  }
  return OrderMove(items: kept, dropped: dropped, repriced: repriced);
}

/// The last move that changed the order, for the app to say (the main
/// scaffold puts it on the island): the branch it went to and what changed
class OrderMoveNotice {
  final int branchId;
  final OrderMove move;
  const OrderMoveNotice(this.branchId, this.move);
}

class OrderMoveNotifier extends Notifier<OrderMoveNotice?> {
  @override
  OrderMoveNotice? build() => null;

  void say(OrderMoveNotice notice) => state = notice;
}

final orderMoveProvider = NotifierProvider<OrderMoveNotifier, OrderMoveNotice?>(OrderMoveNotifier.new);
