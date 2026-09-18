import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:intl/intl.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/providers/locale_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../../orders/models/order.dart';
import '../../orders/services/order_service.dart';

/// An order the till has not put on a bill: where it was sent, and what is
/// in it. The status dot says what the till did.
class OrderTile extends ConsumerWidget {
  final Order order;

  const OrderTile({super.key, required this.order});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final colors = context.theme.colors;
    final locale = ref.watch(localeProvider);
    final l10n = AppLocalizations.of(context)!;
    final details = ref.watch(orderProvider(order.id));
    final place = order.place?.localized(context);
    final discount = order.loyaltyDiscount;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Padding(
            padding: const EdgeInsets.only(top: 5),
            child: _StatusDot(status: order.status),
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AppText(
                  DateFormat('h:mm a', locale.languageCode).format(order.date.toLocal()),
                  style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15, color: colors.foreground),
                ),
                if (place != null && place.isNotEmpty)
                  Padding(
                    padding: const EdgeInsets.only(top: 2),
                    child: Row(
                      children: [
                        Icon(order.placeKind.icon, size: 14, color: colors.mutedForeground),
                        const SizedBox(width: 4),
                        Expanded(
                          child: AppText(place,
                              style: TextStyle(fontSize: 13, color: colors.mutedForeground),
                              overflow: TextOverflow.ellipsis),
                        ),
                      ],
                    ),
                  ),
                const SizedBox(height: 4),
                details.when(
                  loading: () => SizedBox(
                      width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: colors.primary)),
                  error: (_, _) =>
                      AppText(l10n.failedToLoadDetails, style: TextStyle(color: colors.destructive, fontSize: 13)),
                  data: (order) => _OrderItems(order: order),
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              AppText(
                l10n.priceFormat((order.total - discount).toStringAsFixed(2)),
                style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15, color: colors.foreground),
              ),
              if (order.promoDiscount > 0)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.local_offer, size: 12, color: Colors.green.shade600),
                    const SizedBox(width: 2),
                    AppText(
                      l10n.discountFormat(order.promoDiscount.toStringAsFixed(2)),
                      style: TextStyle(fontSize: 12, color: Colors.green.shade600),
                    ),
                  ],
                ),
              if (discount > 0)
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.stars, size: 12, color: Colors.green.shade600),
                    const SizedBox(width: 2),
                    AppText(
                      l10n.discountFormat(discount.toStringAsFixed(2)),
                      style: TextStyle(fontSize: 12, color: Colors.green.shade600),
                    ),
                  ],
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _OrderItems extends StatelessWidget {
  final Order order;

  const _OrderItems({required this.order});

  @override
  Widget build(BuildContext context) {
    final colors = context.theme.colors;
    final l10n = AppLocalizations.of(context)!;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (final item in order.items)
          Padding(
            padding: const EdgeInsets.only(bottom: 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    AppText('${item.units}x ', style: TextStyle(fontSize: 14, color: colors.mutedForeground)),
                    Expanded(
                      child: AppText(item.productName.localized(context),
                          style: TextStyle(fontSize: 14, color: colors.foreground)),
                    ),
                  ],
                ),
                if (item.customizationsDescription != null)
                  Padding(
                    padding: const EdgeInsetsDirectional.only(start: 24),
                    child: AppText(item.customizationsDescription!.localized(context),
                        style: TextStyle(fontSize: 12, color: colors.mutedForeground)),
                  ),
                if (item.specialInstructions != null && item.specialInstructions!.isNotEmpty)
                  Padding(
                    padding: const EdgeInsetsDirectional.only(start: 24),
                    child: AppText('"${item.specialInstructions}"',
                        style: TextStyle(fontSize: 12, color: colors.mutedForeground, fontStyle: FontStyle.italic)),
                  ),
              ],
            ),
          ),
        if (order.customerNote != null && order.customerNote!.isNotEmpty)
          AppText(l10n.noteWithText(order.customerNote!),
              style: TextStyle(fontSize: 13, color: colors.mutedForeground)),
      ],
    );
  }
}

class _StatusDot extends StatelessWidget {
  final OrderStatus status;

  const _StatusDot({required this.status});

  @override
  Widget build(BuildContext context) {
    final color = switch (status) {
      OrderStatus.awaitingValidation || OrderStatus.submitted => Colors.orange,
      OrderStatus.confirmed => AppTheme.successColor,
      OrderStatus.cancelled => context.theme.colors.destructive,
    };
    return Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle));
  }
}
