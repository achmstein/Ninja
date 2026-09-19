import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../../core/widgets/app_text.dart';
import '../../../l10n/app_localizations.dart';
import '../../../core/utils/money.dart';
import '../providers/account_provider.dart';

/// Balance card widget for profile screen
/// Only shown when customer has outstanding balance
class BalanceCard extends ConsumerWidget {
  const BalanceCard({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final accountState = ref.watch(accountProvider);
    final account = accountState.account;
    final l10n = AppLocalizations.of(context)!;

    // Safety check - parent should handle visibility
    if (account == null || !account.hasBalance) {
      return const SizedBox.shrink();
    }

    return GestureDetector(
      onTap: () => context.push('/transactions'),
      child: Container(
        margin: const EdgeInsets.only(bottom: 16),
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: account.owesAmount
                ? [const Color(0xFFEF4444), const Color(0xFFDC2626)]
                : [const Color(0xFF10B981), const Color(0xFF059669)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(16),
          boxShadow: [
            BoxShadow(
              color: (account.owesAmount ? const Color(0xFFEF4444) : const Color(0xFF10B981))
                  .withValues(alpha: 0.3),
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
                  account.owesAmount ? FIcons.circleAlert : FIcons.check,
                  color: Colors.white,
                  size: 20,
                ),
                const SizedBox(width: 8),
                AppText(
                  account.owesAmount ? l10n.amountDue : l10n.creditBalance,
                  style: TextStyle(
                    color: Colors.white70,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const Spacer(),
                Icon(
                  FIcons.chevronRight,
                  color: Colors.white70,
                  size: 20,
                ),
              ],
            ),
            const SizedBox(height: 8),
            AppText(
              ref.watch(moneyProvider)(account.balance.abs()),
              style: TextStyle(
                color: Colors.white,
                fontSize: 28,
                fontWeight: FontWeight.bold,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
