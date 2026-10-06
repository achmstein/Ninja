import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/providers/current_place_provider.dart';
import '../../../core/providers/locale_provider.dart';
import '../../../core/router/app_router.dart';
import '../../../core/services/sound_service.dart';
import '../../../core/ui/ui.dart';
import '../../../core/utils/money.dart';
import '../../../core/widgets/profile_gate.dart';
import '../../delivery/services/delivery_service.dart';
import '../../../l10n/app_localizations.dart';
import '../../orders/models/order.dart';
import '../../orders/services/order_service.dart';
import '../../pay/pay_ahead.dart';
import '../../pay/widgets/pay_order_sheet.dart';
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

/// Where the order just placed has got to, for the dock's row. A delivery is
/// followed to the door: being made, on its way with its rider, delivered
/// (or not), since the rider says each one
/// (or not), since the rider says each one. Paid ahead online, it waits for its payment first
enum OrderStage { awaitingPayment, sent, confirmed, preparing, onTheWay, delivered, notDelivered, cancelled }

class LiveOrder {
  final OrderStage stage;

  /// The order, once the orders list has it
  final int? orderId;

  /// The rider who has a delivery on its way, when the till said who
  final String? rider;

  /// Paid ahead online, and the money in: nothing to pay at the door, and it goes back if the order is not made
  final bool paidAhead;

  /// Paid ahead online, whether or not the money came in
  final bool paysOnline;

  const LiveOrder(this.stage, {this.orderId, this.rider, this.paidAhead = false, this.paysOnline = false});
}

/// Where an order stands for the dock: a delivery, confirmed, by its rider's word
OrderStage orderStageOf(Order order) {
  final delivery = order.delivery;
  if (order.status == OrderStatus.cancelled) return OrderStage.cancelled;
  if (order.status == OrderStatus.awaitingPayment) return OrderStage.awaitingPayment;
  if (order.status != OrderStatus.confirmed) return OrderStage.sent;
  if (delivery == null) return OrderStage.confirmed;
  return switch (delivery.stage) {
    'Delivered' => OrderStage.delivered,
    'OnTheWay' => OrderStage.onTheWay,
    'Failed' || 'Returned' => OrderStage.notDelivered,
    _ => OrderStage.preparing,
  };
}

/// How long a stage stays on the dock once reached; null while the order is still on its way to the customer
Duration? lingerOf(OrderStage stage) => switch (stage) {
      // Waiting for its payment ahead: on the dock, with the way to pay, until paid or let go
      OrderStage.awaitingPayment || OrderStage.sent || OrderStage.preparing || OrderStage.onTheWay => null,
      OrderStage.delivered => const Duration(seconds: 10),
      // The rider couldn't find the door, or nobody answered: said, and held long enough to be read
      OrderStage.notDelivered => const Duration(seconds: 30),
      OrderStage.confirmed || OrderStage.cancelled => const Duration(seconds: 6),
    };

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

  /// A delivery is asked after while it is followed: the rider's steps reach the customer by no event
  Timer? _poll;

  /// A delivery is followed to the door, for this long at most
  static const _followDelivery = Duration(hours: 2);
  DateTime? _since;

  @override
  LiveOrder? build() {
    ref.onDispose(() {
      _clear?.cancel();
      _poll?.cancel();
    });
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
    _since = DateTime.now();
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
    final stage = orderStageOf(order);
    final rider = order.delivery?.riderName;
    // A delivery followed past its time (a rider who never said they arrived): let go
    if (_since != null && DateTime.now().difference(_since!) > _followDelivery) {
      _done();
      return;
    }
    _pollWhile(order.delivery != null && lingerOf(stage) == null);
    if (stage == live.stage && order.id == live.orderId && rider == live.rider && order.paidAhead == live.paidAhead) return;
    state = LiveOrder(stage, orderId: order.id, rider: rider, paidAhead: order.paidAhead, paysOnline: order.paysOnline);
    if (stage != live.stage) {
      // Turned down is worth interrupting for: the island says so out loud, opened with the dishes
      if (stage == OrderStage.cancelled) _announce(order);
      // So is a delivery at the door, or one that could not get there
      if (stage == OrderStage.onTheWay || stage == OrderStage.delivered || stage == OrderStage.notDelivered) _announceDelivery(stage, rider, paid: order.paidAhead);
    }
    final linger = lingerOf(stage);
    _clear?.cancel();
    if (linger != null) _clear = Timer(linger, _done);
  }

  /// Ask the orders list again every few seconds while a delivery is on its way to the customer
  void _pollWhile(bool on) {
    if (!on) {
      _poll?.cancel();
      _poll = null;
      return;
    }
    _poll ??= Timer.periodic(const Duration(seconds: 8), (_) => ref.read(ordersProvider.notifier).refresh());
  }

  /// A delivery's step said out loud on the island (client_web's order-pill LOUD stages)
  void _announceDelivery(OrderStage stage, String? rider, {bool paid = false}) {
    final l10n = lookupAppLocalizations(ref.read(localeProvider));
    final business = ref.read(brandNameProvider);
    final (String title, IconData icon, Color color) = switch (stage) {
      // Paid ahead online: nothing to pay at the door
      OrderStage.onTheWay => (
          paid
              ? (rider != null ? l10n.orderPaidOnTheWayRiderNote(rider) : l10n.orderPaidOnTheWayNote)
              : (rider != null ? l10n.orderOnTheWayRiderNote(rider) : l10n.orderOnTheWayNote),
          LucideIcons.bike,
          NinjaColors.success,
        ),
      OrderStage.delivered => (l10n.orderDeliveredNote, LucideIcons.house, NinjaColors.success),
      _ => (l10n.orderNotDeliveredNote(business), LucideIcons.circleX, NinjaColors.warning),
    };
    showIsland(title: Text(title), icon: Icon(icon, color: color), duration: const Duration(seconds: 5));
    HapticFeedback.mediumImpact();
  }

  /// The island opened out for a moment (client_web's order-pill.tsx): the
  /// order turned down, its dishes and what it came to, and the way to the bill
  void _announce(Order order) {
    final money = ref.read(moneyProvider);
    island.flash(
      turnedDownFace(
        order,
        // Paid ahead: the money goes back; never paid: nothing was charged
        note: order.paysOnline
            ? (order.paidAhead
                ? lookupAppLocalizations(ref.read(localeProvider)).orderPaidCancelledNote(ref.read(brandNameProvider))
                : lookupAppLocalizations(ref.read(localeProvider)).orderUnpaidCancelledNote)
            : null,
        business: ref.read(brandNameProvider),
        total: order.total > 0 ? money(order.total) : null,
        onBills: () => ref.read(routerProvider).push('/bills'),
      ),
      duration: orderAnnounce,
    );
    HapticFeedback.mediumImpact();
  }

  void _done() {
    _poll?.cancel();
    _poll = null;
    _since = null;
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
  // Brought by the branch's rider: only once the branch has said yes to the address and the dishes reach its minimum
  final delivery = ref.read(deliveryStateProvider);
  if (delivery.active && !delivery.ready) return false;
  final deliverTo = delivery.active ? delivery.address : null;

  // Paid ahead online, where the business takes it and the order goes to a door or the counter
  final payOnline = ref.read(payAheadProvider).online;

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
        delivery: deliverTo == null ? null : {...deliverTo.body(), 'phone': deliverTo.phone ?? ref.read(authServiceProvider).phoneNumber},
        payOnline: payOnline,
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
    if (payOnline) {
      // Straight on to paying it. The same request answered again carries no number: the order is then on
      // the dock, waiting for its payment, with the way to pay it
      final orderId = ref.read(checkoutProvider).placedOrderId;
      if (orderId != null && context.mounted) {
        unawaited(showPayOrderSheet(context, orderId, start: true));
      } else {
        showIsland(title: Text(l10n.payAheadFinishFromDock), icon: const Icon(LucideIcons.creditCard, color: NinjaColors.warning));
      }
    } else {
      SoundService.instance.playSuccess();
      showIsland(title: Text(l10n.orderPlacedSuccessfully), icon: const Icon(LucideIcons.check, color: NinjaColors.success));
    }
  } else {
    final checkout = ref.read(checkoutProvider);
    // A rule the order broke is said in the customer's words; a delivery switched off under the open order drops it
    final code = checkout.errorCode;
    if (code == 'delivery.not_delivering') ref.read(brandProvider.notifier).refresh();
    final said = deliveryProblemText(l10n, code);
    showIsland(title: Text(said ?? checkout.error ?? l10n.failedToPlaceOrder), icon: const Icon(LucideIcons.circleX, color: NinjaColors.error));
  }
  return success;
}

/// A delivery rule the order broke, in the customer's words; null for any other refusal
String? deliveryProblemText(AppLocalizations l10n, String? code) => switch (code) {
      'delivery.not_delivering' => l10n.problemNotDelivering,
      'delivery.out_of_range' => l10n.problemOutOfRange,
      'delivery.below_minimum' => l10n.problemBelowMinimum,
      'delivery.phone_invalid' => l10n.deliveryNeedPhone,
      'delivery.address_required' => l10n.deliveryNeedStreet,
      'delivery.pin_invalid' => l10n.problemPinInvalid,
      'delivery.place_conflict' => l10n.problemPlaceConflict,
      'delivery.too_long' => l10n.problemTooLong,
      _ => null,
    };
