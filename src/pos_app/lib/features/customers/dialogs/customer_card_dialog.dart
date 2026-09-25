import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/brand/brand_provider.dart';
import '../../../core/utils/whatsapp.dart';
import '../../../core/widgets/skeleton.dart';
import '../../../core/models/money.dart';
import '../../../core/network/network_status.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/text_styles.dart';
import '../../../l10n/app_localizations.dart';
import '../models/customer_card.dart';
import '../providers/customer_providers.dart';
import 'app_link_dialog.dart';
import 'pay_tab_dialog.dart';

/// The customer in front of the cashier, at a glance: their points (as
/// information — points are earned, joined and spent in the customer app,
/// never at the till) and their tab, which the till can take money against.
/// Opened by tapping the customer wherever they already appear; there is no
/// list of everyone — the back office has that.
///
/// A customer [addedAtCounter] (by name and phone, not yet claimed) is
/// marked so, and offers the one-time app link that makes the account theirs.
Future<void> showCustomerCard(BuildContext context, {required String id, required String name, String? phone, bool addedAtCounter = false}) {
  return showFDialog<void>(
    context: context,
    useRootNavigator: true,
    builder: (context, style, animation) => FDialog.raw(
      style: style,
      animation: animation,
      constraints: const BoxConstraints(maxWidth: 448),
      builder: (context, _) => _CustomerCard(customer: CardCustomer(id: id, name: name, phone: phone), addedAtCounter: addedAtCounter),
    ),
  );
}

class _CustomerCard extends ConsumerWidget {
  final CardCustomer customer;
  final bool addedAtCounter;
  const _CustomerCard({required this.customer, this.addedAtCounter = false});

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
    // A tenant without loyalty or tabs has no such block at all
    final features = ref.watch(featuresProvider);
    // Nothing to read while offline: the hint stands in for both blocks
    final loyalty = online && features.loyalty ? ref.watch(loyaltyAccountProvider(customer.id)) : null;
    final tab = online && features.tabs ? ref.watch(tabAccountProvider(customer.id)) : null;

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

    final loading = Skeleton(
      child: SizedBox(
        height: 28,
        child: Align(
          alignment: AlignmentDirectional.centerStart,
          child: skeletonBar(context, widthFactor: 0.5, height: 16),
        ),
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
              const SizedBox(width: 6),
              // The customer on WhatsApp, from the till's own account
              GestureDetector(
                onTap: () => openWhatsApp(phone, country: ref.read(brandProvider).locale.country),
                child: Icon(FIcons.messageCircle, size: 16, color: AppColors.emerald(brightness)),
              ),
            ]),
          ],
          if (addedAtCounter) ...[
            const SizedBox(height: 8),
            Align(
              alignment: AlignmentDirectional.centerStart,
              child: FBadge(variant: FBadgeVariant.secondary, child: Text(l10n.addedAtCounter)),
            ),
          ],
          const SizedBox(height: 16),
          if (features.loyalty) ...[
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
          ],
          if (features.tabs) ...[
            block(
              FIcons.wallet,
              l10n.tabBalance,
              tab == null
                  ? offlineHint()
                  : tab.when(
                      loading: () => loading,
                      error: (_, _) => failed(() => ref.invalidate(tabAccountProvider(customer.id))),
                      data: (account) {
                        final owed = account?.balance ?? 0;
                        return Row(
                          children: [
                            Expanded(
                              child: account == null
                                  ? Text(l10n.noTab, style: theme.typography.base.copyWith(fontWeight: FontWeight.w500))
                                  : Text(
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
                            // Money owed is paid down; anything beyond it, or
                            // anything at all on an empty tab, is credit the
                            // customer spends on account later - prepaid, money
                            // in the drawer before the sale. Same slip either way.
                            SizedBox(
                              height: 44,
                              child: FButton(
                                mainAxisSize: MainAxisSize.min,
                                onPress: () async {
                                  await showPayTabDialog(context, customer: customer, balance: owed);
                                  ref.invalidate(tabAccountProvider(customer.id));
                                },
                                child: Text(owed > 0 ? l10n.payTab : l10n.topUp, style: theme.typography.base.forButton),
                              ),
                            ),
                          ],
                        );
                      },
                    ),
            ),
            const SizedBox(height: 12),
          ],
          // Their account, theirs: a link to set an email and a password
          if (addedAtCounter && online) ...[
            SizedBox(
              height: 48,
              child: FButton(
                variant: FButtonVariant.outline,
                onPress: () => sendAppLink(context, ref, id: customer.id, name: customer.name, phone: customer.phone),
                prefix: const Icon(FIcons.qrCode, size: 18),
                child: Text(l10n.sendAppLink, style: theme.typography.base.forButton),
              ),
            ),
            const SizedBox(height: 8),
          ],
          const SizedBox(height: 4),
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
