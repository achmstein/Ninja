import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/providers/locale_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/utils/money.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../../bills/services/bills_service.dart';
import '../services/pay_service.dart';
import 'pay_sheet.dart';

/// Under an open bill, when the café takes payments at the table: what the
/// table has paid online so far and what is left, and the two ways to pay
/// it from the phone. Nothing at all when the café does not.
class PayBillBar extends ConsumerWidget {
  final int ticketId;

  const PayBillBar({super.key, required this.ticketId});

  Future<void> _open(BuildContext context, WidgetRef ref, {required bool split}) async {
    final source = PaySource.ticket(ticketId);
    await showPaySheet(context, source, split: split);
    ref.invalidate(payViewProvider(source));
    ref.read(myBillsProvider.notifier).refresh();
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    if (!ref.watch(featuresProvider).payAtTable) return const SizedBox.shrink();
    final view = ref.watch(payViewProvider(PaySource.ticket(ticketId))).value;
    if (view == null || view.why == 'closed') return const SizedBox.shrink();

    final l10n = AppLocalizations.of(context)!;
    final colors = context.theme.colors;
    final money = MoneyFormat(view.options.currency, ref.watch(localeProvider));
    final why = payWhyText(l10n, view.why);
    const tabular = [FontFeature.tabularFigures()];

    Widget row(String label, String value, {Color? color, bool strong = false}) => Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Expanded(child: AppText(label, style: TextStyle(fontSize: 13, color: colors.mutedForeground))),
            AppText(
              value,
              style: TextStyle(
                fontSize: strong ? 15 : 13,
                fontWeight: strong ? FontWeight.bold : FontWeight.normal,
                color: color ?? colors.foreground,
                fontFeatures: tabular,
              ),
            ),
          ],
        );

    return Padding(
      padding: const EdgeInsetsDirectional.only(start: 18, top: 8),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (view.paid > 0) row(l10n.payPaidSoFar, money(view.paid), color: AppTheme.successColor),
          if (view.paid > 0 || view.held > 0) row(l10n.payRemaining, money(view.remaining), strong: true),
          if (!view.canPay && why != null) ...[
            const SizedBox(height: 4),
            AppText(why, style: TextStyle(fontSize: 12, color: colors.mutedForeground)),
          ],
          if (view.canPay) ...[
            const SizedBox(height: 8),
            Row(
              children: [
                Expanded(
                  child: FButton(
                    onPress: () => _open(context, ref, split: false),
                    prefix: const Icon(FIcons.creditCard),
                    child: Text(l10n.payFully),
                  ),
                ),
                if (view.options.canSplit) ...[
                  const SizedBox(width: 8),
                  Expanded(
                    child: FButton(
                      variant: FButtonVariant.outline,
                      onPress: () => _open(context, ref, split: true),
                      prefix: const Icon(FIcons.split),
                      child: Text(l10n.paySplitBill),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ],
      ),
    );
  }
}
