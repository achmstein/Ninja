import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/brand/brand_provider.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:ninja_app_core/theme/text_styles.dart';
import '../../../core/models/money.dart';
import '../../../core/network/api_errors.dart';
import '../../../l10n/app_localizations.dart';
import '../providers/deliveries_provider.dart';
import '../widgets/parts.dart';

/// The rider's day so far: the cash still with them (to hand in at the
/// till) or that it is all handed in, how many delivered and how much
/// handed in, then each delivery done, latest first.
class TodayScreen extends ConsumerWidget {
  const TodayScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final day = ref.watch(deliveriesProvider);
    final currency = ref.watch(brandProvider.select((b) => b.currency));
    final locale = Localizations.localeOf(context);
    String money(double amount) => formatMoney(amount, currency, locale);
    Future<void> refresh() => ref.read(deliveriesProvider.notifier).refresh();

    return RefreshIndicator(
      onRefresh: refresh,
      child: day.when(
        loading: () => const RiderList(children: [SizedBox(height: 120), Center(child: FCircularProgress())]),
        error: (e, _) => RiderList(children: [
          EmptyState(
            icon: FIcons.wifiOff,
            title: describeError(e, l10n),
            action: SizedBox(
              height: 48,
              child: FButton(
                variant: FButtonVariant.outline,
                mainAxisSize: MainAxisSize.min,
                onPress: refresh,
                prefix: const Icon(FIcons.refreshCw, size: 18),
                child: Text(l10n.retry, style: theme.typography.base.forButton),
              ),
            ),
          ),
        ]),
        data: (day) {
          final delivered = day.delivered.where((o) => o.isDelivered).toList();
          final handedIn = delivered.where((o) => !o.cashInHand).fold(0.0, (sum, o) => sum + (o.cashCollected ?? o.total));
          return RiderList(
            children: [
              Text(l10n.navToday, style: theme.typography.xl2.copyWith(fontWeight: FontWeight.w700)),
              const SizedBox(height: 16),
              _CashCard(amount: day.cashInHand, money: money),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(child: StatTile(icon: FIcons.circleCheck, label: l10n.deliveredToday, value: '${delivered.length}')),
                  const SizedBox(width: 12),
                  Expanded(child: StatTile(icon: FIcons.handCoins, label: l10n.handedIn, value: money(handedIn))),
                ],
              ),
              const SizedBox(height: 12),
              if (day.delivered.isEmpty)
                EmptyState(icon: FIcons.receiptText, title: l10n.noneDeliveredToday)
              else ...[
                SectionTitle(l10n.deliveredToday, count: day.delivered.length),
                for (final order in day.delivered) DoneRow(key: ValueKey('done-${order.orderNumber}'), order: order, money: money),
              ],
            ],
          );
        },
      ),
    );
  }
}

/// The cash collected at doors and not yet taken in by the till, large; or, with none, that it is all handed in
class _CashCard extends StatelessWidget {
  final double amount;
  final String Function(double) money;

  const _CashCard({required this.amount, required this.money});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final owed = amount > 0;
    final tint = owed ? AppColors.amber(theme.colors.brightness) : AppColors.emerald(theme.colors.brightness);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: tint.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: tint.withValues(alpha: 0.4)),
      ),
      child: Row(
        children: [
          Container(
            width: 48,
            height: 48,
            decoration: BoxDecoration(color: tint.withValues(alpha: 0.16), shape: BoxShape.circle),
            child: Icon(owed ? FIcons.wallet : FIcons.circleCheck, size: 22, color: tint),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  owed ? l10n.cashWithYou : l10n.allHandedIn,
                  style: theme.typography.sm.copyWith(fontWeight: FontWeight.w600, color: owed ? theme.colors.mutedForeground : tint),
                ),
                if (owed) ...[
                  FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: AlignmentDirectional.centerStart,
                    child: Text(
                      money(amount),
                      maxLines: 1,
                      style: theme.typography.xl3.copyWith(fontWeight: FontWeight.w700, fontFeatures: tabular),
                    ),
                  ),
                  Text(l10n.cashInHandHint, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}
