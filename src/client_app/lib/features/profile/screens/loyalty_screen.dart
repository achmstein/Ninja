import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/ui/ui.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../models/loyalty_info.dart';
import '../providers/loyalty_provider.dart';

/// A tier's name in the app's language
String tierName(AppLocalizations l10n, LoyaltyTier tier) => switch (tier) {
      LoyaltyTier.bronze => l10n.tierBronze,
      LoyaltyTier.silver => l10n.tierSilver,
      LoyaltyTier.gold => l10n.tierGold,
      LoyaltyTier.platinum => l10n.tierPlatinum,
    };

/// The tier, as a chip in the points' amber
class TierChip extends StatelessWidget {
  final LoyaltyTier tier;
  final bool large;

  const TierChip({super.key, required this.tier, this.large = false});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    const ink = Color(0xFFFCD34D);
    return Container(
      padding: EdgeInsets.symmetric(horizontal: large ? 12 : 10, vertical: 4),
      decoration: ShapeDecoration(color: pointsAmber.withValues(alpha: 0.15), shape: const StadiumBorder()),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(LucideIcons.award, size: large ? 16 : 14, color: ink),
          const SizedBox(width: 6),
          Text(
            tierName(AppLocalizations.of(context)!, tier),
            style: context.localeText((large ? theme.typography.note : theme.typography.caption).copyWith(fontWeight: FontWeight.w700, color: ink)),
          ),
        ],
      ),
    );
  }
}

/// Loyalty (client_web's routes/loyalty.tsx): the balance as a ring round
/// towards the next tier on the dock's slab, the tier, the lifetime points
/// and what is left to the next; then the recent activity, earned in green
/// and spent in red. Not a member yet: the way to join.
class LoyaltyScreen extends ConsumerStatefulWidget {
  const LoyaltyScreen({super.key});

  @override
  ConsumerState<LoyaltyScreen> createState() => _LoyaltyScreenState();
}

class _LoyaltyScreenState extends ConsumerState<LoyaltyScreen> {
  @override
  void initState() {
    super.initState();
    // Opened straight (a link, a notification) the points are not loaded yet; from You, they are fresh again
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final loyalty = ref.read(loyaltyProvider.notifier);
      ref.read(loyaltyProvider).loyaltyInfo == null ? loyalty.loadLoyaltyInfo() : loyalty.refresh();
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final c = theme.colors;
    final state = ref.watch(loyaltyProvider);
    final info = state.loyaltyInfo;

    // Still finding out: a quiet block, so the card never shows 0 points before the way to join
    if (info == null && state.isLoading) {
      return NinjaPage(
        title: l10n.loyaltyRewards,
        back: true,
        children: [
          Container(height: 176, decoration: BoxDecoration(color: c.muted, borderRadius: BorderRadius.circular(Ninja.cardRadius))),
        ],
      );
    }

    if (info == null) {
      return NinjaPage(
        title: l10n.loyaltyRewards,
        back: true,
        children: [
          EmptyState(
            icon: LucideIcons.award,
            title: l10n.joinOurLoyaltyProgram,
            action: NinjaButton(
              mainAxisSize: MainAxisSize.min,
              lifted: true,
              onPress: () => ref.read(loyaltyProvider.notifier).joinLoyaltyProgram(),
              child: AppText(l10n.joinNow),
            ),
          ),
        ],
      );
    }

    final number = NumberFormat('#,###');
    return NinjaPage(
      title: l10n.loyaltyRewards,
      back: true,
      onRefresh: () => ref.read(loyaltyProvider.notifier).refresh(),
      children: [
        SlabCard(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 28),
          child: Builder(
            builder: (context) {
              final ink = context.theme.colors.foreground;
              final note = context.localeText(theme.typography.note.copyWith(color: ink.withValues(alpha: 0.6)));
              return Column(
                children: [
                  PointsRing(points: info.pointsBalance, progress: info.ringProgress, label: l10n.pts, size: 148),
                  const SizedBox(height: 16),
                  TierChip(tier: info.currentTier, large: true),
                  const SizedBox(height: 6),
                  Text(l10n.lifetimePoints(number.format(info.lifetimePoints)), style: note),
                  if (info.nextTier != null)
                    Text(
                      l10n.pointsToNextTier(number.format(info.pointsToNextTier), tierName(l10n, info.nextTier!)),
                      style: note.copyWith(color: ink.withValues(alpha: 0.8)),
                    ),
                ],
              );
            },
          ),
        ),
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SectionLabel(l10n.recentActivity),
            if (state.recentTransactions.isEmpty)
              Panel(
                padding: const EdgeInsets.symmetric(vertical: 32),
                child: AppText(
                  l10n.noTransactionsYet,
                  textAlign: TextAlign.center,
                  style: theme.typography.note.copyWith(color: c.mutedForeground),
                ),
              )
            else
              Panel(
                padding: EdgeInsets.zero,
                child: Column(
                  children: [
                    for (final (i, tx) in state.recentTransactions.indexed) ...[
                      if (i > 0) Divider(height: 1, thickness: 1, color: c.border.withValues(alpha: 0.6)),
                      _Activity(transaction: tx),
                    ],
                  ],
                ),
              ),
          ],
        ),
      ],
    );
  }
}

class _Activity extends StatelessWidget {
  final PointsTransaction transaction;

  const _Activity({required this.transaction});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final c = theme.colors;
    final earned = transaction.points >= 0;
    final tone = earned ? NinjaColors.success : c.destructive;
    final detail = [_when(context, transaction.createdAt), _description(l10n, transaction)].where((s) => s.isNotEmpty).join(' · ');
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AppText(_type(l10n, transaction.type), style: theme.typography.body.copyWith(fontWeight: FontWeight.w600, color: c.foreground)),
                AppText(detail, maxLines: 2, overflow: TextOverflow.ellipsis, style: theme.typography.caption.copyWith(color: c.mutedForeground)),
              ],
            ),
          ),
          const SizedBox(width: 12),
          // Earned in green, spent in red
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
            decoration: ShapeDecoration(color: tone.withValues(alpha: 0.12), shape: const StadiumBorder()),
            child: Text(
              '${earned ? '+' : '−'}${NumberFormat('#,###').format(transaction.points.abs())}',
              style: theme.typography.note.copyWith(fontWeight: FontWeight.w700, color: tone, fontFeatures: NinjaTypography.tabular),
            ),
          ),
        ],
      ),
    );
  }

  /// Relative for the first week, then "MMM d"
  static String _when(BuildContext context, DateTime date) {
    final l10n = AppLocalizations.of(context)!;
    final days = DateTime.now().difference(date).inDays;
    if (days <= 0) return l10n.today;
    if (days == 1) return l10n.yesterday;
    if (days < 7) return l10n.daysAgo(days);
    return DateFormat('MMM d', Localizations.localeOf(context).languageCode).format(date);
  }

  static String _type(AppLocalizations l10n, TransactionType type) => switch (type) {
        TransactionType.purchase => l10n.transactionTypePurchase,
        TransactionType.bonus => l10n.transactionTypeBonus,
        TransactionType.referral => l10n.transactionTypeReferral,
        TransactionType.promotion => l10n.transactionTypePromotion,
        TransactionType.redemption => l10n.transactionTypeRedemption,
        TransactionType.adjustment => l10n.transactionTypeAdjustment,
      };

  /// What the business wrote, or the order it came from
  static String _description(AppLocalizations l10n, PointsTransaction tx) {
    if (tx.description != null && tx.description!.isNotEmpty) return tx.description!;
    final ref = tx.referenceId;
    if (ref == null) return '';
    return switch (tx.type) {
      TransactionType.purchase => l10n.pointsEarnedFromOrder(ref),
      TransactionType.redemption => l10n.pointsRedeemedForOrder(ref),
      _ => '',
    };
  }
}
