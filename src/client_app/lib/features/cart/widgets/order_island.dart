import 'package:flutter/material.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/ui/ui.dart';
import '../../../l10n/app_localizations.dart';
import '../../orders/models/order.dart';

/// How long the island stays open to say an order was turned down
/// (client_web's order-pill.tsx `ANNOUNCE_MS`)
const orderAnnounce = Duration(milliseconds: 4200);

/// The island opened out to say an order was turned down (client_web's
/// order-pill.tsx): "Cancelled · #12", that the business could not take it,
/// its dishes and what it came to, and the way to the bill. The rest of the
/// way (Sent, Confirmed) the dock's row says it quietly; this is the one
/// stage worth interrupting for.
/// Raised away from any page, its words are looked up where the island draws them.
/// [note]: what it says in place of "could not take it" (an order paid ahead: the money goes back)
IslandFace turnedDownFace(Order order, {required String business, required String? total, required VoidCallback onBills, String? note}) => IslandFace(
      icon: const Icon(LucideIcons.x, color: NinjaColors.error),
      title: Builder(builder: (context) => Text('${AppLocalizations.of(context)!.orderStageCancelled} · #${order.id}')),
      description: _OrderDetails(order: order, business: business, total: total, note: note),
      actionLabelOf: (context) => AppLocalizations.of(context)!.orderSeeBills,
      onAction: onBills,
    );

/// Where the order is, what was in it, and what it came to
class _OrderDetails extends StatelessWidget {
  final Order order;
  final String business;
  final String? total;
  final String? note;

  const _OrderDetails({required this.order, required this.business, required this.total, this.note});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final ink = DefaultTextStyle.of(context).style.color ?? theme.colors.slabInk;
    final items = order.items;
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(note ?? l10n.orderCancelledNote(business), style: TextStyle(color: ink.withValues(alpha: 0.8))),
        if (items.isNotEmpty) ...[
          const SizedBox(height: 8),
          for (final line in items.take(4))
            Row(
              children: [
                SizedBox(
                  width: 24,
                  child: Text('${line.units}×', style: TextStyle(color: ink.withValues(alpha: 0.6), fontFeatures: NinjaTypography.tabular)),
                ),
                const SizedBox(width: 8),
                Flexible(child: Text(line.productName.localized(context), maxLines: 1, overflow: TextOverflow.ellipsis)),
              ],
            ),
          if (items.length > 4)
            Padding(
              padding: const EdgeInsetsDirectional.only(start: 32),
              child: Text('+${items.length - 4}', style: TextStyle(color: ink.withValues(alpha: 0.6))),
            ),
        ],
        if (total != null) ...[
          const SizedBox(height: 8),
          Text(total!, style: const TextStyle(fontWeight: FontWeight.w600, fontFeatures: NinjaTypography.tabular)),
        ],
      ],
    );
  }
}
