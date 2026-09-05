import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/models/money.dart';
import '../../../core/providers/locale_provider.dart';
import '../models/sale_line.dart';

/// One line of the running sale: name, options, note, and the quantity
/// stepper — the minus becomes a bin on the last unit.
class CartLineRow extends ConsumerWidget {
  final SaleLine line;
  final void Function(String key, int quantity) onSetQuantity;

  const CartLineRow({super.key, required this.line, required this.onSetQuantity});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final isArabic = ref.watch(localeProvider).languageCode == 'ar';

    final name = isArabic && line.nameAr.isNotEmpty ? line.nameAr : line.nameEn;
    final options = line.customizations
        .map((c) => isArabic && (c.optionNameAr?.isNotEmpty ?? false) ? c.optionNameAr! : c.optionNameEn)
        .join(' · ');

    Widget stepButton(IconData icon, VoidCallback onPress, {Color? color}) => SizedBox.square(
          dimension: 36,
          child: FButton.icon(
            variant: FButtonVariant.outline,
            onPress: onPress,
            child: Icon(icon, size: 16, color: color),
          ),
        );

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500)),
                if (options.isNotEmpty)
                  Text(options, maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground)),
                if (line.specialInstructions?.isNotEmpty ?? false)
                  Text('"${line.specialInstructions}"', maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground, fontStyle: FontStyle.italic)),
                const SizedBox(height: 6),
                Row(
                  children: [
                    stepButton(
                      line.quantity == 1 ? FIcons.trash2 : FIcons.minus,
                      () => onSetQuantity(line.key, line.quantity - 1),
                      color: line.quantity == 1 ? theme.colors.destructive : null,
                    ),
                    SizedBox(
                      width: 32,
                      child: Text(
                        '${line.quantity}',
                        textAlign: TextAlign.center,
                        style: theme.typography.sm.copyWith(
                          fontWeight: FontWeight.w600,
                          fontFeatures: const [FontFeature.tabularFigures()],
                        ),
                      ),
                    ),
                    stepButton(FIcons.plus, () => onSetQuantity(line.key, line.quantity + 1)),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(width: 8),
          Text(
            money(context, line.total),
            style: theme.typography.sm.copyWith(
              fontWeight: FontWeight.w600,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}
