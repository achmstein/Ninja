import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import '../../../core/models/dates.dart';
import '../../../core/models/money.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import '../../../l10n/app_localizations.dart';
import '../../ticket/tenders.dart';
import '../models/shift.dart';

const _tabular = [FontFeature.tabularFigures()];

/// The over/short line: balanced, or over/short by how much
String overShortText(AppLocalizations l10n, BuildContext context, double value) => value == 0
    ? l10n.drawerBalanced
    : '${value > 0 ? l10n.drawerOver : l10n.drawerShort} ${money(context, value.abs())}';

/// What one part of the drawer sum is called, on screen and on paper
String drawerPartLabel(AppLocalizations l10n, DrawerPart part) => switch (part) {
      DrawerPart.openingFloat => l10n.openingFloat,
      DrawerPart.cashTaken => l10n.cashTakenNet,
      DrawerPart.cashTabPayments => l10n.cashTabPayments,
      DrawerPart.payIns => l10n.payInsTotal,
      DrawerPart.payOuts => l10n.payOutsTotal,
      DrawerPart.cashRefunds => l10n.cashRefunds,
    };

/// A signed drawer amount: "+" for what went in, "−" for what came out
String signedMoney(String Function(double) money, double value) =>
    '${value < 0 ? '−' : '+'}${money(value.abs())}';

/// Over/short verdict pill: green when the drawer is over or balanced, red
/// when short. Shared by the report and the Z-history rows.
class OverShortPill extends StatelessWidget {
  final double value;

  const OverShortPill({super.key, required this.value});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final good = value >= 0;
    final color = good ? AppColors.emerald(theme.colors.brightness) : theme.colors.destructive;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: (good ? AppColors.emerald500 : theme.colors.destructive).withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        overShortText(l10n, context, value),
        style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500, color: color, fontFeatures: _tabular),
      ),
    );
  }
}

/// The shift figures, shared by the live X view, the Z result shown right
/// after closing, and the Z-history detail. An open shift leads with the
/// live expected-in-drawer amount; a closed one leads with the
/// expected-vs-counted verdict.
class ShiftReport extends StatelessWidget {
  final ShiftView shift;

  const ShiftReport({super.key, required this.shift});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final muted = theme.typography.sm.copyWith(color: theme.colors.mutedForeground);
    final emerald = AppColors.emerald(theme.colors.brightness);
    final overShort = shift.overShort ?? 0;

    Widget stat(String label, String value) => Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: theme.colors.background,
            border: Border.all(color: theme.colors.border),
            borderRadius: BorderRadius.circular(14),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: muted),
              Text(value, style: theme.typography.lg.copyWith(fontWeight: FontWeight.w600, fontFeatures: _tabular)),
            ],
          ),
        );

    Widget meta(String label, DateTime? at, String? by) => Padding(
          padding: const EdgeInsets.symmetric(vertical: 4),
          child: Row(
            children: [
              Text(label, style: muted),
              const Spacer(),
              Text.rich(
                TextSpan(
                  text: at == null ? '' : formatDateTime(context, at),
                  style: theme.typography.sm.copyWith(fontFeatures: _tabular),
                  children: [if (by != null && by.isNotEmpty) TextSpan(text: ' · $by', style: muted)],
                ),
              ),
            ],
          ),
        );

    Widget headline(String label, String value, {TextStyle? style}) => Column(
          children: [
            Text(label, style: muted),
            Text(value,
                textAlign: TextAlign.center,
                style: style ?? theme.typography.xl.copyWith(fontWeight: FontWeight.w700, fontFeatures: _tabular)),
          ],
        );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        // The headline: what should be in the drawer (X), or how the count
        // actually landed (Z)
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(color: theme.colors.secondary, borderRadius: BorderRadius.circular(14)),
          child: shift.isClosed
              ? Row(
                  children: [
                    Expanded(child: headline(l10n.expected, money(context, shift.expected))),
                    Expanded(child: headline(l10n.counted, money(context, shift.closingCount ?? 0))),
                    Expanded(
                      child: headline(
                        l10n.overShort,
                        overShortText(l10n, context, overShort),
                        style: theme.typography.xl.copyWith(
                          fontWeight: FontWeight.w700,
                          fontFeatures: _tabular,
                          color: overShort >= 0 ? emerald : theme.colors.destructive,
                        ),
                      ),
                    ),
                  ],
                )
              : headline(
                  l10n.expectedInDrawer,
                  money(context, shift.expectedInDrawer),
                  style: theme.typography.xl4.copyWith(fontWeight: FontWeight.w700, fontFeatures: _tabular),
                ),
        ),
        const SizedBox(height: 16),
        meta(l10n.openedAt, shift.openedAt, shift.openedBy),
        if (shift.isClosed) meta(l10n.closedAt, shift.closedAt, shift.closedBy),
        const SizedBox(height: 16),
        // Three tiles a row, each as tall as its two lines need
        for (final row in [
          [
            stat(l10n.ticketsSettled, '${shift.ticketsSettled}'),
            stat(l10n.grossSales, money(context, shift.grossSales)),
            stat(l10n.discount, money(context, shift.discounts)),
          ],
          [
            stat(l10n.refundsAllTenders, money(context, shift.refundsTotal)),
            stat(l10n.netSales, money(context, shift.netSales)),
            stat(l10n.changeGiven, money(context, shift.changeGiven)),
          ],
        ]) ...[
          Row(
            children: [
              for (final (index, tile) in row.indexed) ...[
                if (index > 0) const SizedBox(width: 8),
                Expanded(child: tile),
              ],
            ],
          ),
          const SizedBox(height: 8),
        ],
        if (shift.tenderTotals.isNotEmpty) ...[
          const SizedBox(height: 8),
          Text(l10n.billTenders, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          _Bordered(
            children: [
              for (final total in shift.tenderTotals)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text.rich(TextSpan(
                          text: tenderLabel(l10n, total.tender),
                          style: theme.typography.base,
                          children: [TextSpan(text: ' × ${total.count}', style: muted.copyWith(fontFeatures: _tabular))],
                        )),
                      ),
                      Text(money(context, total.amount),
                          style: theme.typography.base.copyWith(fontWeight: FontWeight.w600, fontFeatures: _tabular)),
                    ],
                  ),
                ),
            ],
          ),
        ],
        if (shift.tabPaymentTenderTotals.isNotEmpty) ...[
          const SizedBox(height: 16),
          Text(l10n.tabPayments, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          _Bordered(
            children: [
              for (final total in shift.tabPaymentTenderTotals)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Text.rich(TextSpan(
                          text: tenderLabel(l10n, total.tender),
                          style: theme.typography.base,
                          children: [TextSpan(text: ' × ${total.count}', style: muted.copyWith(fontFeatures: _tabular))],
                        )),
                      ),
                      Text(money(context, total.amount),
                          style: theme.typography.base.copyWith(fontWeight: FontWeight.w600, fontFeatures: _tabular)),
                    ],
                  ),
                ),
            ],
          ),
        ],
        const SizedBox(height: 16),
        Text(l10n.drawerCashTitle, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        _DrawerSum(shift: shift),
        const SizedBox(height: 16),
        Text(l10n.drawerMovements, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w600)),
        const SizedBox(height: 4),
        if (shift.movements.isEmpty)
          Padding(padding: const EdgeInsets.symmetric(vertical: 8), child: Text(l10n.noMovements, style: muted))
        else
          _Bordered(
            children: [
              for (final movement in shift.movements)
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                  child: Row(
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(movement.reason, maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.typography.base),
                            Text(
                              [
                                movement.isOut ? l10n.payOut : l10n.payIn,
                                movement.recordedBy,
                                if (movement.recordedAt != null) formatDateTime(context, movement.recordedAt!),
                              ].join(' · '),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: muted.copyWith(fontFeatures: _tabular),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 16),
                      Text(
                        '${movement.isOut ? '−' : '+'}${money(context, movement.amount)}',
                        style: theme.typography.base.copyWith(
                          fontWeight: FontWeight.w600,
                          fontFeatures: _tabular,
                          color: movement.isOut ? theme.colors.destructive : emerald,
                        ),
                      ),
                    ],
                  ),
                ),
            ],
          ),
      ],
    );
  }
}

/// The drawer sum written out — float + cash taken (after change) + cash
/// tab payments + pay-ins − pay-outs − cash refunds = expected — so the
/// parts visibly reach the figure; on a closed shift with late cash, the
/// frozen expectation, the late cash and the over/short they make
class _DrawerSum extends StatelessWidget {
  final ShiftView shift;

  const _DrawerSum({required this.shift});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final emerald = AppColors.emerald(theme.colors.brightness);
    String format(double value) => money(context, value);

    Widget row(String label, String value, {bool bold = false, Color? color}) => Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: Row(
            children: [
              Expanded(
                child: Text(label,
                    style: bold ? theme.typography.base.copyWith(fontWeight: FontWeight.w700) : theme.typography.base),
              ),
              Text(value,
                  style: theme.typography.base.copyWith(
                    fontWeight: bold ? FontWeight.w700 : FontWeight.w600,
                    fontFeatures: _tabular,
                    color: color,
                  )),
            ],
          ),
        );

    final adjusted = shift.adjustedOverShort;
    return _Bordered(
      children: [
        for (final line in shift.drawer.lines)
          row(
            drawerPartLabel(l10n, line.part),
            line.part == DrawerPart.openingFloat ? format(line.amount) : signedMoney(format, line.amount),
            color: line.isOut ? theme.colors.destructive : null,
          ),
        row('= ${l10n.expectedInDrawer}', format(shift.expectedInDrawer), bold: true),
        if (shift.isClosed && shift.lateCash != 0) ...[
          row(l10n.expectedAtClose, format(shift.expected)),
          row(l10n.lateCash, signedMoney(format, shift.lateCash)),
          if (adjusted != null)
            row(l10n.adjustedOverShort, overShortText(l10n, context, adjusted),
                bold: true, color: adjusted >= 0 ? emerald : theme.colors.destructive),
        ],
      ],
    );
  }
}

/// Rows in a rounded border, a hairline between them
class _Bordered extends StatelessWidget {
  final List<Widget> children;
  const _Bordered({required this.children});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Container(
      decoration: BoxDecoration(border: Border.all(color: theme.colors.border), borderRadius: BorderRadius.circular(14)),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (final (index, child) in children.indexed) ...[
            if (index > 0) Container(height: 1, color: theme.colors.border),
            child,
          ],
        ],
      ),
    );
  }
}
