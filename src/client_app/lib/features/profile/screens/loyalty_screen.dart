import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:intl/intl.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../models/loyalty_info.dart';
import '../providers/loyalty_provider.dart';
import '../widgets/loyalty_card.dart' show getLocalizedTierName;

/// Loyalty history screen
class LoyaltyScreen extends ConsumerStatefulWidget {
  const LoyaltyScreen({super.key});

  @override
  ConsumerState<LoyaltyScreen> createState() => _LoyaltyScreenState();
}

class _LoyaltyScreenState extends ConsumerState<LoyaltyScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(loyaltyProvider.notifier).refresh();
    });
  }

  @override
  Widget build(BuildContext context) {
    final loyaltyState = ref.watch(loyaltyProvider);
    final colors = context.theme.colors;

    return FScaffold(
      child: SafeArea(
        child: Column(
          children: [
            // Header with back button
            Container(
              padding: const EdgeInsets.only(left: 8, right: 16, top: 8, bottom: 8),
              child: Row(
                children: [
                  GestureDetector(
                    onTap: () => Navigator.pop(context),
                    child: const Icon(FIcons.arrowLeft, size: 22),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: AppText(
                      AppLocalizations.of(context)!.loyaltyRewards,
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),

            // Content
            Expanded(
            child: loyaltyState.isLoading && loyaltyState.loyaltyInfo == null
                ? Center(
                    child: CircularProgressIndicator(color: colors.primary),
                  )
                : loyaltyState.loyaltyInfo == null
                    ? _buildEmptyState(colors)
                    : RefreshIndicator(
                        color: colors.primary,
                        backgroundColor: colors.background,
                        onRefresh: () => ref.read(loyaltyProvider.notifier).refresh(),
                        child: ListView(
                          padding: const EdgeInsets.all(16),
                          children: [
                            // Summary card
                            _buildSummaryCard(loyaltyState.loyaltyInfo!, colors),
                            const SizedBox(height: 24),

                            // Recent Activity header
                            AppText(
                              AppLocalizations.of(context)!.recentActivity,
                              style: TextStyle(
                                fontSize: 16,
                                fontWeight: FontWeight.w600,
                                color: colors.foreground,
                              ),
                            ),
                            const SizedBox(height: 12),

                            // Transactions list
                            if (loyaltyState.recentTransactions.isEmpty)
                              _buildNoTransactions(colors)
                            else
                              ...loyaltyState.recentTransactions.map(
                                (transaction) => _TransactionTile(
                                  transaction: transaction,
                                  isLast: transaction ==
                                      loyaltyState.recentTransactions.last,
                                  l10n: AppLocalizations.of(context)!,
                                  locale: Localizations.localeOf(context),
                                ),
                              ),
                          ],
                        ),
                      ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmptyState(dynamic colors) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            FIcons.gift,
            size: 48,
            color: colors.mutedForeground,
          ),
          const SizedBox(height: 16),
          AppText(
            AppLocalizations.of(context)!.noLoyaltyAccountYet,
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.w500,
              color: colors.foreground,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSummaryCard(LoyaltyInfo info, dynamic colors) {
    final numberFormat = NumberFormat('#,###');
    final tierColor = Color(info.currentTier.colorValue);
    final textColor =
        (info.currentTier == LoyaltyTier.bronze || info.currentTier == LoyaltyTier.platinum)
            ? Colors.white
            : Colors.black87;

    return Container(
      decoration: BoxDecoration(
        color: colors.background,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        children: [
          // Header (same as LoyaltyCard)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(
              border: Border(bottom: BorderSide(color: colors.border)),
            ),
            child: Row(
              children: [
                Icon(
                  FIcons.gift,
                  color: tierColor,
                  size: 20,
                ),
                const SizedBox(width: 8),
                AppText(
                  AppLocalizations.of(context)!.loyaltyRewards,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 16,
                    color: colors.foreground,
                  ),
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: info.currentTier.gradientColors
                          .map((c) => Color(c))
                          .toList(),
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: [
                      BoxShadow(
                        color: tierColor.withValues(alpha: 0.3),
                        blurRadius: 4,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: AppText(
                    getLocalizedTierName(info.currentTier, AppLocalizations.of(context)!),
                    style: TextStyle(
                      color: textColor,
                      fontSize: 11,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 0.5,
                    ),
                  ),
                ),
              ],
            ),
          ),

          // Content (same as LoyaltyCard)
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                // Points row
                Row(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Expanded(
                      child: AppText(
                        '${numberFormat.format(info.pointsBalance)} ${AppLocalizations.of(context)!.pts}',
                        style: TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.bold,
                          color: colors.foreground,
                        ),
                      ),
                    ),
                    AppText(
                      AppLocalizations.of(context)!.lifetimePoints(numberFormat.format(info.lifetimePoints)),
                      style: TextStyle(
                        fontSize: 13,
                        color: colors.mutedForeground,
                      ),
                    ),
                  ],
                ),

                // Progress to next tier
                if (info.nextTier != null) ...[
                  const SizedBox(height: 16),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: info.progressToNextTier,
                      backgroundColor: tierColor.withValues(alpha: 0.2),
                      valueColor: AlwaysStoppedAnimation<Color>(tierColor),
                      minHeight: 6,
                    ),
                  ),
                  const SizedBox(height: 8),
                  AppText(
                    AppLocalizations.of(context)!.pointsToNextTier(numberFormat.format(info.pointsToNextTier), getLocalizedTierName(info.nextTier!, AppLocalizations.of(context)!)),
                    style: TextStyle(
                      fontSize: 13,
                      color: colors.mutedForeground,
                    ),
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNoTransactions(dynamic colors) {
    return Container(
      padding: const EdgeInsets.all(32),
      child: Column(
        children: [
          Icon(
            FIcons.history,
            size: 40,
            color: colors.mutedForeground,
          ),
          const SizedBox(height: 12),
          AppText(
            AppLocalizations.of(context)!.noTransactionsYet,
            style: TextStyle(color: colors.mutedForeground),
          ),
        ],
      ),
    );
  }
}

/// Transaction tile widget
class _TransactionTile extends StatelessWidget {
  final PointsTransaction transaction;
  final bool isLast;
  final AppLocalizations l10n;
  final Locale locale;

  const _TransactionTile({
    required this.transaction,
    this.isLast = false,
    required this.l10n,
    required this.locale,
  });

  @override
  Widget build(BuildContext context) {
    final colors = context.theme.colors;
    final isEarned = transaction.isEarned;
    final numberFormat = NumberFormat('#,###');

    return Container(
      decoration: BoxDecoration(
        border: isLast
            ? null
            : Border(bottom: BorderSide(color: colors.border)),
      ),
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Points indicator - fixed width for alignment
          SizedBox(
            width: 90,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: isEarned
                    ? AppTheme.successColor.withValues(alpha: 0.1)
                    : colors.destructive.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(6),
              ),
              child: AppText(
                '${isEarned ? '+' : '-'}${numberFormat.format(transaction.points.abs())}',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: isEarned ? AppTheme.successColor : colors.destructive,
                ),
              ),
            ),
          ),
          const SizedBox(width: 12),

          // Details
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    AppText(
                      _getLocalizedTypeDisplay(transaction.type),
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w500,
                        color: colors.foreground,
                      ),
                    ),
                    AppText(
                      _formatDate(transaction.createdAt),
                      style: TextStyle(
                        fontSize: 12,
                        color: colors.mutedForeground,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                AppText(
                  _getLocalizedDescription(transaction),
                  style: TextStyle(
                    fontSize: 13,
                    color: colors.mutedForeground,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime date) {
    final now = DateTime.now();
    final difference = now.difference(date);

    if (difference.inDays == 0) {
      return l10n.today;
    } else if (difference.inDays == 1) {
      return l10n.yesterday;
    } else if (difference.inDays < 7) {
      return l10n.daysAgo(difference.inDays);
    } else {
      return DateFormat('MMM d', locale.languageCode).format(date);
    }
  }

  String _getLocalizedTypeDisplay(TransactionType type) {
    switch (type) {
      case TransactionType.purchase:
        return l10n.transactionTypePurchase;
      case TransactionType.bonus:
        return l10n.transactionTypeBonus;
      case TransactionType.referral:
        return l10n.transactionTypeReferral;
      case TransactionType.promotion:
        return l10n.transactionTypePromotion;
      case TransactionType.redemption:
        return l10n.transactionTypeRedemption;
      case TransactionType.adjustment:
        return l10n.transactionTypeAdjustment;
    }
  }

  String _getLocalizedDescription(PointsTransaction transaction) {
    // If description is provided (from admin), use it
    if (transaction.description != null && transaction.description!.isNotEmpty) {
      return transaction.description!;
    }

    // Otherwise, construct message based on type and referenceId
    final referenceId = transaction.referenceId;

    switch (transaction.type) {
      case TransactionType.purchase:
        return referenceId != null
            ? l10n.pointsEarnedFromOrder(referenceId)
            : l10n.transactionTypePurchase;
      case TransactionType.redemption:
        return referenceId != null
            ? l10n.pointsRedeemedForOrder(referenceId)
            : l10n.transactionTypeRedemption;
      case TransactionType.bonus:
        return l10n.transactionTypeBonus;
      case TransactionType.referral:
        return l10n.transactionTypeReferral;
      case TransactionType.promotion:
        return l10n.transactionTypePromotion;
      case TransactionType.adjustment:
        return l10n.transactionTypeAdjustment;
    }
  }
}
