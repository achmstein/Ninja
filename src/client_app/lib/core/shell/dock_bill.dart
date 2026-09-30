import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../features/bills/services/bills_service.dart';
import '../../features/cart/services/checkout_flow.dart';
import '../../l10n/app_localizations.dart';
import '../motion/motion.dart';
import '../providers/current_place_provider.dart';
import '../theme/theme_provider.dart';
import '../ui/ui.dart';
import '../models/localized_text.dart';
import '../utils/money.dart';
import '../widgets/destination_chip.dart';

/// Whether the dock has a row to show: an order on its way, a bill running,
/// or the table or room the customer is at
final dockRowShownProvider = Provider<bool>((ref) {
  final open = ref.watch(myBillsProvider).value?.any((b) => b.isOpen) ?? false;
  return open || ref.watch(liveOrderProvider) != null || ref.watch(orderDestinationProvider) != null;
});

/// The bill running now and the order on its way, on the dock
/// (client_web's dock-bill.tsx): the row says where the order has got to
/// (Sent, Confirmed) above what the bill comes to, rolling as rounds land,
/// each change swapping in with a short blur. At a table or in a room the
/// row is that place too. A tap opens it: the table's requests, the room's
/// page, or the bills.
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
    final total = open.fold(0.0, (sum, bill) => sum + bill.total);

    final place = destination?.name.localized(context) ?? open.firstOrNull?.locationName?.localized(context) ?? l10n.atTheCounter;
    final stage = live?.stage;
    final stageWord = switch (stage) {
      OrderStage.sent => l10n.orderStageSent,
      OrderStage.confirmed => l10n.orderStageConfirmed,
      OrderStage.cancelled => l10n.orderStageCancelled,
      null => null,
    };
    final line = stageWord != null ? '$stageWord${live?.orderId != null ? ' · #${live!.orderId}' : ''}' : (total > 0 ? place : null);
    final label = destination == null
        ? l10n.ninjaBillOpen
        : destination.isStay
            ? l10n.ninjaRoomOpen
            : l10n.ninjaTableOpen;

    final (IconData icon, Color fill, Color ink) = switch (stage) {
      OrderStage.sent => (LucideIcons.send, c.foreground.withValues(alpha: 0.12), c.foreground),
      OrderStage.confirmed => (LucideIcons.check, const Color(0xFF10B981), Colors.white),
      OrderStage.cancelled => (LucideIcons.x, const Color(0xFFEF4444), Colors.white),
      null => (destination?.placeKind.icon ?? LucideIcons.receiptText, c.foreground.withValues(alpha: 0.12), c.foreground),
    };

    void onTap() {
      if (destination == null) {
        context.push('/bills');
      } else if (destination.isStay) {
        context.go('/places');
      } else {
        showPlaceRequests(context, destination);
      }
    }

    return Semantics(
      button: true,
      label: label,
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: onTap,
        child: SizedBox(
          height: height,
          child: Padding(
            padding: const EdgeInsetsDirectional.only(start: 24, end: 12),
            child: Row(
              children: [
                // The order's stage when one is on its way (its colour saying how it is going), else the place
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
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (line != null)
                        BlurSwap(
                          child: Text(
                            line,
                            key: ValueKey(line),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: context.localeText(theme.typography.caption.copyWith(color: c.foreground.withValues(alpha: 0.7))),
                          ),
                        ),
                      if (total > 0)
                        RollingNumber(
                          money(total),
                          value: total,
                          style: context.localeText(theme.typography.name.copyWith(fontWeight: FontWeight.w700, color: c.foreground)),
                        )
                      else
                        Text(
                          place,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: context.localeText(theme.typography.name.copyWith(fontWeight: FontWeight.w700, color: c.foreground)),
                        ),
                    ],
                  ),
                ),
                Container(
                  height: 40,
                  padding: const EdgeInsetsDirectional.only(start: 16, end: 12),
                  decoration: ShapeDecoration(color: c.foreground.withValues(alpha: 0.12), shape: const StadiumBorder()),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(label, style: context.localeText(theme.typography.note.copyWith(fontWeight: FontWeight.w600, color: c.foreground))),
                      const SizedBox(width: 4),
                      Icon(LucideIcons.chevronUp, size: 16, color: c.foreground),
                    ],
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
