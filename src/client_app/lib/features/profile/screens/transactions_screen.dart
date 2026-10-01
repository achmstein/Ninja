import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart' show DateFormat, NumberFormat;
import '../../../core/motion/motion.dart';
import '../../../core/theme/theme_provider.dart';
import '../../../core/ui/ui.dart';
import '../../../core/utils/money.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../models/account_balance.dart';
import '../providers/account_provider.dart';
import '../services/account_service.dart';

/// Amounts in the ledger always in western digits
final _amount = NumberFormat('#,##0.00', 'en');

const _red = NinjaColors.error;
const _green = NinjaColors.success;

/// The house tab (client_web's routes/account.tsx): the balance on the
/// dock's slab, red when the customer owes and green in credit, and what
/// moved it underneath.
class TransactionsScreen extends ConsumerStatefulWidget {
  const TransactionsScreen({super.key});

  @override
  ConsumerState<TransactionsScreen> createState() => _TransactionsScreenState();
}

class _TransactionsScreenState extends ConsumerState<TransactionsScreen> {
  late Future<List<AccountTransaction>> _transactions = ref.read(accountRepositoryProvider).getMyTransactions();

  Future<void> _reload() async {
    final next = ref.read(accountRepositoryProvider).getMyTransactions();
    setState(() => _transactions = next);
    await Future.wait([next, ref.read(accountProvider.notifier).refresh()]);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final c = theme.colors;
    final account = ref.watch(accountProvider);
    final balance = account.account?.balance ?? 0;

    return NinjaPage(
      title: l10n.transactions,
      back: true,
      onRefresh: _reload,
      children: [
        if (account.isLoading && account.account == null)
          Container(height: 160, decoration: BoxDecoration(color: c.muted, borderRadius: BorderRadius.circular(Ninja.cardRadius)))
        else
          _BalanceSlab(balance: balance),
        Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            SectionLabel(l10n.recentActivity),
            FutureBuilder<List<AccountTransaction>>(
              future: _transactions,
              builder: (context, snapshot) {
                if (snapshot.connectionState != ConnectionState.done) {
                  return Container(height: 192, decoration: BoxDecoration(color: c.muted, borderRadius: BorderRadius.circular(Ninja.panelRadius)));
                }
                final list = snapshot.data ?? const [];
                if (list.isEmpty) {
                  return Panel(
                    padding: const EdgeInsets.symmetric(vertical: 32),
                    child: AppText(l10n.noTransactionsYet, textAlign: TextAlign.center, style: theme.typography.note.copyWith(color: c.mutedForeground)),
                  );
                }
                return Panel(
                  padding: EdgeInsets.zero,
                  child: Column(
                    children: [
                      for (final (i, tx) in list.indexed) ...[
                        if (i > 0) Divider(height: 1, thickness: 1, color: c.border.withValues(alpha: 0.6)),
                        _LedgerRow(transaction: tx),
                      ],
                    ],
                  ),
                );
              },
            ),
          ],
        ),
      ],
    );
  }
}

/// The balance as the page's one big thing: red when the customer owes,
/// green when in credit, plain when settled
class _BalanceSlab extends ConsumerWidget {
  final double balance;

  const _BalanceSlab({required this.balance});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final money = ref.watch(moneyProvider);
    final owes = balance > 0;
    final credit = balance < 0;
    return SlabCard(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 28),
      child: Builder(
        builder: (context) {
          final ink = context.theme.colors.foreground;
          final tone = owes ? _red : credit ? _green : ink;
          return Stack(
            clipBehavior: Clip.none,
            children: [
              // The tab's mark, large and faint in the corner
              PositionedDirectional(
                end: -24,
                bottom: -56,
                child: Transform.rotate(angle: -0.21, child: Icon(LucideIcons.wallet, size: 176, color: ink.withValues(alpha: 0.07))),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(owes ? LucideIcons.circleAlert : credit ? LucideIcons.check : LucideIcons.wallet, size: 16, color: owes || credit ? tone : ink.withValues(alpha: 0.6)),
                      const SizedBox(width: 8),
                      Text(
                        owes ? l10n.amountDue : credit ? l10n.creditBalance : l10n.yourBalance,
                        style: context.localeText(theme.typography.note.copyWith(fontWeight: FontWeight.w600, color: owes || credit ? tone : ink.withValues(alpha: 0.6))),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  RollingNumber(
                    money(balance.abs()),
                    value: balance.abs(),
                    style: context.localeText(theme.typography.displayLg.copyWith(fontWeight: FontWeight.w800, color: tone)),
                  ),
                ],
              ),
            ],
          );
        },
      ),
    );
  }
}

/// One move on the tab: a charge (+, red) or a payment (−, green), what it came from, and when
class _LedgerRow extends StatelessWidget {
  final AccountTransaction transaction;

  const _LedgerRow({required this.transaction});

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final theme = context.theme;
    final c = theme.colors;
    final charge = transaction.type == TransactionType.charge;
    final tone = charge ? c.destructive : NinjaColors.success;
    final rtl = Directionality.of(context) == TextDirection.rtl;
    final detail = [_when(context, transaction.createdAt), _detail(l10n, transaction)].where((s) => s.isNotEmpty).join(' · ');
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(color: tone.withValues(alpha: 0.1), shape: BoxShape.circle),
            child: Transform.flip(
              flipX: rtl,
              child: Icon(charge ? LucideIcons.arrowUpRight : LucideIcons.arrowDownLeft, size: 18, color: tone),
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                AppText(charge ? l10n.charge : l10n.payment, style: theme.typography.body.copyWith(fontWeight: FontWeight.w600, color: c.foreground)),
                AppText(detail, maxLines: 2, overflow: TextOverflow.ellipsis, style: theme.typography.caption.copyWith(color: c.mutedForeground)),
              ],
            ),
          ),
          const SizedBox(width: 12),
          Text(
            '${charge ? '+' : '−'}${_amount.format(transaction.amount.abs())}',
            style: theme.typography.body.copyWith(fontWeight: FontWeight.w700, color: tone, fontFeatures: NinjaTypography.tabular),
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

  /// The till's receipt, credit note or tab payment by number, what staff typed, or who recorded it
  static String _detail(AppLocalizations l10n, AccountTransaction tx) {
    final number = tx.sourceNumber;
    if (number != null) {
      switch (tx.source) {
        case 'posReceipt':
          return l10n.posReceipt(number);
        case 'posCreditNote':
          return l10n.posCreditNote(number);
        case 'posTabPayment':
          return l10n.posTabPayment(number);
      }
    }
    if (tx.description != null && tx.description!.isNotEmpty) return tx.description!;
    return tx.recordedBy.isEmpty ? '' : l10n.byPerson(tx.recordedBy);
  }
}
