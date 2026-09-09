import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/text_styles.dart';
import '../../../l10n/app_localizations.dart';
import '../models/kitchen_order.dart';
import '../status.dart';

/// One order as the kitchen sees it, as kds_web's order-card: number, where
/// it goes and the clock on one line, the lines big enough to read at
/// arm's length, and the one tap that moves it along — Ready on the board,
/// Bring back in the history. Nothing about money.
class OrderCard extends StatelessWidget {
  final KitchenOrder order;
  final DateTime now;

  /// This card's tap is in flight: its button is disabled, no other card's
  final bool acting;
  final VoidCallback? onReady;
  final VoidCallback? onBringBack;

  const OrderCard({
    super.key,
    required this.order,
    required this.now,
    required this.acting,
    this.onReady,
    this.onBringBack,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final brightness = theme.colors.brightness;
    final amber = AppColors.amber(brightness);
    const tabular = [FontFeature.tabularFigures()];

    final isReady = order.isReady;

    // The clock runs from confirmation; a ready order shows when it was
    // finished instead
    final urgency = isReady ? OrderUrgency.fresh : orderUrgency(order.since, now);
    final clock = isReady
        ? MaterialLocalizations.of(context).formatTimeOfDay(TimeOfDay.fromDateTime(order.readyAt!.toLocal()))
        : formatElapsed(order.since, now);

    // Where it goes: the room or table it was ordered from; failing that, the
    // counter it was rung up at, or the customer picking it up
    final room = order.roomName?.localized(context) ?? '';
    final table = order.tableName?.localized(context) ?? '';
    final destination = room.isNotEmpty
        ? room
        : table.isNotEmpty
            ? table
            : order.isPos
                ? l10n.counter
                : l10n.pickup;
    final placeIcon = room.isNotEmpty
        ? FIcons.doorOpen
        : table.isNotEmpty
            ? FIcons.armchair
            : order.isPos
                ? FIcons.store
                : FIcons.shoppingBag;
    final customer = order.customerName ?? '';
    final who = customer.isNotEmpty ? customer : (order.isPos ? '' : l10n.walkIn);

    // The border follows the clock, so a late order stands out across the room
    final borderColor = isReady
        ? AppColors.emerald500.withValues(alpha: 0.6)
        : switch (urgency) {
            OrderUrgency.delayed => theme.colors.destructive.withValues(alpha: 0.7),
            OrderUrgency.warning => AppColors.amber500.withValues(alpha: 0.7),
            OrderUrgency.fresh => theme.colors.border,
          };
    final clockColor = isReady
        ? AppColors.emerald(brightness)
        : switch (urgency) {
            OrderUrgency.delayed => theme.colors.destructive,
            OrderUrgency.warning => amber,
            OrderUrgency.fresh => theme.colors.mutedForeground,
          };

    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: theme.colors.background,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderColor, width: 2),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Text('#${order.orderNumber}', style: theme.typography.xl.copyWith(fontWeight: FontWeight.w700, fontFeatures: tabular)),
              const SizedBox(width: 8),
              Expanded(
                child: Row(
                  children: [
                    Icon(placeIcon, size: 16, color: theme.colors.mutedForeground),
                    const SizedBox(width: 6),
                    Flexible(
                      child: Text(destination, style: theme.typography.base.copyWith(fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis),
                    ),
                    if (who.isNotEmpty) ...[
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text('· $who', style: theme.typography.base.copyWith(color: theme.colors.mutedForeground), overflow: TextOverflow.ellipsis),
                      ),
                    ],
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(clock, style: theme.typography.lg.copyWith(fontWeight: FontWeight.w600, color: clockColor, fontFeatures: tabular)),
            ],
          ),
          const SizedBox(height: 8),
          for (final (index, item) in order.items.indexed) ...[
            if (index > 0) Container(height: 1, color: theme.colors.border),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 28,
                    child: Text('${item.units}×', style: theme.typography.base.copyWith(fontWeight: FontWeight.w700, fontFeatures: tabular)),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(item.productName.localized(context), style: theme.typography.base.copyWith(fontWeight: FontWeight.w600, height: 1.25)),
                        if (item.customizationsDescription != null) ...[
                          const SizedBox(height: 2),
                          Text(item.customizationsDescription!.localized(context), style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
                        ],
                        if (item.specialInstructions != null) ...[
                          const SizedBox(height: 2),
                          Text(item.specialInstructions!, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500, color: amber)),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
          if (order.customerNote != null) ...[
            const SizedBox(height: 4),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.amber500.withValues(alpha: 0.10),
                border: Border.all(color: AppColors.amber500.withValues(alpha: 0.4)),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(FIcons.messageSquareText, size: 16, color: amber),
                  const SizedBox(width: 8),
                  Expanded(child: Text(order.customerNote!, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500, color: amber))),
                ],
              ),
            ),
          ],
          if (onReady != null || onBringBack != null) ...[
            const SizedBox(height: 8),
            if (onBringBack != null)
              _button(theme, variant: FButtonVariant.outline, icon: FIcons.undo2, label: l10n.bringBack, onPress: onBringBack!)
            else
              _button(theme, variant: null, icon: FIcons.check, label: l10n.ready, onPress: onReady!),
          ],
        ],
      ),
    );
  }

  /// A 48 dp button across the whole card — tapped with a wet finger
  Widget _button(FThemeData theme, {required FButtonVariant? variant, required IconData icon, required String label, required VoidCallback onPress}) {
    return SizedBox(
      height: 48,
      child: FButton(
        variant: variant,
        onPress: acting ? null : onPress,
        prefix: Icon(icon, size: 20),
        child: Text(label, style: theme.typography.base.forButton),
      ),
    );
  }
}
