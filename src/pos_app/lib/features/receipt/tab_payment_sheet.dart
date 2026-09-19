import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import '../../core/models/money.dart';
import '../../l10n/app_localizations.dart';
import '../ticket/tenders.dart';
import '../tickets/models/enums.dart';
import 'sheet_widgets.dart';

/// A tab payment as the till printed it — the customer's proof that money
/// came off their tab.
class TabPaymentSlip {
  /// 0 when the slip was already recorded by an earlier attempt
  final int number;
  final String customerName;
  final PaymentTender tender;
  final double amount;
  final double balanceBefore;
  final DateTime at;

  const TabPaymentSlip({
    required this.number,
    required this.customerName,
    required this.tender,
    required this.amount,
    required this.balanceBefore,
    required this.at,
  });

  double get balanceAfter => balanceBefore - amount;
}

/// The 80 mm slip for a tab payment, painted like the receipt: brand, slip
/// number, date, the customer, what they owed, what they paid and how, and
/// what is left.
class TabPaymentSheet extends StatelessWidget {
  final TabPaymentSlip slip;
  final AppLocalizations l10n;
  final Locale locale;
  final String brandName;
  final ui.Image? logo;

  const TabPaymentSheet({
    super.key,
    required this.slip,
    required this.l10n,
    required this.locale,
    required this.brandName,
    this.logo,
  });

  @override
  Widget build(BuildContext context) {
    return Paper(
      locale: locale,
      children: [
        SheetCentered(children: [
          SheetBrandMark(logo: logo, text: brandName),
          Text(l10n.tabPaymentSlip, style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w600)),
          if (slip.number > 0)
            Text(l10n.tabPaymentNumber(slip.number), style: const TextStyle(fontSize: 26, fontWeight: FontWeight.w600)),
          Text('${l10n.receiptDate}: ${sheetDate(slip.at, locale)}', style: const TextStyle(fontSize: 22)),
        ]),
        const SizedBox(height: 12),
        const Dashes(),
        const SizedBox(height: 8),
        SheetRow(l10n.customer, slip.customerName.isNotEmpty ? slip.customerName : l10n.guest),
        SheetRow(l10n.tabBalanceBefore, moneyWith(l10n, slip.balanceBefore)),
        SheetRow(tenderLabel(l10n, slip.tender), '−${moneyWith(l10n, slip.amount)}', size: 30, weight: FontWeight.w700),
        SheetRow(l10n.newBalance, moneyWith(l10n, slip.balanceAfter < 0 ? 0 : slip.balanceAfter), weight: FontWeight.w600),
        const SizedBox(height: 16),
        SheetCentered(children: [Text(l10n.receiptThanks)]),
      ],
    );
  }
}
