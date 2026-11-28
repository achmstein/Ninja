import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../features/bills/services/bills_service.dart';
import '../../features/cart/services/checkout_flow.dart';
import '../../l10n/app_localizations.dart';
import '../motion/motion.dart';
import '../network/api_client.dart';
import '../services/delivery_card_service.dart' show DeliveryLive;
import '../providers/current_place_provider.dart';
import '../theme/theme_provider.dart';
import '../ui/ui.dart';
import '../models/localized_text.dart';
import '../utils/money.dart';
import '../widgets/destination_chip.dart';
import '../../features/places/screens/places_screen.dart' show showRoomSheet;
import '../../features/places/services/place_service.dart';
import '../../features/bills/widgets/open_bills.dart';
import '../../features/service_request/models/service_request.dart';
import '../../features/service_request/services/service_request_service.dart';
import '../../features/orders/models/order.dart';
import '../../features/orders/services/order_service.dart';
import '../../features/pay/widgets/pay_order_sheet.dart';
import '../../features/cart/widgets/tray_model.dart' show trayOpensAfterDrag;

/// The orders on their way with no open bill to land on (client_web's
/// live-bills.ts `forming`): sent and waiting, or confirmed and not on a bill
/// yet. They stand as a bill of their own, read from the server, so a reload
/// or another device still shows them.
final formingOrdersProvider = Provider<List<Order>>((ref) {
  final bills = ref.watch(myBillsProvider).value ?? const [];
  if (bills.any((b) => b.isOpen)) return const [];
  final onBills = {for (final bill in bills) for (final line in bill.lines) line.orderId};
  return [
    for (final order in ref.watch(ordersProvider).orders)
      if ((order.status != OrderStatus.confirmed && order.status != OrderStatus.cancelled) ||
          (order.status == OrderStatus.confirmed && !onBills.contains(order.id) && order.ticketId == null))
        order,
  ];
});

/// Whether the dock has a row to show: a bill running or forming, an order
/// on its way, or the table or room the customer is at
final dockRowShownProvider = Provider<bool>((ref) {
  final open = ref.watch(myBillsProvider).value?.any((b) => b.isOpen) ?? false;
  return open ||
      ref.watch(formingOrdersProvider).isNotEmpty ||
      ref.watch(liveOrderProvider) != null ||
      ref.watch(orderDestinationProvider) != null;
});

/// A delivery being made or on its way, as the server says it live
/// (Ordering's `GET {id}/delivery/live`): about how many minutes are left, who
/// is bringing it and their number while they are. Read again when the order
/// moves on and every half minute while it is followed; nothing for any other
/// order, and nothing where the server cannot be reached (the row then says
/// the stage alone).
final dockDeliveryProvider = FutureProvider.autoDispose<DeliveryLive?>((ref) async {
  final live = ref.watch(liveOrderProvider);
  final orderId = live?.orderId;
  if (orderId == null || (live!.stage != OrderStage.preparing && live.stage != OrderStage.onTheWay)) return null;
  final again = Timer(const Duration(seconds: 30), ref.invalidateSelf);
  ref.onDispose(again.cancel);
  try {
    final response = await ref.watch(ordersApiProvider).get<Map<String, dynamic>>('$orderId/delivery/live');
    final data = response.data;
    return data == null ? null : DeliveryLive.fromJson(data);
  } catch (_) {
    return null;
  }
});

/// Where an order has got to, in the customer's words; null for no order
String? orderStageWord(AppLocalizations l10n, OrderStage? stage) => switch (stage) {
      OrderStage.awaitingPayment => l10n.orderStageAwaitingPayment,
      OrderStage.sent => l10n.orderStageSent,
      OrderStage.confirmed => l10n.orderStageConfirmed,
      OrderStage.preparing => l10n.orderStagePreparing,
      OrderStage.onTheWay => l10n.orderStageOnTheWay,
      OrderStage.delivered => l10n.orderStageDelivered,
      OrderStage.notDelivered => l10n.orderStageNotDelivered,
      OrderStage.cancelled => l10n.orderStageCancelled,
      null => null,
    };

/// The bill running now and the order on its way, on the dock
/// (client_web's dock-bill.tsx): the row says where the order has got to
/// (Sent, Confirmed) above what the bill comes to, rolling as rounds land,
/// each change swapping in with a short blur. At a table or in a room the
/// row is that place too. A tap opens it: the table's requests, the room's
/// page, or the bills. The row's end button is the next thing to do: the
/// waiter called at a table with nothing ordered yet, the rider rung while a
/// delivery is on its way, Pay once there is something to pay and nothing
/// still coming.
class DockBill extends ConsumerWidget {
  final double height;

  const DockBill({super.key, required this.height});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final c = theme.colors;
    final money = ref.watch(moneyProvider);
    final live = ref.watch(liveOrderProvider);
    final destination = ref.watch(orderDestinationProvider);
    final open = ref.watch(myBillsProvider).value?.where((b) => b.isOpen).toList() ?? const [];
    // The open bills, and the bill forming out of orders that have no bill to land on yet
    final forming = ref.watch(formingOrdersProvider);
    final total = open.fold(0.0, (sum, bill) => sum + bill.total) + forming.fold(0.0, (sum, o) => sum + o.total - o.loyaltyDiscount);

    final place = destination?.name.localized(context) ??
        open.firstOrNull?.locationName?.localized(context) ??
        forming.firstOrNull?.placeName?.localized(context) ??
        l10n.atTheCounter;
    final stage = live?.stage;
    // Waiting for its payment ahead: the row is the way to pay it, not the bill
    final toPay = stage == OrderStage.awaitingPayment && live?.orderId != null;
    final stageWord = orderStageWord(l10n, stage);
    // A delivery: about how long is left, said after the stage where the server says it
    final delivery = ref.watch(dockDeliveryProvider).value;
    final minutes = delivery?.etaMinutes;
    final headline = stageWord == null
        ? null
        : (minutes != null && minutes > 0 ? '$stageWord · ${l10n.dockAboutMinutes(minutes)}' : stageWord);
    // On its way: its rider is the quiet line, and ringing them the end button
    final rider = stage == OrderStage.onTheWay ? (delivery?.riderName ?? live?.rider) : null;
    final riderPhone = stage == OrderStage.onTheWay ? delivery?.riderPhone : null;
    // The room's clock ticks in the row (client_web's dock-bill.tsx), so the tab it lived on can go back to booking
    final stay = destination?.isStay == true
        ? ref.watch(myStaysProvider).value?.where((s) => s.id == destination!.sessionId && s.startedAt != null).firstOrNull
        : null;
    // The order on its way says where it is in the top line; otherwise the line is where the customer is
    // A dot on the place while the waiter or the bill is asked for, so the answer is one tap away
    final asking = destination != null &&
        ref.watch(myRequestsProvider).any((r) => r.placeId == destination.placeId && r.isOpen && r.requestType != ServiceRequestType.changeOption);
    // With no order on its way the top line is where the customer is, or, while a waiter or the bill is
    // asked for, that in words and not only the dot. An order on its way has its own two lines below
    final line = asking && stageWord == null ? l10n.dockWaiterComing : (total > 0 || stay != null ? place : null);
    // The end button is the next thing to do: Pay, once there is something to pay and nothing still on its
    // way (what it opens has the way to pay under the bill)
    final payNext = !toPay && total > 0 && (stage == null || stage == OrderStage.delivered);
    // At a table, with nothing ordered and nothing asked for, the waiter is the next thing to want
    final callWaiter = destination != null && !destination.isStay && stage == null && total == 0 && !asking;
    // The end button's own press, where it does something other than open what the row stands for
    final VoidCallback? endPress = riderPhone != null
        ? () => launchUrl(Uri.parse('tel:$riderPhone'))
        : callWaiter
            ? () => ref.read(serviceRequestProvider.notifier).submitRequest(CreateServiceRequest(
                  placeId: destination.placeId,
                  placeKind: destination.placeKind,
                  placeName: destination.name,
                  requestType: ServiceRequestType.callWaiter,
                ))
            : null;
    final label = toPay
        ? l10n.orderPayNow
        : riderPhone != null
        ? l10n.dockCallRider
        : callWaiter
        ? l10n.dockCallWaiter
        : payNext
        ? l10n.dockPay
        : destination == null
        ? l10n.ninjaBillOpen
        : destination.isStay
            ? l10n.ninjaRoomOpen
            : l10n.ninjaTableOpen;

    final (IconData icon, Color fill, Color ink) = switch (stage) {
      OrderStage.awaitingPayment => (LucideIcons.creditCard, NinjaColors.warning, Colors.black),
      OrderStage.sent => (LucideIcons.send, c.foreground.withValues(alpha: 0.12), c.foreground),
      OrderStage.confirmed => (LucideIcons.check, NinjaColors.successSolid, Colors.white),
      // A delivery on its way to the door: being made, then with its rider, then there
      OrderStage.preparing => (LucideIcons.chefHat, c.foreground.withValues(alpha: 0.12), c.foreground),
      OrderStage.onTheWay => (LucideIcons.bike, NinjaColors.successSolid, Colors.white),
      OrderStage.delivered => (LucideIcons.house, NinjaColors.successSolid, Colors.white),
      OrderStage.notDelivered => (LucideIcons.x, NinjaColors.warning, Colors.white),
      OrderStage.cancelled => (LucideIcons.x, NinjaColors.errorSolid, Colors.white),
      null => (destination?.placeKind.icon ?? LucideIcons.receiptText, c.foreground.withValues(alpha: 0.12), c.foreground),
    };

    final lit = toPay || payNext || endPress != null;

    void onTap() {
      if (toPay) {
        showPayOrderSheet(context, live!.orderId!);
      } else if (destination == null) {
        showDockBills(context);
      } else if (destination.isStay) {
        // The room, out of the dock: the same sheet the Book tab's card opens
        final stay = ref.read(myStaysProvider).value?.where((s) => s.id == destination.sessionId).firstOrNull;
        stay != null ? showRoomSheet(context, stay) : context.go('/places');
      } else {
        showPlaceRequests(context, destination);
      }
    }

    return Semantics(
      button: true,
      label: label,
      // Pulled up by its handle, as the tray's row is, it opens too; a tap the same
      child: _PullUp(
        onOpen: onTap,
        child: SizedBox(
          height: height,
          child: Padding(
            padding: const EdgeInsetsDirectional.only(start: 24, end: 12),
            child: Row(
              children: [
                // The order's stage when one is on its way (its colour saying how it is going), else the place
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    AnimatedContainer(
                      duration: Motion.slow,
                      width: 44,
                      height: 44,
                      decoration: BoxDecoration(color: fill, shape: BoxShape.circle),
                      child: BlurSwap(
                        alignment: Alignment.center,
                        child: Icon(icon, key: ValueKey(icon), size: 20, color: ink),
                      ),
                    ),
                    // One dot at a time on the place: amber while the waiter or the bill is asked for (the more
                    // urgent), else green and live while the room's clock runs
                    if (asking)
                      PositionedDirectional(
                        end: 0,
                        top: 0,
                        child: Container(
                          width: 10,
                          height: 10,
                          decoration: BoxDecoration(
                            color: NinjaColors.warning,
                            shape: BoxShape.circle,
                            border: Border.all(color: c.background, width: 2),
                          ),
                        ),
                      )
                    else if (stay != null && stage == null)
                      PositionedDirectional(end: 0, top: 0, child: LiveDot(size: 10, ring: c.background)),
                  ],
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // An order on its way: where it has got to is the row's headline, the place (or the
                      // waiter asked for) and the bill quiet under it, as client_web's dock row
                      if (headline != null) ...[
                        BlurSwap(
                          child: Text(
                            headline,
                            key: ValueKey(headline),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: context.localeText(theme.typography.name.copyWith(fontWeight: FontWeight.w700, color: c.foreground)),
                          ),
                        ),
                        Text(
                          [asking ? l10n.dockWaiterComing : (rider ?? place), if (total > 0) money(total)].join(' · '),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: context.localeText(theme.typography.caption.copyWith(
                            color: asking ? NinjaColors.warning : c.foreground.withValues(alpha: 0.7),
                            fontWeight: asking ? FontWeight.w600 : null,
                          )),
                        ),
                      ] else ...[
                      if (line != null)
                        Row(
                          children: [
                            Flexible(
                              child: BlurSwap(
                                child: Text(
                                  line,
                                  key: ValueKey(line),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: context.localeText(theme.typography.caption.copyWith(color: c.foreground.withValues(alpha: 0.7))),
                                ),
                              ),
                            ),
                            // With a bill to show, the room's time rides along the top line. The dot stands on its
                            // own so it sits between the name and the time in either direction: inside the time's
                            // left-to-right text it ended up after the time in Arabic
                            if (stay != null && total > 0 && stage == null) ...[
                              Text(' · ', style: theme.typography.caption.copyWith(color: c.foreground.withValues(alpha: 0.7))),
                              _EverySecond(
                                builder: (context) => Text(
                                  stay.formattedDuration,
                                  textDirection: TextDirection.ltr,
                                  style: theme.typography.caption.copyWith(color: c.foreground.withValues(alpha: 0.7), fontFeatures: NinjaTypography.tabular),
                                ),
                              ),
                            ],
                          ],
                        ),
                      if (total > 0)
                        RollingNumber(
                          money(total),
                          value: total,
                          style: context.localeText(theme.typography.name.copyWith(fontWeight: FontWeight.w700, color: c.foreground)),
                        )
                      else if (stay != null)
                        // Nothing on the bill yet: the room's time is the row's big line
                        _EverySecond(
                          builder: (context) => Text(
                            stay.formattedDuration,
                            textDirection: TextDirection.ltr,
                            style: theme.typography.name.copyWith(fontWeight: FontWeight.w700, color: c.foreground, fontFeatures: NinjaTypography.tabular),
                          ),
                        )
                      else
                        Text(
                          place,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: context.localeText(theme.typography.name.copyWith(fontWeight: FontWeight.w700, color: c.foreground)),
                        ),
                      ],
                    ],
                  ),
                ),
                // Its own press where it has one (the rider rung, the waiter called): the row under it still opens
                GestureDetector(
                  onTap: endPress,
                  behavior: HitTestBehavior.opaque,
                  child: Container(
                    height: 40,
                    padding: EdgeInsetsDirectional.only(start: riderPhone != null ? 12 : 16, end: lit ? 16 : 12),
                    // The next thing to do, lit: the way to pay, the rider's number, the waiter
                    decoration: ShapeDecoration(color: lit ? c.foreground : c.foreground.withValues(alpha: 0.12), shape: const StadiumBorder()),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (riderPhone != null) ...[
                          Icon(LucideIcons.phone, size: 16, color: c.background),
                          const SizedBox(width: 4),
                        ],
                        Text(label, style: context.localeText(theme.typography.note.copyWith(fontWeight: FontWeight.w600, color: lit ? c.background : c.foreground))),
                        if (!lit) ...[
                          const SizedBox(width: 4),
                          Icon(LucideIcons.chevronUp, size: 16, color: c.foreground),
                        ],
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

/// Rebuilds what it holds once a second: the room's clock in the row
/// The row's pan and tap: a pull up past the tray's distance, or flicked up, opens what the row stands for
class _PullUp extends StatefulWidget {
  final VoidCallback onOpen;
  final Widget child;

  const _PullUp({required this.onOpen, required this.child});

  @override
  State<_PullUp> createState() => _PullUpState();
}

class _PullUpState extends State<_PullUp> {
  double _dragged = 0;

  @override
  Widget build(BuildContext context) => GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: widget.onOpen,
        onVerticalDragStart: (_) => _dragged = 0,
        onVerticalDragUpdate: (d) => _dragged += d.delta.dy,
        onVerticalDragEnd: (d) {
          if (trayOpensAfterDrag(false, _dragged, d.primaryVelocity ?? 0)) widget.onOpen();
        },
        child: widget.child,
      );
}

class _EverySecond extends StatefulWidget {
  final WidgetBuilder builder;

  const _EverySecond({required this.builder});

  @override
  State<_EverySecond> createState() => _EverySecondState();
}

class _EverySecondState extends State<_EverySecond> {
  late final Timer _tick;

  @override
  void initState() {
    super.initState();
    _tick = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _tick.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => widget.builder(context);
}

/// The bills running now on the slab sheet, out of the dock's row
/// (client_web's dock-bill.tsx): titled "Your bill", the bill forming and the
/// open ones, swiped between
Future<void> showDockBills(BuildContext context) => showNinjaSheet<void>(
      context: context,
      builder: (context) {
        final theme = context.theme;
        return Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: 16),
              child: Text(
                AppLocalizations.of(context)!.ninjaBillOpen,
                style: context.localeText(theme.typography.headline.copyWith(fontWeight: FontWeight.w800, color: theme.colors.foreground)),
              ),
            ),
            const OpenBills(),
            // Settled at the till while it was open: nothing left to show, so the sheet goes too
            const _ClosesWhenNoBill(),
          ],
        );
      },
    );

/// Closes the bills sheet once there is no bill left on it: the till settled
/// the last open one (or it was voided) and no order is forming, so the
/// sheet would stand there with its title alone
class _ClosesWhenNoBill extends ConsumerWidget {
  const _ClosesWhenNoBill();

  static bool _anyBill(WidgetRef ref) =>
      (ref.read(myBillsProvider).value?.any((b) => b.isOpen) ?? false) || ref.read(formingOrdersProvider).isNotEmpty;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    void check() {
      if (_anyBill(ref)) return;
      final route = ModalRoute.of(context);
      // Only this sheet, and only while it is the one on top
      if (route != null && route.isCurrent) Navigator.of(context).pop();
    }

    ref.listen(myBillsProvider, (_, _) => WidgetsBinding.instance.addPostFrameCallback((_) {
          if (context.mounted) check();
        }));
    ref.listen(formingOrdersProvider, (_, _) => WidgetsBinding.instance.addPostFrameCallback((_) {
          if (context.mounted) check();
        }));
    return const SizedBox.shrink();
  }
}
