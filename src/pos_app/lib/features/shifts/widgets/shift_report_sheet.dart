import 'package:flutter/material.dart';
import '../../../core/models/money.dart';
import '../../../l10n/app_localizations.dart';
import '../../receipt/sheet_widgets.dart';
import '../../ticket/tenders.dart';
import '../models/shift.dart';

/// The 80 mm printable shift report (Z for a closed shift, X otherwise) —
/// same mechanics as the receipt: painted off screen, sent as an image.
class ShiftReportSheet extends StatelessWidget {
  final ShiftView shift;
  final AppLocalizations l10n;
  final Locale locale;
  final MoneyFormat money;
  final String brandName;

  const ShiftReportSheet({super.key, required this.shift, required this.l10n, required this.locale, required this.money, required this.brandName});

  @override
  Widget build(BuildContext context) {
    final closed = shift.isClosed;
    final overShort = shift.overShort ?? 0;
    String at(DateTime? value) => value == null ? '' : sheetDate(value, locale);
    String verdict() => overShort == 0
        ? l10n.drawerBalanced
        : '${overShort > 0 ? l10n.drawerOver : l10n.drawerShort} ${money(overShort.abs())}';

    return Paper(
      locale: locale,
      children: [
        SheetCentered(children: [
          Text(brandName, style: const TextStyle(fontSize: 40, fontWeight: FontWeight.w700)),
          Text(closed ? l10n.zReportTitle : l10n.xReportTitle, style: const TextStyle(fontSize: 28, fontWeight: FontWeight.w600)),
          Text(l10n.shiftNumber(shift.id), style: const TextStyle(fontSize: 24)),
        ]),
        const SizedBox(height: 12),
        SheetRow(l10n.openedAt, at(shift.openedAt), size: 22),
        if (shift.openedBy != null && shift.openedBy!.isNotEmpty) SheetRow(l10n.openedBy, shift.openedBy!, size: 22),
        if (closed) SheetRow(l10n.closedAt, at(shift.closedAt), size: 22),
        if (closed && shift.closedBy != null && shift.closedBy!.isNotEmpty) SheetRow(l10n.closedBy, shift.closedBy!, size: 22),
        const SizedBox(height: 8),
        const Dashes(),
        const SizedBox(height: 8),
        SheetRow(l10n.openingFloat, money(shift.openingFloat)),
        SheetRow(l10n.ticketsSettled, '${shift.ticketsSettled}'),
        SheetRow(l10n.salesTotal, money(shift.salesTotal), weight: FontWeight.w700),
        SheetRow(l10n.discount, money(shift.discounts)),
        SheetRow(l10n.changeGiven, money(shift.changeGiven)),
        SheetRow(l10n.payInsTotal, money(shift.payInsTotal)),
        SheetRow(l10n.payOutsTotal, money(shift.payOutsTotal)),
        if (shift.tenderTotals.isNotEmpty) ...[
          const SizedBox(height: 8),
          const Dashes(),
          const SizedBox(height: 8),
          Text(l10n.tenderSplit, style: const TextStyle(fontWeight: FontWeight.w600)),
          for (final total in shift.tenderTotals)
            SheetRow('${tenderLabel(l10n, total.tender)} × ${total.count}', money(total.amount)),
        ],
        if (shift.tabPaymentTenderTotals.isNotEmpty) ...[
          const SizedBox(height: 8),
          const Dashes(),
          const SizedBox(height: 8),
          Text(l10n.tabPayments, style: const TextStyle(fontWeight: FontWeight.w600)),
          for (final total in shift.tabPaymentTenderTotals)
            SheetRow('${tenderLabel(l10n, total.tender)} × ${total.count}', money(total.amount)),
        ],
        if (shift.movements.isNotEmpty) ...[
          const SizedBox(height: 8),
          const Dashes(),
          const SizedBox(height: 8),
          Text(l10n.drawerMovements, style: const TextStyle(fontWeight: FontWeight.w600)),
          for (final movement in shift.movements) ...[
            SheetRow(movement.reason, '${movement.isOut ? '−' : '+'}${money(movement.amount)}'),
            Text('${movement.recordedBy} · ${at(movement.recordedAt)}', style: const TextStyle(fontSize: 20)),
          ],
        ],
        const SizedBox(height: 8),
        const Dashes(),
        const SizedBox(height: 8),
        if (closed) ...[
          SheetRow(l10n.expected, money(shift.expected), size: 26, weight: FontWeight.w700),
          SheetRow(l10n.counted, money(shift.closingCount ?? 0), size: 26, weight: FontWeight.w700),
          SheetRow(l10n.overShort, verdict(), size: 30, weight: FontWeight.w700),
        ] else
          SheetRow(l10n.expectedInDrawer, money(shift.expectedInDrawer), size: 30, weight: FontWeight.w700),
      ],
    );
  }
}
