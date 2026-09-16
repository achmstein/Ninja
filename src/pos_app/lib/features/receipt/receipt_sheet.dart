import '../../core/models/branch.dart';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import '../../core/models/money.dart';
import '../../l10n/app_localizations.dart';
import '../ticket/tenders.dart';
import '../tickets/models/enums.dart';
import '../tickets/models/ticket_detail.dart';
import 'sheet_widgets.dart';

export 'sheet_widgets.dart' show receiptWidth;

/// What was paid, as the settle dialog knows it before the refetched
/// ticket lands — so Print works the instant the drawer opens.
class ReceiptPayment {
  final PaymentTender tender;
  final double amount;
  const ReceiptPayment({required this.tender, required this.amount});
}

/// The 80 mm receipt, laid out the way pos_web prints it: brand, receipt
/// number, date and place; every line with its qty × price; the frozen
/// money block — subtotal, service, VAT (out of an inclusive price, or on
/// top), total — then what was paid, the change, and any credit notes
/// issued since. Rendered off screen and printed as an image, so it looks
/// the same on every printer and in both languages.
class ReceiptSheet extends StatelessWidget {
  final TicketDetail ticket;
  final AppLocalizations l10n;
  final Locale locale;
  final List<ReceiptPayment>? paymentsOverride;
  final int? receiptNumberOverride;

  /// The till's own number on an offline sale; beside the real one once
  /// the sale has been replayed
  final String? provisionalReceiptNumber;

  /// The decoded wordmark; the name prints as text without it
  final ui.Image? logo;

  /// Whose receipt: name, address, phone and tax number under the wordmark,
  /// its own footer line at the bottom
  final Branch? branch;

  const ReceiptSheet({
    super.key,
    required this.ticket,
    required this.l10n,
    required this.locale,
    this.logo,
    this.branch,
    this.paymentsOverride,
    this.receiptNumberOverride,
    this.provisionalReceiptNumber,
  });

  @override
  Widget build(BuildContext context) {
    final payments = paymentsOverride ??
        [for (final p in ticket.payments) ReceiptPayment(tender: p.tender, amount: p.amount)];
    final paid = payments.fold<double>(0, (sum, p) => sum + p.amount);
    final change = paid - ticket.total > 0 ? paid - ticket.total : 0.0;
    final hasBreakdown = ticket.discount > 0 || ticket.serviceCharge > 0 || ticket.vat > 0;
    final receiptNumber = receiptNumberOverride ?? ticket.receiptNumber;
    final provisional = provisionalReceiptNumber ?? ticket.provisionalReceiptNumber;
    final placeName = ticket.locationName?.getText(locale) ?? '';

    return Paper(
      locale: locale,
      children: [
        SheetCentered(children: [
          BrandMark(logo: logo, text: l10n.brandName),
          if (branch != null) ...[
            Text(branch!.name.getText(locale), style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w600)),
            if ((branch!.address?.getText(locale) ?? '').isNotEmpty)
              Text(branch!.address!.getText(locale), style: const TextStyle(fontSize: 20)),
            if (branch!.phone != null) Text(branch!.phone!, style: const TextStyle(fontSize: 20)),
            if (branch!.taxNumber != null) Text(l10n.taxNumber(branch!.taxNumber!), style: const TextStyle(fontSize: 20)),
            const SizedBox(height: 6),
          ],
          if (receiptNumber != null)
            Text(l10n.receiptNumber(receiptNumber), style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w600)),
          if (provisional != null)
            Text(l10n.provisionalReceipt(provisional),
                style: TextStyle(fontSize: receiptNumber == null ? 26 : 22, fontWeight: receiptNumber == null ? FontWeight.w600 : FontWeight.w400)),
          Text('${l10n.receiptDate}: ${sheetDate(ticket.settledAt ?? DateTime.now(), locale)}',
              style: const TextStyle(fontSize: 22)),
          if (placeName.isNotEmpty) Text(placeName, style: const TextStyle(fontSize: 22)),
        ]),
        const SizedBox(height: 12),
        const Dashes(),
        const SizedBox(height: 8),
        for (final line in ticket.lines) ...[
          SheetRow(line.description?.getText(locale) ?? '', moneyWith(l10n, line.total)),
          Text(
            line.discount > 0
                ? '${_qty(line.qty)} × ${moneyWith(l10n, line.unitPrice)} − ${moneyWith(l10n, line.discount)} (${l10n.discount})'
                : '${_qty(line.qty)} × ${moneyWith(l10n, line.unitPrice)}',
            style: const TextStyle(fontSize: 20),
          ),
          if (line.details?.getText(locale) case final details? when details.isNotEmpty)
            Text(details, style: const TextStyle(fontSize: 20)),
          const SizedBox(height: 6),
        ],
        const SizedBox(height: 2),
        const Dashes(),
        const SizedBox(height: 8),
        if (hasBreakdown) ...[
          SheetRow(l10n.subtotal, moneyWith(l10n, ticket.subtotal), size: 22),
          if (ticket.discount > 0) SheetRow(l10n.discount, '−${moneyWith(l10n, ticket.discount)}', size: 22),
          if (ticket.serviceCharge > 0)
            SheetRow(l10n.serviceCharge(rateText(ticket.serviceChargeRate)), moneyWith(l10n, ticket.serviceCharge), size: 22),
          if (ticket.vat > 0 && !ticket.vatIncluded)
            SheetRow(l10n.vat(rateText(ticket.vatRate)), moneyWith(l10n, ticket.vat), size: 22),
        ],
        SheetRow(l10n.total, moneyWith(l10n, ticket.total), size: 30, weight: FontWeight.w700),
        if (ticket.vat > 0 && ticket.vatIncluded)
          SheetRow(l10n.vatIncluded(rateText(ticket.vatRate)), moneyWith(l10n, ticket.vat), size: 20),
        for (final payment in payments) SheetRow(tenderLabel(l10n, payment.tender), moneyWith(l10n, payment.amount)),
        if (change > 0) SheetRow(l10n.changeDue, moneyWith(l10n, change), weight: FontWeight.w600),
        if (ticket.refunds.isNotEmpty) ...[
          const SizedBox(height: 8),
          const Dashes(),
          const SizedBox(height: 8),
          for (final refund in ticket.refunds) ...[
            SheetRow(l10n.creditNote(refund.number), '−${moneyWith(l10n, refund.amount)}'),
            Text(refund.reason, style: const TextStyle(fontSize: 20)),
            const SizedBox(height: 4),
          ],
          SheetRow(l10n.refundedSoFar, '−${moneyWith(l10n, ticket.refundedTotal)}', weight: FontWeight.w600),
        ],
        const SizedBox(height: 16),
        SheetCentered(children: [
          Text(_footer(branch, locale) ?? l10n.receiptThanks, style: const TextStyle(fontSize: 24)),
        ]),
      ],
    );
  }

  static String? _footer(Branch? branch, Locale locale) {
    final text = branch?.receiptFooter?.getText(locale).trim() ?? '';
    return text.isEmpty ? null : text;
  }

  static String _qty(double qty) => qty == qty.roundToDouble() ? qty.toStringAsFixed(0) : qty.toString();
}

/// A few lines to prove the till and the printer talk to each other
class TestSheet extends StatelessWidget {
  final AppLocalizations l10n;
  final Locale locale;
  final ui.Image? logo;

  const TestSheet({super.key, required this.l10n, required this.locale, this.logo});

  @override
  Widget build(BuildContext context) {
    return Paper(
      locale: locale,
      children: [
        SheetCentered(children: [
          BrandMark(logo: logo, text: l10n.brandName),
          Text(l10n.testPrintTitle, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w600)),
          Text(sheetDate(DateTime.now(), locale), style: const TextStyle(fontSize: 22)),
        ]),
        const SizedBox(height: 12),
        const Dashes(),
        const SizedBox(height: 12),
        SheetCentered(children: [Text(l10n.testPrintBody, style: const TextStyle(fontSize: 24))]),
        const SizedBox(height: 12),
        const Dashes(),
        const SizedBox(height: 16),
        SheetCentered(children: [Text(l10n.receiptThanks, style: const TextStyle(fontSize: 24))]),
      ],
    );
  }
}
