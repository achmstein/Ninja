import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import '../../../core/models/money.dart';
import '../../../core/utils/bidi.dart';
import '../../../core/widgets/pos_dialog.dart';
import '../../../l10n/app_localizations.dart';
import '../bill_payers.dart';
import '../../../core/theme/type_roles.dart';

/// What "Who is paying?" was answered with: one payer's own part, an amount
/// on account of the bill from someone with nothing of their own on it, or
/// with neither the whole of what is left
class PayChoice {
  final Payer? payer;
  final bool onAccount;

  const PayChoice.everything()
      : payer = null,
        onAccount = false;
  const PayChoice.part(Payer this.payer) : onAccount = false;
  const PayChoice.account()
      : payer = null,
        onAccount = true;
}

/// Asks who is paying; null when the question was put away unanswered
Future<PayChoice?> showPayWho(
  BuildContext context, {
  required String title,
  required double total,
  required List<Payer> payers,
  bool partPaid = false,
  bool clockRunning = false,
}) =>
    showPosDialog<PayChoice>(
      context,
      size: DialogSize.lg,
      builder: (context) => PayWhoSheet(
        title: title,
        total: total,
        payers: payers,
        partPaid: partPaid,
        clockRunning: clockRunning,
        onPick: (choice) => Navigator.of(context, rootNavigator: true).pop(choice),
      ),
    );

/// "Who is paying?", asked when a bill is more than one person's: everything
/// in one payment, or one person's own part. A part is paid on its own and
/// the bill stays open for the rest.
///
/// Under a room's running clock it is always asked: someone may be leaving
/// while the others play on. Everything then means stopping the clock, and an
/// amount on account is there for whoever leaves with nothing of their own.
/// The web till's PayWhoSheet is the same.
class PayWhoSheet extends StatelessWidget {
  /// The bill's own name, said for the lines that were nobody's
  final String title;

  /// What is left to pay on the whole bill
  final double total;
  final List<Payer> payers;

  /// Part of the bill is paid already: "everything" is then the rest
  final bool partPaid;

  /// The room's clock is running: its time is not in the total yet
  final bool clockRunning;
  final ValueChanged<PayChoice> onPick;

  const PayWhoSheet({
    super.key,
    required this.title,
    required this.total,
    required this.payers,
    this.partPaid = false,
    this.clockRunning = false,
    required this.onPick,
  });

  static String _qty(double qty) => qty == qty.roundToDouble() ? qty.toStringAsFixed(0) : qty.toString();

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    const tabular = [FontFeature.tabularFigures()];
    final heading = theme.type.heading;

    Widget row({required Widget words, required String? amount, required TextStyle amountStyle, required VoidCallback onPress}) =>
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
              if (amount != null) ...[
                const SizedBox(width: 12),
                Text(amount, maxLines: 1, style: amountStyle.copyWith(fontFeatures: tabular)),
              ],
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
            Text(l10n.payWhoTitle, style: theme.type.title),
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
                    words: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(partPaid ? l10n.payTheRest : l10n.payEverything,
                            maxLines: 1, overflow: TextOverflow.ellipsis, style: heading),
                        if (clockRunning)
                          Text(l10n.payEverythingClock,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: theme.type.detail.copyWith(color: theme.colors.mutedForeground)),
                      ],
                    ),
                    // The time is still to come: the sum so far would read as the whole
                    amount: clockRunning ? null : money(context, total),
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
                              style: theme.type.detail.copyWith(color: theme.colors.mutedForeground)),
                        ],
                      ),
                      amount: money(context, payer.subtotal),
                      amountStyle: theme.type.body,
                      onPress: () => onPick(PayChoice.part(payer)),
                    ),
                  ],
                  if (clockRunning) ...[
                    Container(height: 1, color: theme.colors.border),
                    row(
                      words: Column(
                        mainAxisSize: MainAxisSize.min,
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(l10n.partPayOnAccount, maxLines: 1, overflow: TextOverflow.ellipsis, style: heading),
                          Text(l10n.partPayOnAccountHint,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: theme.type.detail.copyWith(color: theme.colors.mutedForeground)),
                        ],
                      ),
                      amount: null,
                      amountStyle: theme.type.body,
                      onPress: () => onPick(const PayChoice.account()),
                    ),
                  ],
                ],
              ),
            ),
            const SizedBox(height: 12),
            Text(l10n.payWhoHint, style: theme.type.detail.copyWith(color: theme.colors.mutedForeground)),
          ],
        ),
      ),
    );
  }
}
