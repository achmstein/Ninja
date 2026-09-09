import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:intl/intl.dart';
import '../../../core/providers/locale_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../models/account_balance.dart';
import '../services/account_service.dart';
import '../providers/account_provider.dart';

/// Transaction history screen
class TransactionsScreen extends ConsumerStatefulWidget {
  const TransactionsScreen({super.key});

  @override
  ConsumerState<TransactionsScreen> createState() => _TransactionsScreenState();
}

class _TransactionsScreenState extends ConsumerState<TransactionsScreen> {
  late Future<List<AccountTransaction>> _transactionsFuture;

  @override
  void initState() {
    super.initState();
    _loadTransactions();
  }

  void _loadTransactions() {
    _transactionsFuture = ref.read(accountRepositoryProvider).getMyTransactions();
  }

  @override
  Widget build(BuildContext context) {
    final accountState = ref.watch(accountProvider);
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
                      AppLocalizations.of(context)!.transactions,
                      style: TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
                    ),
                  ),
                ],
              ),
            ),

            // Content
            Expanded(
              child: FutureBuilder<List<AccountTransaction>>(
                future: _transactionsFuture,
                builder: (context, snapshot) {
                  if (snapshot.connectionState == ConnectionState.waiting) {
                    return Center(
                      child: CircularProgressIndicator(color: colors.primary),
                    );
                  }

                  if (snapshot.hasError) {
                    return _buildErrorState(colors);
                  }

                  final transactions = snapshot.data ?? [];

                  return RefreshIndicator(
                    color: colors.primary,
                    backgroundColor: colors.background,
                    onRefresh: () async {
                      setState(() {
                        _loadTransactions();
                      });
                      await Future.wait([
                        _transactionsFuture,
                        ref.read(accountProvider.notifier).refresh(),
                      ]);
                    },
                    child: ListView(
                      padding: const EdgeInsets.all(16),
                      children: [
                        // Balance summary card
                        if (accountState.account != null)
                          _buildBalanceSummaryCard(accountState.account!, colors),
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
                        if (transactions.isEmpty)
                          _buildNoTransactions(colors)
                        else
                          ...transactions.map(
                            (transaction) => _TransactionTile(
                              transaction: transaction,
                              isLast: transaction == transactions.last,
                              l10n: AppLocalizations.of(context)!,
                              locale: Localizations.localeOf(context),
                            ),
                          ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBalanceSummaryCard(AccountBalance account, dynamic colors) {
    final isOwed = account.owesAmount;
    final hasCredit = account.hasCredit;

    // Use gradient colors matching the profile's BalanceCard
    final gradientColors = isOwed
        ? [const Color(0xFFEF4444), const Color(0xFFDC2626)]
        : hasCredit
            ? [const Color(0xFF10B981), const Color(0xFF059669)]
            : [colors.muted as Color, colors.muted as Color];

    final shadowColor = isOwed
        ? const Color(0xFFEF4444)
        : hasCredit
            ? const Color(0xFF10B981)
            : colors.muted as Color;

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: gradientColors,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: shadowColor.withValues(alpha: 0.3),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(
                isOwed ? FIcons.circleAlert : hasCredit ? FIcons.check : FIcons.wallet,
                color: Colors.white,
                size: 20,
              ),
              const SizedBox(width: 8),
              AppText(
                isOwed
                    ? AppLocalizations.of(context)!.amountDue
                    : hasCredit
                        ? AppLocalizations.of(context)!.creditBalance
                        : AppLocalizations.of(context)!.account,
                style: TextStyle(
                  color: Colors.white70,
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          AppText(
            AppLocalizations.of(context)!.balanceAmount(account.balance.abs().toStringAsFixed(2), AppLocalizations.of(context)!.currency),
            style: TextStyle(
              color: Colors.white,
              fontSize: 28,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          AppText(
            isOwed
                ? AppLocalizations.of(context)!.pleasePayAtCounter
                : hasCredit
                    ? AppLocalizations.of(context)!.willBeAppliedToNextPurchase
                    : AppLocalizations.of(context)!.noOutstandingBalance,
            style: TextStyle(
              color: Colors.white70,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorState(dynamic colors) {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            FIcons.circleAlert,
            size: 48,
            color: colors.mutedForeground,
          ),
          const SizedBox(height: 16),
          AppText(
            AppLocalizations.of(context)!.failedToLoadTransactions,
            style: TextStyle(color: colors.mutedForeground),
          ),
          const SizedBox(height: 16),
          FButton(
            onPress: () {
              setState(() {
                _loadTransactions();
              });
            },
            child: AppText(AppLocalizations.of(context)!.retry),
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
            FIcons.receipt,
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
  final AccountTransaction transaction;
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
    final isCharge = transaction.isCharge;
    final numberFormat = NumberFormat('#,##0.00');

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
          // Amount indicator - fixed width for alignment
          SizedBox(
            width: 100,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: isCharge
                    ? colors.destructive.withValues(alpha: 0.1)
                    : AppTheme.successColor.withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(6),
              ),
              child: AppText(
                '${isCharge ? '+' : '-'}${numberFormat.format(transaction.amount)}',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: isCharge ? colors.destructive : AppTheme.successColor,
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
                      isCharge ? l10n.charge : l10n.payment,
                      style: TextStyle(
                        fontSize: 15,
                        fontWeight: FontWeight.w500,
                        color: colors.foreground,
                      ),
                    ),
                    AppText(
                      _formatDate(transaction.createdAt, l10n, locale),
                      style: TextStyle(
                        fontSize: 12,
                        color: colors.mutedForeground,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 2),
                if (_transactionDetail(transaction, l10n) case final detail?)
                  AppText(
                    detail,
                    style: TextStyle(
                      fontSize: 13,
                      color: colors.mutedForeground,
                    ),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                  )
                else
                  AppText(
                    l10n.byPerson(transaction.recordedBy),
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

  String _formatDate(DateTime date, AppLocalizations l10n, Locale locale) {
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
}

/// The second line of a ledger entry: the till's receipt or credit note by
/// number, in the user's language, or what staff typed; null falls back to
/// who recorded it
String? _transactionDetail(AccountTransaction transaction, AppLocalizations l10n) {
  if (transaction.source == 'posReceipt' && transaction.sourceNumber != null) return l10n.posReceipt(transaction.sourceNumber!);
  if (transaction.source == 'posCreditNote' && transaction.sourceNumber != null) return l10n.posCreditNote(transaction.sourceNumber!);
  if (transaction.source == 'posTabPayment' && transaction.sourceNumber != null) return l10n.posTabPayment(transaction.sourceNumber!);
  return transaction.description;
}
