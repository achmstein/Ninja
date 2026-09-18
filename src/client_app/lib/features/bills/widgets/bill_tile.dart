import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/providers/locale_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../../orders/models/order.dart';
import '../../places/models/place.dart';
import '../../places/services/place_service.dart';
import '../models/bill.dart';
import '../models/bill_math.dart';
import '../services/bills_service.dart';
import 'bill_slip.dart';
import 'bill_stars.dart';

/// The till's bill, laid out like a slip: the customer's own view of it.
/// Their rounds, the rounds the till named nobody for, and the place's
/// time as the group's. A bill with nobody else on it adds up to its
/// total, with the till's discount, service and VAT under the lines; one
/// with somebody else's rounds ends on the customer's own, with the whole
/// bill's total under it — whose the time is, the till decides at settle.
/// The tap opens the bill, which itemises everything with the names on it.
class BillTile extends ConsumerWidget {
  final Bill bill;

  /// Today's orders by number, for the stars on a paid bill; the history
  /// tab has none
  final Map<int, Order>? ordersById;

  const BillTile({super.key, required this.bill, this.ordersById});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final colors = context.theme.colors;
    final locale = ref.watch(localeProvider);
    final now = ref.watch(minuteClockProvider).value ?? DateTime.now();
    String money(double v) => l10n.priceFormat(v.toStringAsFixed(2));

    final mine = bill.lines.where((line) => line.isMine && !line.isTime);
    final unassigned = bill.lines.where((line) => line.isUnassigned);
    final time = bill.lines.where((line) => line.isTime);
    final stays = ref.watch(myStaysProvider).value ?? const <Stay>[];
    // The stay this bill charges the time of, for its roster
    final stay = bill.sessionId == null ? null : stays.where((s) => s.id == bill.sessionId).firstOrNull;
    final running = runningTime(bill, activeStayOf(ref), now);
    final parts = billParts(bill, running, stay);
    final place = bill.locationName?.localized(context);
    final opened = DateFormat('h:mm a', locale.languageCode).format(bill.openedAt.toLocal());

    final rowStyle = TextStyle(fontSize: 13, color: colors.mutedForeground);
    final totalStyle = TextStyle(fontSize: 15, fontWeight: FontWeight.bold, color: colors.foreground);
    Widget row(String label, String value, {required TextStyle style, EdgeInsets padding = EdgeInsets.zero}) =>
        Padding(
          padding: padding,
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              Expanded(child: AppText(label, style: style)),
              const SizedBox(width: 8),
              AppText(value, style: style.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
            ],
          ),
        );
    final approx = running != null ? '≈ ' : '';

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => context.push('/receipts/${bill.id}'),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    _BillDot(bill: bill),
                    const SizedBox(width: 8),
                    AppText(opened,
                        style: TextStyle(fontWeight: FontWeight.w600, fontSize: 15, color: colors.foreground)),
                    const SizedBox(width: 6),
                    if (bill.placeId != null && bill.placeKind != null) ...[
                      Icon(bill.placeKind!.icon, size: 14, color: colors.mutedForeground),
                      const SizedBox(width: 4),
                    ],
                    Expanded(
                      child: AppText(
                        place == null || place.isEmpty ? l10n.atTheCounter : place,
                        style: TextStyle(fontSize: 13, color: colors.mutedForeground),
                        overflow: TextOverflow.ellipsis,
                      ),
                    ),
                    const SizedBox(width: 8),
                    _BillPill(bill: bill),
                  ],
                ),
                const SizedBox(height: 6),
                Padding(
                  padding: const EdgeInsetsDirectional.only(start: 18),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (final line in mine) _BillLine(line: line),
                      for (final line in unassigned) _BillLine(line: line),
                      for (final line in time) _BillLine(line: line),
                      if (running != null) RunningTimeLine(bill: bill, running: running),
                      if (parts.shared) ...[
                        row(l10n.yourRounds, money(parts.ownLines),
                            style: totalStyle, padding: const EdgeInsets.only(top: 4)),
                        row(l10n.billTotal, '$approx${money(parts.total)}', style: rowStyle),
                      ] else ...[
                        if (bill.discount > 0)
                          row(
                            '${l10n.discount}${bill.discountRate != null ? ' ${percent(bill.discountRate)}%' : ''}',
                            '−${money(bill.discount)}',
                            style: rowStyle,
                          ),
                        if (bill.serviceCharge > 0)
                          row(l10n.serviceCharge(percent(bill.serviceChargeRate).toString()),
                              money(bill.serviceCharge),
                              style: rowStyle),
                        if (bill.vat > 0 && !bill.vatIncluded)
                          row(l10n.vat(percent(bill.vatRate).toString()), money(bill.vat), style: rowStyle),
                        row(l10n.total, '$approx${money(parts.total)}',
                            style: totalStyle, padding: const EdgeInsets.only(top: 4)),
                      ],
                      if (bill.refundedTotal > 0)
                        row(l10n.refunded, '−${money(bill.refundedTotal)}',
                            style: TextStyle(fontSize: 13, color: colors.destructive)),
                    ],
                  ),
                ),
              ],
            ),
          ),
          // A paid bill is the thanks: the stars for the rounds on it, at the
          // one moment the customer is already looking
          if (bill.isSettled && ordersById != null)
            Padding(
              padding: const EdgeInsetsDirectional.only(start: 18),
              child: BillStars(bill: bill, ordersById: ordersById!),
            ),
        ],
      ),
    );
  }
}

/// Open is money outstanding, paid is done, voided is thrown out
class _BillDot extends StatelessWidget {
  final Bill bill;

  const _BillDot({required this.bill});

  @override
  Widget build(BuildContext context) {
    final color = bill.isSettled
        ? AppTheme.successColor
        : bill.isVoided
            ? context.theme.colors.destructive
            : Colors.orange;
    return Container(width: 10, height: 10, decoration: BoxDecoration(color: color, shape: BoxShape.circle));
  }
}

/// What the till did with the bill: paid (and on which receipt), on the
/// customer's tab, voided — or still unpaid
class _BillPill extends StatelessWidget {
  final Bill bill;

  const _BillPill({required this.bill});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    if (bill.isVoided) return FBadge(variant: FBadgeVariant.outline, child: Text(l10n.voided));
    if (!bill.isSettled) return FBadge(variant: FBadgeVariant.outline, child: Text(l10n.unpaid));
    final label = bill.paidWith == 'Account' ? l10n.onYourTab : l10n.paid;
    final receipt = bill.receiptNumber != null ? ' ${l10n.receiptShort(bill.receiptNumber!)}' : '';
    return FBadge(variant: FBadgeVariant.secondary, child: Text('$label$receipt'));
  }
}

/// One of the customer's own lines, or the place's time, whole. A round the
/// till named nobody for is muted: on the bill, but not read as theirs.
class _BillLine extends StatelessWidget {
  final BillLine line;

  const _BillLine({required this.line});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final colors = context.theme.colors;
    String money(double v) => l10n.priceFormat(v.toStringAsFixed(2));
    final details = line.details?.localized(context);
    final ink = line.isUnassigned ? colors.mutedForeground : colors.foreground;

    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              if (line.isTime)
                Icon(FIcons.timer, size: 14, color: colors.mutedForeground)
              else
                AppText('${hoursOf(line.qty)}x', style: TextStyle(fontSize: 14, color: colors.mutedForeground)),
              const SizedBox(width: 4),
              Expanded(
                child: AppText(line.description.localized(context), style: TextStyle(fontSize: 14, color: ink)),
              ),
              const SizedBox(width: 8),
              AppText(
                money(line.total),
                style: TextStyle(fontSize: 14, color: ink, fontFeatures: const [FontFeature.tabularFigures()]),
              ),
            ],
          ),
          if (line.isTime)
            Padding(
              padding: const EdgeInsetsDirectional.only(start: 24),
              child: AppText(
                '${l10n.hoursShort(line.qty)} × ${money(line.unitPrice)}${l10n.perHourShort}',
                style: TextStyle(
                    fontSize: 12, color: colors.mutedForeground, fontFeatures: const [FontFeature.tabularFigures()]),
              ),
            )
          else if (details != null && details.isNotEmpty)
            Padding(
              padding: const EdgeInsetsDirectional.only(start: 24),
              child: AppText(details, style: TextStyle(fontSize: 12, color: colors.mutedForeground)),
            ),
        ],
      ),
    );
  }
}
