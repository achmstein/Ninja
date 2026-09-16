import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import '../../../core/models/money.dart';
import '../../../core/widgets/pos_dialog.dart';
import '../../../l10n/app_localizations.dart';
import '../../tickets/models/ticket_detail.dart';

/// The bill's parts, one label/value row each, a tap away from the total:
/// menu money, the discount, service, VAT (out of the price or on top), and
/// what has already gone back. The action bar itself shows the total only.
Future<void> showBreakdownDialog(BuildContext context, TicketDetail ticket) {
  return showPosDialog<void>(
    context,
    maxWidth: 384,
    builder: (context) => _BreakdownDialog(ticket: ticket),
  );
}

class _BreakdownDialog extends StatelessWidget {
  final TicketDetail ticket;

  const _BreakdownDialog({required this.ticket});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    const tabular = [FontFeature.tabularFigures()];

    final rows = <(String, String, bool, bool)>[
      (l10n.subtotal, money(context, ticket.subtotal), false, false),
      if (ticket.discount > 0) (l10n.discount, '−${money(context, ticket.discount)}', false, true),
      if (ticket.serviceCharge > 0)
        (l10n.serviceCharge(rateText(ticket.serviceChargeRate)), money(context, ticket.serviceCharge), false, false),
      if (ticket.vat > 0)
        (
          ticket.vatIncluded ? l10n.vatIncluded(rateText(ticket.vatRate)) : l10n.vat(rateText(ticket.vatRate)),
          money(context, ticket.vat),
          false,
          false,
        ),
      (l10n.total, money(context, ticket.total), true, false),
      if (ticket.refundedTotal > 0) (l10n.refundedSoFar, '−${money(context, ticket.refundedTotal)}', false, true),
    ];

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.breakdown, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 16),
          Container(
            decoration: BoxDecoration(
              border: Border.all(color: theme.colors.border),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                for (var i = 0; i < rows.length; i++) ...[
                  if (i > 0) Container(height: 1, color: theme.colors.border),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.baseline,
                      textBaseline: TextBaseline.alphabetic,
                      children: [
                        Expanded(
                          child: Text(rows[i].$1,
                              style: theme.typography.base.copyWith(
                                color: rows[i].$3 ? null : theme.colors.mutedForeground,
                                fontWeight: rows[i].$3 ? FontWeight.w600 : null,
                              )),
                        ),
                        Text(rows[i].$2,
                            style: theme.typography.base.copyWith(
                              fontWeight: rows[i].$3 ? FontWeight.w600 : null,
                              color: rows[i].$4 ? theme.colors.destructive : null,
                              fontFeatures: tabular,
                            )),
                      ],
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
