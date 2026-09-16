import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../l10n/app_localizations.dart';
import '../models/kitchen_order.dart';
import '../providers/kitchen_orders_provider.dart';
import 'order_card.dart';
import 'order_grid.dart';

/// The day's finished orders, behind the clock icon in the header: newest
/// first, the same card the board showed, for a "was that with oat milk?"
/// look back — and a Bring back for the card bumped too early or the drink
/// that has to be made again. Resolves to the order number to bring back,
/// or null; the caller carries it out.
Future<int?> showHistoryDialog(BuildContext context) {
  final size = MediaQuery.sizeOf(context);
  return showFDialog<int>(
    context: context,
    useRootNavigator: true,
    builder: (context, style, animation) => FDialog.raw(
      style: style,
      animation: animation,
      constraints: BoxConstraints(maxWidth: size.width * 0.9, maxHeight: size.height * 0.85),
      builder: (context, _) => const _HistoryDialog(),
    ),
  );
}

class _HistoryDialog extends ConsumerWidget {
  const _HistoryDialog();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final orders = ref.watch(kitchenOrdersProvider).value ?? const <KitchenOrder>[];
    final finished = finishedOrders(orders);
    final now = DateTime.now();

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 12, 8, 12),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(l10n.history, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
                  ],
                ),
              ),
              SizedBox.square(
                dimension: 48,
                child: FButton.icon(
                  variant: FButtonVariant.ghost,
                  onPress: () => Navigator.of(context, rootNavigator: true).pop(),
                  child: const Icon(FIcons.x, size: 20),
                ),
              ),
            ],
          ),
        ),
        Container(height: 1, color: theme.colors.border),
        Flexible(
          child: finished.isEmpty
              ? Padding(
                  padding: const EdgeInsets.all(24),
                  child: Text(
                    l10n.noHistory,
                    style: theme.typography.lg.copyWith(color: theme.colors.mutedForeground),
                    textAlign: TextAlign.center,
                  ),
                )
              : OrderGrid(
                  children: [
                    for (final order in finished)
                      OrderCard(
                        key: ValueKey(order.orderNumber),
                        order: order,
                        now: now,
                        acting: false,
                        onBringBack: () => Navigator.of(context, rootNavigator: true).pop(order.orderNumber),
                      ),
                  ],
                ),
        ),
      ],
    );
  }
}
