import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/layout/breakpoints.dart';
import '../../../core/models/money.dart';
import 'package:ninja_app_core/providers/locale_provider.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import '../models/sale_line.dart';
import '../../../core/theme/type_roles.dart';

/// One line of the running sale: name, options, note, and the quantity
/// stepper — the minus becomes a bin on the last unit. On an open bill it is
/// [marked] down its start edge, so what is new is told from what was sent
/// at a glance.
class CartLineRow extends ConsumerWidget {
  final SaleLine line;
  final void Function(String key, int quantity) onSetQuantity;

  /// On an open bill, where sent lines sit under it
  final bool marked;

  const CartLineRow({super.key, required this.line, required this.onSetQuantity, this.marked = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final locale = ref.watch(localeProvider);

    final name = line.name.getText(locale);
    final options = line.customizations.map((c) => c.optionName.getText(locale)).join(' · ');

    // In the phone's sheet the steppers are a finger's 48; the tablet's
    // column keeps its tighter rows
    final step = context.isNarrow ? Sizes.control : Sizes.controlSmall;
    Widget stepButton(IconData icon, VoidCallback onPress, {Color? color}) => SizedBox.square(
          dimension: step,
          child: FButton.icon(
            variant: FButtonVariant.outline,
            onPress: onPress,
            child: Icon(icon, size: Sizes.iconSmall, color: color),
          ),
        );

    return Container(
      // The mark takes its three points out of the padding: the words stay in line with the rows under them
      padding: EdgeInsetsDirectional.fromSTEB(marked ? 9 : 12, 8, 12, 8),
      decoration: marked
          ? BoxDecoration(
              color: theme.colors.primary.withValues(alpha: 0.05),
              border: BorderDirectional(start: BorderSide(color: theme.colors.primary, width: 3)),
            )
          : null,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(name, maxLines: 1, overflow: TextOverflow.ellipsis,
                    style: theme.type.detail.copyWith(fontWeight: FontWeight.w500)),
                if (options.isNotEmpty)
                  Text(options, maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: theme.type.caption.copyWith(color: theme.colors.mutedForeground)),
                if (line.specialInstructions?.isNotEmpty ?? false)
                  Text('"${line.specialInstructions}"', maxLines: 1, overflow: TextOverflow.ellipsis,
                      style: theme.type.caption.copyWith(color: theme.colors.mutedForeground, fontStyle: FontStyle.italic)),
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
                        style: theme.type.detail.copyWith(
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
            style: theme.type.detail.copyWith(
              fontWeight: FontWeight.w600,
              fontFeatures: const [FontFeature.tabularFigures()],
            ),
          ),
        ],
      ),
    );
  }
}
