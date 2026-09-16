import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:shimmer/shimmer.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/models/money.dart';
import '../../../core/theme/text_styles.dart';
import '../../../l10n/app_localizations.dart';
import '../providers/pending_orders_provider.dart';

enum OrderDetailAction { confirm, cancel }

/// What the customer actually ordered, for the cashier who wants to look
/// before accepting: every item with its options and instructions, the
/// note, the total. Confirm is the primary action; cancelling takes a
/// second tap, because the customer is told and there is no way back from
/// it. Resolves to the pick; the caller carries it out.
Future<OrderDetailAction?> showOrderDetailDialog(BuildContext context, int orderId) {
  return showFDialog<OrderDetailAction>(
    context: context,
    useRootNavigator: true,
    builder: (context, style, animation) => FDialog.raw(
      style: style,
      animation: animation,
      constraints: const BoxConstraints(maxWidth: 448),
      builder: (context, _) => _OrderDetailDialog(orderId: orderId),
    ),
  );
}

class _OrderDetailDialog extends ConsumerStatefulWidget {
  final int orderId;
  const _OrderDetailDialog({required this.orderId});

  @override
  ConsumerState<_OrderDetailDialog> createState() => _OrderDetailDialogState();
}

class _OrderDetailDialogState extends ConsumerState<_OrderDetailDialog> {
  bool _cancelling = false;

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final order = ref.watch(orderDetailsProvider(widget.orderId)).value;
    final muted = theme.typography.sm.copyWith(color: theme.colors.mutedForeground);
    const tabular = [FontFeature.tabularFigures()];
    // LEGACY(places): old roomName/tableName read instead of placeName — remove when Sales, Ordering and Notification stop sending the old room/table fields.
    final place = order?.roomName?.localized(context) ?? order?.tableName?.localized(context) ?? '';
    final who = order?.guestName ?? '';
    final subtitle = [if (place.isNotEmpty) place, if (who.isNotEmpty) who].join(' · ');

    void pick(OrderDetailAction action) => Navigator.of(context, rootNavigator: true).pop(action);

    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.95),
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l10n.orderNumber(widget.orderId), style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
            if (subtitle.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(subtitle, style: theme.typography.base.copyWith(color: theme.colors.mutedForeground)),
            ],
            const SizedBox(height: 16),
            if (order == null)
              Shimmer.fromColors(
                baseColor: theme.colors.muted,
                highlightColor: theme.colors.background,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    for (final w in const [0.75, 0.66, 0.5])
                      Container(
                        width: 400 * w,
                        height: 20,
                        margin: const EdgeInsets.only(bottom: 8),
                        decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(6)),
                      ),
                  ],
                ),
              )
            else ...[
              for (final (index, item) in order.items.indexed) ...[
                if (index > 0) const SizedBox(height: 8),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Expanded(
                      child: Text('${item.units}× ${item.productName.localized(context)}',
                          style: theme.typography.base.copyWith(fontWeight: FontWeight.w500)),
                    ),
                    const SizedBox(width: 12),
                    Text(money(context, item.unitPrice * item.units), style: muted.copyWith(fontFeatures: tabular)),
                  ],
                ),
                if ((item.customizationsDescription?.localized(context) ?? '').isNotEmpty)
                  Text(item.customizationsDescription!.localized(context), style: muted),
                if (item.specialInstructions != null && item.specialInstructions!.isNotEmpty)
                  Text('"${item.specialInstructions}"', style: muted.copyWith(fontStyle: FontStyle.italic)),
              ],
              if (order.customerNote != null && order.customerNote!.isNotEmpty) ...[
                const SizedBox(height: 16),
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(10)),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Icon(FIcons.messageSquare, size: 16, color: theme.colors.mutedForeground),
                      const SizedBox(width: 8),
                      Expanded(child: Text(order.customerNote!, style: theme.typography.sm)),
                    ],
                  ),
                ),
              ],
              const FDivider(),
              if (order.loyaltyDiscount > 0)
                Row(
                  children: [
                    Text(l10n.loyaltyDiscount, style: muted),
                    const Spacer(),
                    Text('−${money(context, order.loyaltyDiscount)}', style: muted.copyWith(fontFeatures: tabular)),
                  ],
                ),
              Row(
                children: [
                  Text(l10n.total, style: theme.typography.lg.copyWith(fontWeight: FontWeight.w600)),
                  const Spacer(),
                  Text(money(context, order.total),
                      style: theme.typography.lg.copyWith(fontWeight: FontWeight.w600, fontFeatures: tabular)),
                ],
              ),
            ],
            const SizedBox(height: 16),
            if (_cancelling) ...[
              Text(l10n.cancelOrderConfirm, style: theme.typography.base.copyWith(color: theme.colors.destructive)),
              const SizedBox(height: 16),
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  SizedBox(
                    height: 48,
                    child: FButton(
                      variant: FButtonVariant.outline,
                      mainAxisSize: MainAxisSize.min,
                      onPress: () => setState(() => _cancelling = false),
                      child: Text(l10n.keepOrder, style: theme.typography.base.forButton),
                    ),
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    height: 48,
                    child: FButton(
                      variant: FButtonVariant.destructive,
                      mainAxisSize: MainAxisSize.min,
                      onPress: () => pick(OrderDetailAction.cancel),
                      prefix: const Icon(FIcons.x, size: 20),
                      child: Text(l10n.cancelOrder, style: theme.typography.base.forButton),
                    ),
                  ),
                ],
              ),
            ] else
              Row(
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  SizedBox(
                    height: 48,
                    child: FButton(
                      variant: FButtonVariant.outline,
                      mainAxisSize: MainAxisSize.min,
                      onPress: order == null ? null : () => setState(() => _cancelling = true),
                      prefix: Icon(FIcons.x, size: 20, color: theme.colors.destructive),
                      child: Text(l10n.cancelOrder,
                          style: theme.typography.base.forButton.copyWith(color: theme.colors.destructive)),
                    ),
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    height: 48,
                    child: FButton(
                      mainAxisSize: MainAxisSize.min,
                      onPress: order == null ? null : () => pick(OrderDetailAction.confirm),
                      prefix: const Icon(FIcons.check, size: 20),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 8),
                        child: Text(l10n.confirmOrder, style: theme.typography.base.forButton),
                      ),
                    ),
                  ),
                ],
              ),
          ],
        ),
      ),
    );
  }
}
