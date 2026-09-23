import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/network/api_client.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/printing/kitchen_printing.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/pos_dialog.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../../tickets/models/ticket_detail.dart';

/// The bill's "Kitchen tickets" button: the paper jammed, or a cook lost a
/// ticket. Only where the branch has a station that prints, and only for a
/// bill that has orders on it.
class KitchenReprintButton extends ConsumerWidget {
  final TicketDetail ticket;

  const KitchenReprintButton({super.key, required this.ticket});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final prints = ref.watch(branchPrintsKitchenTicketsProvider).value ?? false;
    if (!prints || ticket.lines.every((line) => line.orderId == null)) return const SizedBox.shrink();

    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    return Padding(
      padding: const EdgeInsetsDirectional.only(start: 4),
      child: SizedBox(
        height: 48,
        child: FButton(
          variant: FButtonVariant.outline,
          mainAxisSize: MainAxisSize.min,
          onPress: () => showPosDialog<void>(context, builder: (_) => _KitchenReprintDialog(ticket: ticket)),
          prefix: const Icon(FIcons.printer, size: 20),
          child: Text(l10n.kitchenTickets, style: theme.typography.base.forButton),
        ),
      ),
    );
  }
}

/// The bill's orders, newest first, each with what was on it and a Reprint
/// that sends every station's ticket for it to its printer again, marked
/// REPRINT so the kitchen does not make it twice.
class _KitchenReprintDialog extends ConsumerStatefulWidget {
  final TicketDetail ticket;

  const _KitchenReprintDialog({required this.ticket});

  @override
  ConsumerState<_KitchenReprintDialog> createState() => _KitchenReprintDialogState();
}

class _KitchenReprintDialogState extends ConsumerState<_KitchenReprintDialog> {
  final Set<int> _sending = {};
  final Set<int> _sent = {};

  Future<void> _reprint(int orderId) async {
    final l10n = AppLocalizations.of(context)!;
    setState(() => _sending.add(orderId));
    try {
      await reprintOrderTickets(ref.read(ordersApiProvider), orderId);
      if (!mounted) return;
      setState(() => _sent.add(orderId));
      showPosToast(context, PosToastType.success, l10n.kitchenTicketsSent);
    } catch (e) {
      if (mounted) showPosToast(context, PosToastType.error, describeError(e, l10n));
    } finally {
      if (mounted) setState(() => _sending.remove(orderId));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;

    // One entry per order, in the order they came in, newest on top
    final byOrder = <int, List<TicketLineView>>{};
    for (final line in widget.ticket.lines) {
      final orderId = line.orderId;
      if (orderId != null) (byOrder[orderId] ??= []).add(line);
    }
    final orders = byOrder.entries.toList().reversed.toList();

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.kitchenTickets, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text(l10n.kitchenTicketsHint, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
          const SizedBox(height: 16),
          Flexible(
            child: SingleChildScrollView(
              child: Column(
                children: [
                  for (final (index, entry) in orders.indexed) ...[
                    if (index > 0) Divider(height: 1, color: theme.colors.border),
                    Padding(
                      padding: const EdgeInsets.symmetric(vertical: 10),
                      child: Row(
                        children: [
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  l10n.orderNumber(entry.key),
                                  style: theme.typography.base.copyWith(
                                    fontWeight: FontWeight.w600,
                                    fontFeatures: const [FontFeature.tabularFigures()],
                                  ),
                                ),
                                Text(
                                  entry.value
                                      .map((line) => '${_qty(line.qty)}× ${line.description?.localized(context) ?? ''}')
                                      .join(' · '),
                                  style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground),
                                  maxLines: 2,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 12),
                          SizedBox(
                            height: 48,
                            child: FButton(
                              variant: _sent.contains(entry.key) ? FButtonVariant.secondary : FButtonVariant.outline,
                              mainAxisSize: MainAxisSize.min,
                              onPress: _sending.contains(entry.key) ? null : () => _reprint(entry.key),
                              prefix: Icon(_sent.contains(entry.key) ? FIcons.check : FIcons.printer, size: 20),
                              child: Text(l10n.reprint, style: theme.typography.base.forButton),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          Align(
            alignment: AlignmentDirectional.centerEnd,
            child: SizedBox(
              height: 48,
              child: FButton(
                variant: FButtonVariant.outline,
                mainAxisSize: MainAxisSize.min,
                onPress: () => Navigator.of(context, rootNavigator: true).pop(),
                child: Text(l10n.close, style: theme.typography.base.forButton),
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Whole quantities print as "2", a half portion as "0.5"
  static String _qty(double qty) => qty % 1 == 0 ? qty.toInt().toString() : qty.toString();
}
