import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/text_styles.dart';
import '../../../l10n/app_localizations.dart';
import '../models/kitchen_order.dart';
import '../status.dart';

/// One order as the kitchen sees it, as kds_web's order-card: the number
/// and the clock at the top, where it goes and for whom, the lines big
/// enough to read from a metre away, and the one or two taps that move it
/// along. Nothing about money.
class OrderCard extends StatelessWidget {
  final KitchenOrder order;
  final DateTime now;

  /// This card's tap is in flight: its buttons are disabled, no other card's
  final bool acting;
  final VoidCallback onStart;
  final VoidCallback onReady;
  final VoidCallback onRecall;

  const OrderCard({
    super.key,
    required this.order,
    required this.now,
    required this.acting,
    required this.onStart,
    required this.onReady,
    required this.onRecall,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final brightness = theme.colors.brightness;
    final amber = AppColors.amber(brightness);
    const tabular = [FontFeature.tabularFigures()];

    final isReady = order.isReady;
    final isPreparing = order.preparation == PreparationStatus.preparing;

    // The clock runs from confirmation and stops on Ready, where it becomes
    // "how long ago"
    final urgency = isReady ? OrderUrgency.fresh : orderUrgency(order.since, now);
    final clock = formatElapsed(isReady ? order.readyAt : order.since, now);

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
      padding: const EdgeInsets.all(16),
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
              Text('#${order.orderNumber}', style: theme.typography.xl2.copyWith(fontWeight: FontWeight.w700, fontFeatures: tabular)),
              const Spacer(),
              Text(clock, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600, color: clockColor, fontFeatures: tabular)),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Icon(placeIcon, size: 20, color: theme.colors.mutedForeground),
              const SizedBox(width: 8),
              Flexible(
                child: Text(destination, style: theme.typography.base.copyWith(fontWeight: FontWeight.w600), overflow: TextOverflow.ellipsis),
              ),
              if (who.isNotEmpty) ...[
                const SizedBox(width: 8),
                Flexible(
                  child: Text('· $who', style: theme.typography.base.copyWith(color: theme.colors.mutedForeground), overflow: TextOverflow.ellipsis),
                ),
              ],
            ],
          ),
          const SizedBox(height: 12),
          for (final (index, item) in order.items.indexed) ...[
            if (index > 0) Container(height: 1, color: theme.colors.border),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  SizedBox(
                    width: 36,
                    child: Text('${item.units}×', style: theme.typography.xl.copyWith(fontWeight: FontWeight.w700, fontFeatures: tabular)),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(item.productName.localized(context), style: theme.typography.lg.copyWith(fontWeight: FontWeight.w600, height: 1.25)),
                        if (item.customizationsDescription != null) ...[
                          const SizedBox(height: 2),
                          Text(item.customizationsDescription!.localized(context), style: theme.typography.base.copyWith(color: theme.colors.mutedForeground)),
                        ],
                        if (item.specialInstructions != null) ...[
                          const SizedBox(height: 2),
                          Text(item.specialInstructions!, style: theme.typography.base.copyWith(fontWeight: FontWeight.w500, color: amber)),
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
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.amber500.withValues(alpha: 0.10),
                border: Border.all(color: AppColors.amber500.withValues(alpha: 0.4)),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Icon(FIcons.messageSquareText, size: 20, color: amber),
                  const SizedBox(width: 8),
                  Expanded(child: Text(order.customerNote!, style: theme.typography.base.copyWith(fontWeight: FontWeight.w500, color: amber))),
                ],
              ),
            ),
          ],
          const SizedBox(height: 12),
          Row(
            children: [
              if (isReady)
                _button(
                  theme,
                  variant: FButtonVariant.outline,
                  icon: FIcons.undo2,
                  label: l10n.recall,
                  onPress: onRecall,
                )
              else ...[
                if (!isPreparing) ...[
                  _button(theme, variant: FButtonVariant.secondary, icon: FIcons.play, label: l10n.start, onPress: onStart),
                  const SizedBox(width: 8),
                ],
                _button(theme, variant: null, icon: FIcons.check, label: l10n.ready, onPress: onReady),
              ],
            ],
          ),
        ],
      ),
    );
  }

  /// A 56 dp button that takes its share of the footer — tapped with a wet
  /// finger from across the counter
  Widget _button(FThemeData theme, {required FButtonVariant? variant, required IconData icon, required String label, required VoidCallback onPress}) {
    return Expanded(
      child: SizedBox(
        height: 56,
        child: FButton(
          variant: variant,
          onPress: acting ? null : onPress,
          prefix: Icon(icon, size: 24),
          child: Text(label, style: theme.typography.lg.forButton),
        ),
      ),
    );
  }
}
