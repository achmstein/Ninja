import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:forui/forui.dart';
import '../../../core/models/dates.dart';
import '../../../core/models/money.dart';
import '../../../core/theme/app_theme.dart';
import '../../../l10n/app_localizations.dart';
import '../../tickets/models/online_payment.dart';
import '../../tickets/models/ticket_detail.dart';

/// Online payments on the till: what guests paid (or are paying) for this bill
/// from their phones. Each payment with its payer, its share of the bill and
/// the tip on top, apart; a paid one can be given back while the bill is
/// open. Under them, while open, what is paid online and what is left for
/// the till to take.
class OnlinePaymentsCard extends StatelessWidget {
  final TicketDetail ticket;
  final List<OnlinePaymentView> payments;

  /// Gives a paid payment back; null hides the action
  final ValueChanged<OnlinePaymentView>? onRefund;

  /// Lets a payment still in checkout go, so its share is free to pay
  /// again; null hides the action
  final ValueChanged<OnlinePaymentView>? onRelease;

  const OnlinePaymentsCard({super.key, required this.ticket, required this.payments, this.onRefund, this.onRelease});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    const tabular = [FontFeature.tabularFigures()];
    final brightness = theme.colors.brightness;
    final paid = payments.paidOnline;
    final remaining = math.max(0.0, ((ticket.total - paid) * 100).roundToDouble() / 100);

    Widget totalRow(String label, String value, {Color? color}) => Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
          child: Row(
            children: [
              Expanded(child: Text(label, style: theme.typography.base.copyWith(color: theme.colors.mutedForeground))),
              Text(value,
                  style: theme.typography.base.copyWith(fontWeight: FontWeight.w700, color: color, fontFeatures: tabular)),
            ],
          ),
        );

    final children = <Widget>[
      Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          children: [
            Icon(FIcons.smartphone, size: 16, color: theme.colors.mutedForeground),
            const SizedBox(width: 8),
            Text(l10n.onlinePayments, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
          ],
        ),
      ),
      for (final payment in payments)
        _OnlinePaymentRow(
          payment: payment,
          onRefund: ticket.isOpen && payment.isPaid && onRefund != null ? () => onRefund!(payment) : null,
          onRelease: payment.isPending && onRelease != null ? () => onRelease!(payment) : null,
        ),
      if (ticket.isOpen) ...[
        totalRow(l10n.paidOnline, money(context, paid), color: AppColors.emerald(brightness)),
        totalRow(l10n.remaining, money(context, remaining),
            color: remaining > 0 ? theme.colors.destructive : AppColors.emerald(brightness)),
      ],
      if (ticket.isOpen && payments.anyPending)
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          color: AppColors.amber500.withValues(alpha: 0.1),
          child: Row(
            children: [
              Icon(FIcons.clock, size: 16, color: AppColors.amber(brightness)),
              const SizedBox(width: 8),
              Expanded(child: Text(l10n.guestPayingOnline, style: theme.typography.sm)),
            ],
          ),
        ),
    ];

    return Container(
      decoration: BoxDecoration(border: Border.all(color: theme.colors.border), borderRadius: BorderRadius.circular(10)),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var i = 0; i < children.length; i++) ...[
            if (i > 0) Container(height: 1, color: theme.colors.border),
            children[i],
          ],
        ],
      ),
    );
  }
}

class _OnlinePaymentRow extends StatelessWidget {
  final OnlinePaymentView payment;
  final VoidCallback? onRefund;
  final VoidCallback? onRelease;

  const _OnlinePaymentRow({required this.payment, this.onRefund, this.onRelease});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    const tabular = [FontFeature.tabularFigures()];
    final name = (payment.payerName ?? '').trim().isNotEmpty ? payment.payerName!.trim() : l10n.guest;
    final at = payment.refundedAt ?? payment.paidAt ?? payment.createdAt;
    final meta = [
      if (payment.tip > 0) l10n.onlineTip(money(context, payment.tip)),
      if (payment.fee > 0) l10n.onlineFee(money(context, payment.fee)),
      if (at != null) formatDateTime(context, at),
    ].join(' · ');

    final (label, variant) = payment.isPending
        ? (l10n.onlinePaying, FBadgeVariant.outline)
        : payment.isRefunded
            ? (l10n.onlineRefunded, FBadgeVariant.destructive)
            : (l10n.onlinePaid, FBadgeVariant.secondary);

    return Padding(
      padding: const EdgeInsetsDirectional.fromSTEB(12, 8, 8, 8),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Flexible(
                      child: Text(name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: theme.typography.base.copyWith(fontWeight: FontWeight.w500)),
                    ),
                    const SizedBox(width: 8),
                    FBadge(variant: variant, child: Text(label)),
                  ],
                ),
                if (meta.isNotEmpty)
                  Text(meta,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground, fontFeatures: tabular)),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Text(
            money(context, payment.amount),
            style: theme.typography.lg.copyWith(
              fontWeight: FontWeight.w600,
              fontFeatures: tabular,
              decoration: payment.isRefunded ? TextDecoration.lineThrough : null,
              color: payment.isRefunded || payment.isPending ? theme.colors.mutedForeground : null,
            ),
          ),
          if (onRelease != null) ...[
            const SizedBox(width: 8),
            SizedBox(
              height: 40,
              child: FButton(
                key: ValueKey('release-${payment.key}'),
                variant: FButtonVariant.outline,
                mainAxisSize: MainAxisSize.min,
                onPress: onRelease,
                prefix: const Icon(FIcons.lockOpen, size: 16),
                child: Text(l10n.releaseOnline, style: theme.typography.sm),
              ),
            ),
          ],
          if (onRefund != null) ...[
            const SizedBox(width: 4),
            SizedBox(
              height: 40,
              child: FButton(
                key: ValueKey('refund-${payment.key}'),
                variant: FButtonVariant.ghost,
                mainAxisSize: MainAxisSize.min,
                onPress: onRefund,
                prefix: Icon(FIcons.undo2, size: 16, color: theme.colors.destructive),
                child: Text(l10n.refundOnline, style: theme.typography.sm.copyWith(color: theme.colors.destructive)),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
