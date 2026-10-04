import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/models/money.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/heading.dart';
import '../../../l10n/app_localizations.dart';
import '../models/delivery_order.dart';
import '../providers/deliveries_provider.dart';
import '../widgets/delivery_card.dart';

/// The rider's day on one screen: what is still to deliver, oldest first,
/// each with its one next step; then what was delivered today, and the cash
/// in their pocket until the till takes it.
class DeliveriesScreen extends ConsumerWidget {
  const DeliveriesScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    // Delivery is an add-on: a business that has not bought it (or switched
    // it off) has nothing for a rider, and its deliveries are not asked for
    if (!ref.watch(featuresProvider.select((f) => f.delivery))) {
      return _Message(icon: FIcons.bike, title: l10n.notDelivering, body: l10n.notDeliveringHint);
    }
    final day = ref.watch(deliveriesProvider);
    final onDuty = ref.watch(dutyProvider);
    final currency = ref.watch(brandProvider.select((b) => b.currency));
    final locale = Localizations.localeOf(context);
    String money(double amount) => formatMoney(amount, currency, locale);

    return RefreshIndicator(
      onRefresh: () => ref.read(deliveriesProvider.notifier).refresh(),
      child: day.when(
        loading: () => const Center(child: FCircularProgress()),
        error: (_, _) => _Message(
          icon: FIcons.wifiOff,
          title: l10n.somethingWentWrong,
          action: FButton(
            variant: FButtonVariant.outline,
            onPress: () => ref.read(deliveriesProvider.notifier).refresh(),
            child: Text(l10n.retry, style: theme.typography.base.forButton),
          ),
        ),
        data: (day) {
          final cash = day.cashInHand;
          return ListView(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 32),
            physics: const AlwaysScrollableScrollPhysics(),
            children: [
              if (!onDuty) _OffDutyNote(text: l10n.offDutyNote),
              if (cash > 0) _CashInHand(amount: money(cash)),
              if (day.toGo.isEmpty && day.delivered.isEmpty)
                _Message(icon: FIcons.bike, title: l10n.noDeliveries, body: l10n.noDeliveriesHint)
              else ...[
                if (day.toGo.isNotEmpty) ...[
                  Heading(l10n.toGo),
                  const SizedBox(height: 8),
                  for (final order in day.toGo) ...[
                    DeliveryCard(order: order, money: money),
                    const SizedBox(height: 12),
                  ],
                ],
                if (day.delivered.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Heading(l10n.deliveredToday),
                  const SizedBox(height: 8),
                  for (final order in day.delivered) _DeliveredRow(order: order, money: money),
                ],
              ],
            ],
          );
        },
      ),
    );
  }
}

class _OffDutyNote extends StatelessWidget {
  final String text;

  const _OffDutyNote({required this.text});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        padding: const EdgeInsets.all(12),
        decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(12)),
        child: Row(
          children: [
            Icon(FIcons.moon, size: 18, color: theme.colors.mutedForeground),
            const SizedBox(width: 8),
            Expanded(child: Text(text, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground))),
          ],
        ),
      ),
    );
  }
}

/// The cash collected at doors and not yet taken in by the till
class _CashInHand extends StatelessWidget {
  final String amount;

  const _CashInHand({required this.amount});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final green = AppColors.emerald(theme.colors.brightness);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: green.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: green.withValues(alpha: 0.4)),
        ),
        child: Row(
          children: [
            Icon(FIcons.banknote, size: 24, color: green),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(l10n.cashInHand(amount), style: theme.typography.lg.copyWith(fontWeight: FontWeight.w700)),
                  Text(l10n.cashInHandHint, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// A delivery done: whom, when, how much, and whether its cash is still out
class _DeliveredRow extends StatelessWidget {
  final DeliveryOrder order;
  final String Function(double) money;

  const _DeliveredRow({required this.order, required this.money});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final time = order.deliveredAt == null
        ? ''
        : MaterialLocalizations.of(context).formatTimeOfDay(TimeOfDay.fromDateTime(order.deliveredAt!.toLocal()));
    final muted = theme.colors.mutedForeground;
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 4),
      decoration: BoxDecoration(border: Border(bottom: BorderSide(color: theme.colors.border))),
      child: Row(
        children: [
          Icon(FIcons.circleCheck, size: 20, color: AppColors.emerald(theme.colors.brightness)),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('${order.customerName ?? l10n.guest} · ${l10n.orderNumber(order.orderNumber)}',
                    style: theme.typography.base.copyWith(fontWeight: FontWeight.w600), maxLines: 1, overflow: TextOverflow.ellipsis),
                Text('$time · ${order.cashInHand ? l10n.cashWithYou : l10n.handedIn}', style: theme.typography.sm.copyWith(color: muted)),
              ],
            ),
          ),
          Text(money(order.total), style: theme.typography.base.copyWith(fontWeight: FontWeight.w600)),
        ],
      ),
    );
  }
}

class _Message extends StatelessWidget {
  final IconData icon;
  final String title;
  final String? body;
  final Widget? action;

  const _Message({required this.icon, required this.title, this.body, this.action});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final muted = theme.colors.mutedForeground;
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 64, horizontal: 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 48, color: muted),
          const SizedBox(height: 16),
          Text(title, style: theme.typography.lg.copyWith(fontWeight: FontWeight.w600), textAlign: TextAlign.center),
          if (body != null) ...[
            const SizedBox(height: 6),
            Text(body!, style: theme.typography.sm.copyWith(color: muted), textAlign: TextAlign.center),
          ],
          if (action != null) ...[const SizedBox(height: 16), action!],
        ],
      ),
    );
  }
}
