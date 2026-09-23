import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:intl/intl.dart' show DateFormat;
import '../../../core/brand/brand_mark.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../../../core/utils/money.dart';
import '../../places/models/place.dart';
import '../../places/services/place_service.dart';
import '../models/bill.dart';
import '../models/bill_math.dart';
import '../services/bills_service.dart';

/// The customer's running stay, if any: a clock is ticking somewhere for them
Stay? activeStayOf(WidgetRef ref) =>
    (ref.watch(myStaysProvider).value ?? const []).where((s) => s.status == StayStatus.active).firstOrNull;

String tenderLabel(String tender, AppLocalizations l10n) => switch (tender) {
      'Cash' => l10n.cash,
      'Card' => l10n.card,
      'InstaPay' => l10n.instapay,
      'Account' => l10n.onYourTab,
      'Mixed' => l10n.paidSeveralWays,
      _ => tender,
    };

/// Whole hours print as "2", a quarter as "1.25"
String hoursOf(double hours) => hours % 1 == 0 ? hours.toInt().toString() : hours.toString();

/// The top of the paper, about half its width, as the till prints it: the
/// wordmark, else the logo, else the name in bold. Paper is white, so the
/// light versions whatever the screen.
class ReceiptBrand extends ConsumerWidget {
  const ReceiptBrand({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final brand = ref.watch(brandProvider);
    return BrandWordmark(
      height: 48,
      maxWidth: 136,
      brightness: Brightness.light,
      fallback: switch (brand.logoUrl) {
        final logoUrl? => Image.network(logoUrl, width: 136),
        null => AppText(brand.displayName(Localizations.localeOf(context)),
            style: const TextStyle(fontSize: 20, color: Colors.black, height: 1.3, fontWeight: FontWeight.w700)),
      },
    );
  }
}

/// The bill as the slip the till would print: every line on the ticket
/// with the name the till put on it, the place's time, the discount,
/// service and VAT, the total, and how it was paid. Black on white
/// whatever the theme, 72mm wide. The customer is on this bill, so nobody
/// on it is hidden from them.
class BillSlip extends ConsumerWidget {
  final Bill bill;

  const BillSlip({super.key, required this.bill});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final locale = Localizations.localeOf(context).languageCode;
    final now = ref.watch(minuteClockProvider).value ?? DateTime.now();
    final running = runningTime(bill, activeStayOf(ref), now);
    final money = ref.watch(moneyProvider);
    const ink = Colors.black;
    const base = TextStyle(fontSize: 12, color: ink, height: 1.3);
    const muted = TextStyle(fontSize: 11, color: ink, height: 1.3);
    const tabular = [FontFeature.tabularFigures()];
    final total = bill.total + (running?.charged ?? 0);
    final hasBreakdown = bill.discount > 0 || bill.serviceCharge > 0 || bill.vat > 0;
    final place = bill.locationName?.localized(context);
    final closed = bill.closedAt?.toLocal();

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
      child: DashedLine(ink),
    );

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
                const ReceiptBrand(),
                const SizedBox(height: 8),
                AppText(
                  bill.receiptNumber != null
                      ? l10n.receiptNumber(bill.receiptNumber!)
                      : (place == null || place.isEmpty ? l10n.atTheCounter : place),
                  style: base.copyWith(fontSize: 13, fontWeight: FontWeight.w600),
                ),
                if (bill.receiptNumber != null && place != null && place.isNotEmpty) AppText(place, style: muted),
                AppText(
                  DateFormat.yMd(locale).add_jm().format(bill.openedAt.toLocal()) +
                      (closed != null ? ' – ${DateFormat.jm(locale).format(closed)}' : ''),
                  style: muted.copyWith(fontFeatures: tabular),
                  textAlign: TextAlign.center,
                ),
                if (bill.isVoided) AppText(l10n.voided, style: muted.copyWith(fontWeight: FontWeight.w600)),
              ],
            ),
            rule,
            for (final line in bill.lines) ...[
              row(line.description.localized(context), money(line.total)),
              AppText(
                '${line.isTime ? l10n.hoursShort(line.qty) : hoursOf(line.qty)} × ${money(line.unitPrice)}'
                '${line.isTime ? l10n.perHourShort : ''}'
                '${line.discount > 0 ? ' − ${money(line.discount)} (${l10n.discount})' : ''}'
                '${line.customerName != null ? ' · ${line.customerName}' : ''}',
                style: muted.copyWith(fontSize: 10, fontFeatures: tabular),
              ),
              if (line.details != null) AppText(line.details!.localized(context), style: muted.copyWith(fontSize: 10)),
              const SizedBox(height: 6),
            ],
            if (running != null) RunningTimeLine(bill: bill, running: running, slip: true),
            rule,
            if (hasBreakdown) ...[
              row(l10n.subtotal, money(bill.subtotal), style: muted),
              if (bill.discount > 0)
                row(
                  '${l10n.discount}${bill.discountRate != null ? ' ${percent(bill.discountRate)}%' : ''}',
                  '−${money(bill.discount)}',
                  style: muted,
                ),
              if (bill.serviceCharge > 0)
                row(l10n.serviceCharge(percent(bill.serviceChargeRate).toString()), money(bill.serviceCharge),
                    style: muted),
              if (bill.vat > 0 && !bill.vatIncluded)
                row(l10n.vat(percent(bill.vatRate).toString()), money(bill.vat), style: muted),
              const SizedBox(height: 4),
            ],
            row(l10n.total, '${running != null ? '≈ ' : ''}${money(total)}',
                style: base.copyWith(fontSize: 15, fontWeight: FontWeight.w700)),
            if (bill.vat > 0 && bill.vatIncluded)
              row(l10n.vatIncluded(percent(bill.vatRate).toString()), money(bill.vat), style: muted.copyWith(fontSize: 10)),
            if (bill.isSettled && bill.paidWith != null) ...[
              const SizedBox(height: 8),
              row(tenderLabel(bill.paidWith!, l10n), money(bill.total)),
            ],
            if (bill.refundedTotal > 0)
              row(l10n.refunded, '−${money(bill.refundedTotal)}', style: base.copyWith(fontWeight: FontWeight.w600)),
          ],
        ),
      ),
    );
  }
}

/// The clock still running: its time so far, as the till will bill it
class RunningTimeLine extends ConsumerWidget {
  final Bill bill;
  final RunningTime running;

  /// On the slip: no icon, the smaller ink-on-paper type
  final bool slip;

  const RunningTimeLine({super.key, required this.bill, required this.running, this.slip = false});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final colors = context.theme.colors;
    final money = ref.watch(moneyProvider);
    final place = bill.locationName?.localized(context) ?? '';
    final hours = running.minutes ~/ 60;
    final minutes = (running.minutes % 60).floor();
    final elapsed = '$hours:${minutes.toString().padLeft(2, '0')}';
    final perOption = running.parts.length > 1;
    final lineStyle = slip
        ? const TextStyle(fontSize: 12, color: Colors.black, height: 1.3)
        : TextStyle(fontSize: 14, color: colors.foreground);
    final subStyle = slip
        ? const TextStyle(fontSize: 10, color: Colors.black, height: 1.3, fontFeatures: [FontFeature.tabularFigures()])
        : TextStyle(fontSize: 12, color: colors.mutedForeground, fontFeatures: const [FontFeature.tabularFigures()]);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        for (var i = 0; i < running.parts.length; i++) ...[
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              if (!slip) ...[
                Icon(FIcons.timer, size: 14, color: colors.mutedForeground),
                const SizedBox(width: 4),
              ],
              Expanded(
                child: AppText(
                  l10n.timeSoFar(place) +
                      (perOption ? ' — ${running.parts[i].optionName.localized(context)}' : ''),
                  style: lineStyle,
                ),
              ),
              const SizedBox(width: 8),
              AppText('≈ ${money(running.parts[i].cost)}',
                  style: lineStyle.copyWith(fontFeatures: const [FontFeature.tabularFigures()])),
            ],
          ),
          Padding(
            padding: EdgeInsetsDirectional.only(start: slip ? 0 : 24),
            child: AppText(
              '${i == 0 ? '$elapsed · ' : ''}'
              '${l10n.hoursShort(running.parts[i].hours)} × ${money(running.parts[i].rate)}${l10n.perHourShort}',
              style: subStyle,
            ),
          ),
        ],
      ],
    );
  }
}

/// The dashed rule a thermal receipt draws between its parts
class DashedLine extends StatelessWidget {
  final Color color;

  const DashedLine(this.color, {super.key});

  @override
  Widget build(BuildContext context) =>
      CustomPaint(size: const Size(double.infinity, 1), painter: _DashedLinePainter(color));
}

class _DashedLinePainter extends CustomPainter {
  final Color color;

  const _DashedLinePainter(this.color);

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
  bool shouldRepaint(_DashedLinePainter oldDelegate) => oldDelegate.color != color;
}
