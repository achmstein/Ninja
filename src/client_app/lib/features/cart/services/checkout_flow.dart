import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/providers/current_place_provider.dart';
import '../../../core/router/app_router.dart';
import '../../../core/services/sound_service.dart';
import '../../../core/ui/ui.dart';
import '../../../core/utils/money.dart';
import '../../../core/widgets/profile_gate.dart';
import '../../../l10n/app_localizations.dart';
import '../../orders/models/order.dart';
import '../../orders/services/order_service.dart';
import '../../places/services/place_service.dart';
import '../../profile/providers/loyalty_provider.dart';
import '../widgets/order_island.dart';
import 'cart_service.dart';
import 'promo_service.dart';

/// The order's note, written in the open tray and sent with it
class OrderNoteNotifier extends Notifier<String> {
  @override
  String build() => '';

  void set(String note) => state = note;
}

final orderNoteProvider = NotifierProvider<OrderNoteNotifier, String>(OrderNoteNotifier.new);

/// Where the order just placed has got to, for the dock's row
enum OrderStage { sent, confirmed, cancelled }

class LiveOrder {
  final OrderStage stage;

  /// The order, once the orders list has it
  final int? orderId;

  const LiveOrder(this.stage, {this.orderId});
}

/// Where the order being followed is kept between reloads: the web's own key
const _followKey = 'ninja-order-pill';

/// The order on its way (client_web's lib/order-pill.ts): Sent once it is
/// placed, then what the business made of it as the orders list learns it
/// (a SignalR event refreshes the list). A settled order stays on the dock
/// for a moment and goes. As on the web, only the moment of placing is kept
/// on the phone: after a reload the order is found again in the server's
/// list, the newest one placed since.
class LiveOrderNotifier extends Notifier<LiveOrder?> {
  /// The newest order before this one was placed: the next one is it
  int _before = 0;
  Timer? _clear;

  /// Followed again after a reload, not placed here: a loaded list without it means it is gone
  bool _restored = false;

  static const _linger = Duration(seconds: 6);

  @override
  LiveOrder? build() {
    ref.onDispose(() => _clear?.cancel());
    ref.listen(ordersProvider, (_, next) => _follow(next.orders, loaded: !next.isLoading));
    _restore();
    return null;
  }

  /// Called just before the order is sent, so the one that comes back is known
  void placing() {
    final orders = ref.read(ordersProvider).orders;
    _before = orders.fold(0, (max, o) => o.id > max ? o.id : max);
  }

  void sent() {
    _clear?.cancel();
    _restored = false;
    state = const LiveOrder(OrderStage.sent);
    _keep();
    _follow(ref.read(ordersProvider).orders);
  }

  /// A reload while an order is being followed: follow it again, from the orders list
  Future<void> _restore() async {
    try {
      final before = (await SharedPreferences.getInstance()).getInt(_followKey);
      if (before == null || state != null) return;
      _before = before;
      _restored = true;
      state = const LiveOrder(OrderStage.sent);
      final orders = ref.read(ordersProvider);
      // The list may not have loaded yet (it starts empty, not loading): only a list with orders in it says this one is gone
      _follow(orders.orders, loaded: !orders.isLoading && orders.orders.isNotEmpty);
    } catch (_) {
      // Nothing kept: nothing to follow
    }
  }

  Future<void> _keep() async {
    try {
      (await SharedPreferences.getInstance()).setInt(_followKey, _before);
    } catch (_) {}
  }

  Future<void> _forget() async {
    try {
      (await SharedPreferences.getInstance()).remove(_followKey);
    } catch (_) {}
  }

  void _follow(List<Order> orders, {bool loaded = false}) {
    final live = state;
    if (live == null) return;
    final mine = orders.where((o) => o.id > _before).toList()..sort((a, b) => a.id.compareTo(b.id));
    if (mine.isEmpty) {
      // Followed again after a reload, and the loaded list holds no such order (another day's): stop
      if (loaded && _restored) _done();
      return;
    }
    final order = mine.first;
    final stage = switch (order.status) {
      OrderStatus.confirmed => OrderStage.confirmed,
      OrderStatus.cancelled => OrderStage.cancelled,
      _ => OrderStage.sent,
    };
    if (stage == live.stage && order.id == live.orderId) return;
    state = LiveOrder(stage, orderId: order.id);
    // Turned down is worth interrupting for: the island says so out loud, opened with the dishes
    if (stage == OrderStage.cancelled && live.stage != OrderStage.cancelled) _announce(order);
    if (stage != OrderStage.sent) {
      _clear?.cancel();
      _clear = Timer(_linger, _done);
    }
  }

  /// The island opened out for a moment (client_web's order-pill.tsx): the
  /// order turned down, its dishes and what it came to, and the way to the bill
  void _announce(Order order) {
    final money = ref.read(moneyProvider);
    island.flash(
      turnedDownFace(
        order,
        business: ref.read(brandNameProvider),
        total: order.total > 0 ? money(order.total) : null,
        onBills: () => ref.read(routerProvider).push('/bills'),
      ),
      duration: orderAnnounce,
    );
    HapticFeedback.mediumImpact();
  }

  void _done() {
    state = null;
    _forget();
  }
}

final liveOrderProvider = NotifierProvider<LiveOrderNotifier, LiveOrder?>(LiveOrderNotifier.new);

/// Sends what is in the tray with its note, code and points, where the
/// customer is (a room over a table); true when it went. The customer stays
/// where they are: the dock's row says where the order has got to.
Future<bool> placeTrayOrder(BuildContext context, WidgetRef ref) async {
  // Name and phone first: the business calls out and rings orders
  if (!await ensureProfileComplete(context, ref)) return false;
  if (!context.mounted) return false;

  final l10n = AppLocalizations.of(context)!;
  final cart = ref.read(cartProvider);
  final note = ref.read(orderNoteProvider).trim();
  final redemption = ref.read(loyaltyRedemptionProvider);
  final promo = ref.read(promoProvider);

  // A stay may have started while the order was open; stay-beats-table lives in orderDestinationProvider
  await ref.read(myStaysProvider.notifier).refresh();
  final destination = ref.read(orderDestinationProvider);

  ref.read(liveOrderProvider.notifier).placing();
  final success = await ref.read(checkoutProvider.notifier).submitOrder(
        items: cart.items,
        placeId: destination?.placeId,
        placeKind: destination?.placeKind.wireName,
        placeName: destination?.name.toJson(),
        sessionId: destination?.sessionId,
        customerNote: note.isEmpty ? null : note,
        pointsToRedeem: redemption.pointsToRedeem,
        loyaltyDiscount: redemption.serverDiscount ?? 0,
        promoCode: promo.applied ? promo.code : null,
      );

  if (success) {
    ref.read(orderNoteProvider.notifier).set('');
    ref.read(loyaltyRedemptionProvider.notifier).reset();
    ref.read(promoProvider.notifier).clear();
    // Keep the table alive through a long sitting with several rounds
    ref.read(currentPlaceProvider.notifier).stampOrdered();
    // Points earned show once the order is confirmed
    ref.read(loyaltyProvider.notifier).refresh();
    ref.read(liveOrderProvider.notifier).sent();
    SoundService.instance.playSuccess();
    showIsland(title: Text(l10n.orderPlacedSuccessfully), icon: const Icon(LucideIcons.check, color: NinjaColors.success));
  } else {
    final error = ref.read(checkoutProvider).error;
    showIsland(title: Text(error ?? l10n.failedToPlaceOrder), icon: const Icon(LucideIcons.circleX, color: NinjaColors.error));
  }
  return success;
}
