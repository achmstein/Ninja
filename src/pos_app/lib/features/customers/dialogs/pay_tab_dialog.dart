import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:uuid/uuid.dart';
import '../../../core/models/money.dart';
import '../../../core/printing/print_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/numeric_keypad.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../../receipt/tab_payment_sheet.dart';
import '../../shifts/providers/shifts_provider.dart';
import '../../ticket/tenders.dart';
import '../../ticket/widgets/tender_grid.dart';
import '../../tickets/models/enums.dart';
import '../../tickets/models/tab_payment.dart';
import '../../tickets/services/tickets_service.dart';
import '../models/customer_card.dart';
import '../providers/customer_providers.dart';

/// Take money against a customer's tab: cash into the drawer, card or
/// InstaPay to the terminal. The whole balance is prefilled — the common
/// case is "I'll pay it all" — and the amount cannot exceed it: a tab is
/// paid down, never overpaid into credit from the till. Sales numbers the
/// slip and stamps it with the open shift; Accounts lowers the balance off
/// the event. Returns the slip once recorded, null if the cashier backed out.
Future<TabPaymentSlip?> showPayTabDialog(BuildContext context, {required CardCustomer customer, required double balance}) {
  return showFDialog<TabPaymentSlip>(
    context: context,
    useRootNavigator: true,
    builder: (context, style, animation) => FDialog.raw(
      style: style,
      animation: animation,
      constraints: const BoxConstraints(maxWidth: 448),
      builder: (context, _) => _PayTabDialog(customer: customer, balance: balance),
    ),
  );
}

class _PayTabDialog extends ConsumerStatefulWidget {
  final CardCustomer customer;
  final double balance;
  const _PayTabDialog({required this.customer, required this.balance});

  @override
  ConsumerState<_PayTabDialog> createState() => _PayTabDialogState();
}

class _PayTabDialogState extends ConsumerState<_PayTabDialog> {
  PaymentTender _tender = PaymentTender.cash;
  late String _amountStr;
  bool _saving = false;
  TabPaymentSlip? _slip;
  // One request id per dialog: a retry on café Wi-Fi must not take the money twice
  final String _requestId = const Uuid().v4();

  double get _entered => double.tryParse(_amountStr.isEmpty ? '0' : _amountStr) ?? 0;
  double get _amount => _entered < widget.balance ? _entered : widget.balance;
  bool get _overBalance => _entered > widget.balance;

  @override
  void initState() {
    super.initState();
    _amountStr = widget.balance > 0 ? _fmt(widget.balance) : '';
  }

  static String _fmt(double v) {
    final s = v.toStringAsFixed(2);
    return s.endsWith('.00') ? s.substring(0, s.length - 3) : s;
  }

  Future<void> _print(TabPaymentSlip slip, {bool auto = false}) async {
    final l10n = AppLocalizations.of(context)!;
    try {
      await ref.read(printServiceProvider).printTabPayment(
            slip,
            l10n: l10n,
            locale: Localizations.localeOf(context),
            kickDrawer: auto && slip.tender == PaymentTender.cash,
          );
      if (mounted && !auto) showPosToast(context, PosToastType.success, l10n.printed);
    } catch (e) {
      if (mounted) showPosToast(context, PosToastType.error, describePrintError(e, l10n));
    }
  }

  Future<void> _confirm() async {
    final amount = _amount;
    if (amount <= 0 || _saving) return;
    setState(() => _saving = true);
    try {
      final result = await ref.read(ticketsRepositoryProvider).recordTabPayment(
            TabPaymentRequest(
              customerId: widget.customer.id,
              customerName: widget.customer.name.isNotEmpty ? widget.customer.name : null,
              tender: _tender,
              amount: amount,
            ),
            requestId: _requestId,
          );
      invalidateCustomerFrom(ref, widget.customer.id);
      ref.read(currentShiftProvider.notifier).refresh();
      if (!mounted) return;
      final slip = TabPaymentSlip(
        number: result.number,
        customerName: widget.customer.name,
        tender: _tender,
        amount: amount,
        balanceBefore: widget.balance,
        at: DateTime.now(),
      );
      setState(() => _slip = slip);
      // The slip comes out by itself, and cash opens the drawer
      if (ref.read(printServiceProvider).isConfigured) _print(slip, auto: true);
    } catch (e) {
      if (!mounted) return;
      final l10n = AppLocalizations.of(context)!;
      showPosToast(context, PosToastType.error, e is SalesException ? e.message : l10n.failedToPayTab);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    const tabular = [FontFeature.tabularFigures()];
    final slip = _slip;

    if (slip != null) {
      return Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Icon(FIcons.circleCheck, size: 56, color: AppColors.emerald500),
            const SizedBox(height: 12),
            Text(l10n.tabPaymentRecorded, textAlign: TextAlign.center, style: theme.typography.xl2.copyWith(fontWeight: FontWeight.w600)),
            if (slip.number > 0) ...[
              const SizedBox(height: 8),
              Text(l10n.tabPaymentNumber(slip.number),
                  textAlign: TextAlign.center,
                  style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600, fontFeatures: tabular)),
            ],
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(color: theme.colors.secondary, borderRadius: BorderRadius.circular(14)),
              child: Column(
                children: [
                  Text(l10n.newBalance, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
                  Text(money(context, slip.balanceAfter < 0 ? 0 : slip.balanceAfter),
                      style: theme.typography.xl4.copyWith(fontWeight: FontWeight.w700, fontFeatures: tabular)),
                ],
              ),
            ),
            const SizedBox(height: 20),
            Row(
              children: [
                Expanded(
                  child: SizedBox(
                    height: 56,
                    child: FButton(
                      variant: FButtonVariant.outline,
                      onPress: () => Navigator.of(context, rootNavigator: true).pop(slip),
                      child: Text(l10n.done, style: theme.typography.base.forButton),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: SizedBox(
                    height: 56,
                    child: FButton(
                      onPress: () => _print(slip),
                      prefix: const Icon(FIcons.printer, size: 20),
                      child: Text(l10n.print, style: theme.typography.base.forButton),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      );
    }

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsetsDirectional.fromSTEB(20, 12, 20, 12),
          decoration: BoxDecoration(border: Border(bottom: BorderSide(color: theme.colors.border))),
          // The name on its own line: a long one must not squeeze the amount
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Expanded(child: Text(l10n.payTab, style: theme.typography.lg.copyWith(fontWeight: FontWeight.w600))),
                  const SizedBox(width: 12),
                  Text(
                    l10n.owesAmount(money(context, widget.balance)),
                    style: theme.typography.xl.copyWith(fontWeight: FontWeight.w700, fontFeatures: tabular),
                  ),
                ],
              ),
              Text(
                widget.customer.name.isNotEmpty ? widget.customer.name : l10n.guest,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TenderGrid(
                tenders: baseTenders,
                selected: _tender,
                onSelect: (tender) => setState(() => _tender = tender),
              ),
              const SizedBox(height: 12),
              Directionality(
                textDirection: TextDirection.ltr,
                child: Container(
                  height: 56,
                  alignment: Alignment.centerRight,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(10)),
                  child: Text(
                    _amountStr.isEmpty ? '0' : _amountStr,
                    style: theme.typography.xl3.copyWith(fontWeight: FontWeight.w700, fontFeatures: tabular),
                  ),
                ),
              ),
              if (_overBalance) ...[
                const SizedBox(height: 6),
                Text(l10n.cappedAtBalance(money(context, widget.balance)),
                    style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
              ],
              const SizedBox(height: 12),
              NumericKeypad(value: _amountStr, onChange: (v) => setState(() => _amountStr = v)),
              const SizedBox(height: 12),
              SizedBox(
                height: 56,
                child: FButton(
                  onPress: _amount > 0 && !_saving ? _confirm : null,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  suffix: Text(money(context, _amount), style: theme.typography.lg.forButton.copyWith(fontFeatures: tabular)),
                  child: Text(l10n.confirmTabPayment, style: theme.typography.lg.forButton),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
