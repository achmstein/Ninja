import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/models/money.dart';
import '../../../core/network/network_status.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/text_styles.dart';
import '../../../l10n/app_localizations.dart';
import '../models/customer_card.dart';
import '../providers/customer_providers.dart';
import 'pay_tab_dialog.dart';

/// The customer in front of the cashier, at a glance: their points (as
/// information — points are earned, joined and spent in the customer app,
/// never at the till) and their tab, which the till can take money against.
/// Opened by tapping the customer wherever they already appear; there is no
/// list of everyone — the back office has that.
Future<void> showCustomerCard(BuildContext context, {required String id, required String name, String? phone}) {
  return showFDialog<void>(
    context: context,
    useRootNavigator: true,
    builder: (context, style, animation) => FDialog.raw(
      style: style,
      animation: animation,
      constraints: const BoxConstraints(maxWidth: 448),
      builder: (context, _) => _CustomerCard(customer: CardCustomer(id: id, name: name, phone: phone)),
    ),
  );
}

class _CustomerCard extends ConsumerWidget {
  final CardCustomer customer;
  const _CustomerCard({required this.customer});

  String _tierLabel(AppLocalizations l10n, String tier) => switch (tier) {
        'Bronze' => l10n.tierBronze,
        'Silver' => l10n.tierSilver,
        'Gold' => l10n.tierGold,
        'Platinum' => l10n.tierPlatinum,
        _ => tier,
      };

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final brightness = Theme.of(context).brightness;
    const tabular = [FontFeature.tabularFigures()];
    final muted = theme.typography.sm.copyWith(color: theme.colors.mutedForeground);
    final online = ref.watch(onlineProvider);
    // Nothing to read while offline: the hint stands in for both blocks
    final loyalty = online ? ref.watch(loyaltyAccountProvider(customer.id)) : null;
    final tab = online ? ref.watch(tabAccountProvider(customer.id)) : null;

    Widget block(IconData icon, String title, Widget body) => Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(border: Border.all(color: theme.colors.border), borderRadius: BorderRadius.circular(14)),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(children: [
                Icon(icon, size: 16, color: theme.colors.mutedForeground),
                const SizedBox(width: 8),
                Text(title, style: muted),
              ]),
              const SizedBox(height: 4),
              body,
            ],
          ),
        );

    Widget failed(VoidCallback retry) => Row(
          children: [
            Expanded(child: Text(l10n.somethingWentWrong, style: muted)),
            FButton(variant: FButtonVariant.outline, mainAxisSize: MainAxisSize.min, onPress: retry, child: Text(l10n.retry)),
          ],
        );

    Widget offlineHint() => Text(l10n.offlineNotAvailable, style: muted);

    final loading = SizedBox(
      height: 28,
      child: Align(
        alignment: AlignmentDirectional.centerStart,
        child: SizedBox.square(dimension: 18, child: CircularProgressIndicator(strokeWidth: 2, color: theme.colors.mutedForeground)),
      ),
    );

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(children: [
            const Icon(FIcons.user, size: 20),
            const SizedBox(width: 8),
            Expanded(
              child: Text(customer.name.isNotEmpty ? customer.name : l10n.guest,
                  maxLines: 1, overflow: TextOverflow.ellipsis, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
            ),
          ]),
          if (customer.phone case final phone? when phone.isNotEmpty) ...[
            const SizedBox(height: 4),
            Row(children: [
              Icon(FIcons.phone, size: 14, color: theme.colors.mutedForeground),
              const SizedBox(width: 6),
              Directionality(textDirection: TextDirection.ltr, child: Text(phone, style: muted)),
            ]),
          ],
          const SizedBox(height: 16),
          block(
            FIcons.award,
            l10n.loyaltyPoints,
            loyalty == null
                ? offlineHint()
                : loyalty.when(
                    loading: () => loading,
                    error: (_, _) => failed(() => ref.invalidate(loyaltyAccountProvider(customer.id))),
                    data: (account) => account == null
                        ? Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(l10n.notEnrolled, style: theme.typography.base.copyWith(fontWeight: FontWeight.w500)),
                              Text(l10n.joinsFromApp, style: muted),
                            ],
                          )
                        : Row(
                            crossAxisAlignment: CrossAxisAlignment.baseline,
                            textBaseline: TextBaseline.alphabetic,
                            children: [
                              Text(l10n.pointsBalance(account.pointsBalance),
                                  style: theme.typography.xl2.copyWith(fontWeight: FontWeight.w700, fontFeatures: tabular)),
                              const SizedBox(width: 8),
                              Expanded(child: Text(l10n.pointsWorth(money(context, account.worth)), style: muted.copyWith(fontFeatures: tabular))),
                              if (account.tier.isNotEmpty)
                                FBadge(variant: FBadgeVariant.secondary, child: Text(_tierLabel(l10n, account.tier))),
                            ],
                          ),
                  ),
          ),
          const SizedBox(height: 12),
          block(
            FIcons.wallet,
            l10n.tabBalance,
            tab == null
                ? offlineHint()
                : tab.when(
                    loading: () => loading,
                    error: (_, _) => failed(() => ref.invalidate(tabAccountProvider(customer.id))),
                    data: (account) {
                      if (account == null) {
                        return Text(l10n.noTab, style: theme.typography.base.copyWith(fontWeight: FontWeight.w500));
                      }
                      final owed = account.balance;
                      return Row(
                        children: [
                          Expanded(
                            child: Text(
                              owed > 0
                                  ? l10n.owesAmount(money(context, owed))
                                  : owed < 0
                                      ? l10n.creditAmount(money(context, -owed))
                                      : l10n.settledUp,
                              style: theme.typography.xl2.copyWith(
                                fontWeight: FontWeight.w700,
                                fontFeatures: tabular,
                                color: owed > 0 ? theme.colors.destructive : AppColors.emerald(brightness),
                              ),
                            ),
                          ),
                          // Taking money needs something owed; a credit is
                          // paid back from the back office, never the drawer
                          SizedBox(
                            height: 44,
                            child: FButton(
                              mainAxisSize: MainAxisSize.min,
                              onPress: owed > 0
                                  ? () async {
                                      await showPayTabDialog(context, customer: customer, balance: owed);
                                      ref.invalidate(tabAccountProvider(customer.id));
                                    }
                                  : null,
                              child: Text(l10n.payTab, style: theme.typography.base.forButton),
                            ),
                          ),
                        ],
                      );
                    },
                  ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 48,
            child: FButton(
              variant: FButtonVariant.outline,
              onPress: () => Navigator.of(context, rootNavigator: true).pop(),
              child: Text(l10n.done, style: theme.typography.base.forButton),
            ),
          ),
        ],
      ),
    );
  }
}
