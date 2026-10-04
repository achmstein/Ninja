import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/text_styles.dart';
import '../../../l10n/app_localizations.dart';
import '../models/sale_delivery.dart';

/// The delivery on the sale: where it goes and the number the rider calls
/// (its digits alone left to right), whether it has a pin; a tap changes
/// it, the cross makes it a counter sale again
class DeliverySummary extends StatelessWidget {
  final SaleDelivery delivery;
  final VoidCallback onEdit;
  final VoidCallback onRemove;

  const DeliverySummary({super.key, required this.delivery, required this.onEdit, required this.onRemove});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final muted = theme.typography.xs.copyWith(color: theme.colors.mutedForeground);
    return Container(
      padding: const EdgeInsetsDirectional.only(start: 10, top: 4, bottom: 4, end: 0),
      decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(10)),
      child: Row(
        children: [
          Icon(FIcons.bike, size: 18, color: theme.colors.mutedForeground),
          const SizedBox(width: 8),
          Expanded(
            child: Semantics(
              button: true,
              label: l10n.deliveryChange,
              child: FTappable(
                onPress: onEdit,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      [delivery.address, if (delivery.building.isNotEmpty) delivery.building].join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500),
                    ),
                    Row(
                      children: [
                        if (delivery.hasPin) ...[
                          Icon(FIcons.mapPin, size: 12, color: theme.colors.mutedForeground),
                          const SizedBox(width: 4),
                        ],
                        Text(delivery.phone, textDirection: TextDirection.ltr, style: muted),
                        if (!delivery.hasPin)
                          Flexible(
                            child: Text(' · ${l10n.deliveryNoPin}', maxLines: 1, overflow: TextOverflow.ellipsis, style: muted),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
          SizedBox.square(
            dimension: 48,
            child: Semantics(
              label: l10n.deliveryNotADelivery,
              button: true,
              child: FButton.icon(
                variant: FButtonVariant.ghost,
                onPress: onRemove,
                child: const Icon(FIcons.x, size: 18),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// A delivery on the sale the branch's terms do not confirm: why Charge
/// waits, and the two ways on (ask again, or make it a counter sale)
class DeliveryBlockedNote extends StatelessWidget {
  final DeliveryCharge charge;
  final VoidCallback onRetry;
  final VoidCallback onRemove;

  const DeliveryBlockedNote({super.key, required this.charge, required this.onRetry, required this.onRemove});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final amber = AppColors.amber(theme.colors.brightness);
    final text = switch (charge) {
      DeliveryCharge.checking => l10n.deliveryTermsChecking,
      DeliveryCharge.notOffered => l10n.deliveryNotOfferedNow,
      _ => l10n.deliveryTermsUnknown,
    };
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(color: AppColors.amber500.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(10)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(padding: const EdgeInsets.only(top: 2), child: Icon(FIcons.triangleAlert, size: 16, color: amber)),
              const SizedBox(width: 6),
              Expanded(child: Text(text, style: theme.typography.sm.copyWith(color: amber, fontWeight: FontWeight.w500))),
            ],
          ),
          const SizedBox(height: 8),
          Row(
            children: [
              if (charge == DeliveryCharge.failed) ...[
                Expanded(
                  child: SizedBox(
                    height: 48,
                    child: FButton(
                      variant: FButtonVariant.outline,
                      onPress: onRetry,
                      child: Text(l10n.retry, style: theme.typography.base.forButton),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
              ],
              Expanded(
                child: SizedBox(
                  height: 48,
                  child: FButton(
                    variant: FButtonVariant.outline,
                    onPress: onRemove,
                    child: Text(l10n.deliveryNotADelivery, style: theme.typography.base.forButton),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
