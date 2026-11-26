import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import '../../../core/models/money.dart';
import '../../../core/utils/bidi.dart';
import '../../../core/widgets/pos_dialog.dart';
import '../../../l10n/app_localizations.dart';
import '../bill_payers.dart';

/// What "Who is paying?" was answered with: one payer's own part, or with no
/// payer the whole of what is left
class PayChoice {
  final Payer? payer;

  const PayChoice.everything() : payer = null;
  const PayChoice.part(Payer this.payer);
}

/// Asks who is paying; null when the question was put away unanswered
Future<PayChoice?> showPayWho(
  BuildContext context, {
  required String title,
  required double total,
  required List<Payer> payers,
  bool partPaid = false,
}) =>
    showPosDialog<PayChoice>(
      context,
      maxWidth: 512,
      builder: (context) => PayWhoSheet(
        title: title,
        total: total,
        payers: payers,
        partPaid: partPaid,
        onPick: (choice) => Navigator.of(context, rootNavigator: true).pop(choice),
      ),
    );

/// "Who is paying?", asked when a bill is more than one person's: everything
/// in one payment, or one person's own part. A part is paid on its own and
/// the bill stays open for the rest. The web till's PayWhoSheet is the same.
class PayWhoSheet extends StatelessWidget {
  /// The bill's own name, said for the lines that were nobody's
  final String title;

  /// What is left to pay on the whole bill
  final double total;
  final List<Payer> payers;

  /// Part of the bill is paid already: "everything" is then the rest
  final bool partPaid;
  final ValueChanged<PayChoice> onPick;

  const PayWhoSheet({
    super.key,
    required this.title,
    required this.total,
    required this.payers,
    this.partPaid = false,
    required this.onPick,
  });

  static String _qty(double qty) => qty == qty.roundToDouble() ? qty.toStringAsFixed(0) : qty.toString();

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    const tabular = [FontFeature.tabularFigures()];
    final heading = theme.typography.base.copyWith(fontWeight: FontWeight.w600);

    Widget row({required Widget words, required String amount, required TextStyle amountStyle, required VoidCallback onPress}) =>
        FTappable(
          onPress: onPress,
          builder: (context, states, child) => Container(
            constraints: const BoxConstraints(minHeight: 64),
            color: states.contains(FTappableVariant.pressed) ? theme.colors.secondary : null,
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            child: child,
          ),
          child: Row(
            children: [
              Expanded(child: words),
              const SizedBox(width: 12),
              Text(amount, maxLines: 1, style: amountStyle.copyWith(fontFeatures: tabular)),
            ],
          ),
        );

    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.9),
      child: DialogScroll(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(l10n.payWhoTitle, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
            const SizedBox(height: 16),
            Container(
              clipBehavior: Clip.antiAlias,
              decoration: BoxDecoration(
                border: Border.all(color: theme.colors.border),
                borderRadius: BorderRadius.circular(Sizes.radius),
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  row(
                    words: Text(partPaid ? l10n.payTheRest : l10n.payEverything,
                        maxLines: 1, overflow: TextOverflow.ellipsis, style: heading),
                    amount: money(context, total),
                    amountStyle: heading,
                    onPress: () => onPick(const PayChoice.everything()),
                  ),
                  for (final payer in payers) ...[
                    Container(height: 1, color: theme.colors.border),
                    row(
                      words: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Their whole name, in its own script, cut at its
                          // end and still where the row starts
                          Text(payer.name ?? title,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              textDirection: textDirectionFor(payer.name ?? title),
                              textAlign: textAlignFor(context),
                              style: heading),
                          Text(
                              [
                                for (final line in payer.lines)
                                  '${_qty(line.qty)}× ${line.description?.localized(context) ?? ''}',
                              ].join(' · '),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
                        ],
                      ),
                      amount: money(context, payer.subtotal),
                      amountStyle: theme.typography.base,
                      onPress: () => onPick(PayChoice.part(payer)),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 12),
            Text(l10n.payWhoHint, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
          ],
        ),
      ),
    );
  }
}
