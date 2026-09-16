import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:intl/intl.dart' show DateFormat;
import '../../../core/models/localized_text.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../models/receipt.dart';
import '../services/receipt_service.dart';

/// The customer's own copy of the printed receipt: what the till printed,
/// laid out the same way, for a bill they were on.
class ReceiptScreen extends ConsumerWidget {
  final int ticketId;

  const ReceiptScreen({super.key, required this.ticketId});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final colors = context.theme.colors;
    final receipt = ref.watch(receiptProvider(ticketId));

    return FScaffold(
      child: SafeArea(
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.only(left: 8, right: 16, top: 8, bottom: 8),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: const Icon(FIcons.arrowLeft, size: 22),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: AppText(
                      receipt.value != null ? l10n.receiptNumber(receipt.value!.receiptNumber) : l10n.receipt,
                      style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: receipt.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (_, _) => Center(
                  child: AppText(l10n.receiptUnavailable, style: TextStyle(color: colors.mutedForeground)),
                ),
                data: (r) => SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: _ReceiptBody(receipt: r),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ReceiptBody extends ConsumerWidget {
  final Receipt receipt;

  const _ReceiptBody({required this.receipt});

  String _tender(String tender, AppLocalizations l10n) => switch (tender) {
        'Cash' => l10n.cash,
        'Card' => l10n.card,
        'InstaPay' => l10n.instapay,
        'Account' => l10n.account,
        _ => tender,
      };

  static String _pct(double rate) => (rate * 100).round().toString();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final locale = Localizations.localeOf(context).languageCode;
    final branch = ref.watch(branchProvider).branches.where((b) => b.id == receipt.branchId).firstOrNull;
    String money(double v) => l10n.priceFormat(v.toStringAsFixed(2));
    // The paper the till prints: black on white whatever the theme
    const ink = Colors.black;
    const base = TextStyle(fontSize: 12, color: ink, height: 1.3);
    const muted = TextStyle(fontSize: 11, color: ink, height: 1.3);
    const tabular = [FontFeature.tabularFigures()];
    final hasBreakdown = receipt.discount > 0 || receipt.serviceCharge > 0 || receipt.vat > 0;

    Widget row(String label, String value, {TextStyle style = base}) => Row(
          crossAxisAlignment: CrossAxisAlignment.baseline,
          textBaseline: TextBaseline.alphabetic,
          children: [
            Expanded(child: AppText(label, style: style)),
            const SizedBox(width: 8),
            AppText(value, style: style.copyWith(fontFeatures: tabular)),
          ],
        );
    const rule = Padding(
      padding: EdgeInsets.symmetric(vertical: 6),
      child: CustomPaint(size: Size(double.infinity, 1), painter: _DashedLine(ink)),
    );
    final footer = branch?.receiptFooter?.localized(context).trim();

    return Center(
      child: Container(
        width: 300,
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
        decoration: BoxDecoration(
          color: Colors.white,
          boxShadow: [BoxShadow(color: Colors.black.withValues(alpha: 0.08), blurRadius: 4, offset: const Offset(0, 1))],
        ),
        child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Column(
            children: [
              // The wordmark, about half the paper wide, as the till prints it
              Image.asset('assets/images/logo.png', width: 136),
              const SizedBox(height: 8),
              if (branch != null) ...[
                AppText(branch.name.localized(context), style: base.copyWith(fontWeight: FontWeight.w600)),
                if (branch.address != null) AppText(branch.address!.localized(context), style: muted, textAlign: TextAlign.center),
                if (branch.phone != null)
                  Directionality(textDirection: TextDirection.ltr, child: AppText(branch.phone!, style: muted)),
                if (branch.taxNumber != null) AppText(l10n.taxNumber(branch.taxNumber!), style: muted),
                const SizedBox(height: 6),
              ],
              AppText(l10n.receiptNumber(receipt.receiptNumber), style: base.copyWith(fontSize: 13, fontWeight: FontWeight.w600)),
              AppText(
                '${l10n.receiptDate}: ${DateFormat.yMd(locale).add_jm().format(receipt.settledAt.toLocal())}',
                style: muted.copyWith(fontFeatures: tabular),
                textAlign: TextAlign.center,
              ),
              if (receipt.locationName != null) AppText(receipt.locationName!.localized(context), style: muted),
            ],
          ),
          rule,
          for (final line in receipt.lines) ...[
            row(line.description.localized(context), money(line.total)),
            AppText(
              '${line.qty % 1 == 0 ? line.qty.toInt() : line.qty} × ${money(line.unitPrice)}'
              '${line.discount > 0 ? ' − ${money(line.discount)} (${l10n.discount})' : ''}'
              '${line.customerName != null ? ' · ${line.customerName}' : ''}',
              style: muted.copyWith(fontSize: 10, fontFeatures: tabular),
            ),
            if (line.details != null) AppText(line.details!.localized(context), style: muted.copyWith(fontSize: 10)),
            const SizedBox(height: 6),
          ],
          rule,
          if (hasBreakdown) ...[
            row(l10n.subtotal, money(receipt.subtotal), style: muted),
            if (receipt.discount > 0)
              row(
                '${l10n.discount}${receipt.discountRate != null ? ' ${_pct(receipt.discountRate!)}%' : ''}',
                '−${money(receipt.discount)}',
                style: muted,
              ),
            if (receipt.serviceCharge > 0)
              row(l10n.serviceCharge(_pct(receipt.serviceChargeRate)), money(receipt.serviceCharge), style: muted),
            if (receipt.vat > 0 && !receipt.vatIncluded)
              row(l10n.vat(_pct(receipt.vatRate)), money(receipt.vat), style: muted),
            const SizedBox(height: 4),
          ],
          row(l10n.total, money(receipt.total), style: base.copyWith(fontSize: 15, fontWeight: FontWeight.w700)),
          if (receipt.vat > 0 && receipt.vatIncluded)
            row(l10n.vatIncluded(_pct(receipt.vatRate)), money(receipt.vat), style: muted.copyWith(fontSize: 10)),
          const SizedBox(height: 8),
          for (final payment in receipt.payments)
            row(
              payment.customerName != null
                  ? '${_tender(payment.tender, l10n)} · ${payment.customerName}'
                  : _tender(payment.tender, l10n),
              money(payment.amount),
            ),
          if (receipt.changeGiven > 0)
            row(l10n.changeDue, money(receipt.changeGiven), style: base.copyWith(fontWeight: FontWeight.w600)),
          if (receipt.refunds.isNotEmpty) ...[
            rule,
            for (final refund in receipt.refunds) ...[
              row(l10n.creditNote(refund.number), '−${money(refund.amount)}'),
              if (refund.reason.isNotEmpty) AppText(refund.reason, style: muted.copyWith(fontSize: 10)),
            ],
            row(l10n.refunded, '−${money(receipt.refundedTotal)}', style: base.copyWith(fontWeight: FontWeight.w600)),
          ],
          const SizedBox(height: 12),
          AppText(footer != null && footer.isNotEmpty ? footer : l10n.receiptThanks, style: base, textAlign: TextAlign.center),
        ],
      ),
      ),
    );
  }
}

/// The dashed rule a thermal receipt draws between its parts
class _DashedLine extends CustomPainter {
  final Color color;

  const _DashedLine(this.color);

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = 1;
    for (double x = 0; x < size.width; x += 6) {
      canvas.drawLine(Offset(x, 0), Offset(x + 3, 0), paint);
    }
  }

  @override
  bool shouldRepaint(_DashedLine oldDelegate) => oldDelegate.color != color;
}
