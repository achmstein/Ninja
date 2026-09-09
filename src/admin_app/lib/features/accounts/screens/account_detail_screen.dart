import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:intl/intl.dart' show DateFormat;
import '../../../core/widgets/app_text.dart';
import '../../../core/widgets/toast_helpers.dart';
import '../../../l10n/app_localizations.dart';
import '../models/customer_account.dart';
import '../providers/accounts_provider.dart';

class AccountDetailScreen extends ConsumerStatefulWidget {
  final String customerId;

  const AccountDetailScreen({super.key, required this.customerId});

  @override
  ConsumerState<AccountDetailScreen> createState() => _AccountDetailScreenState();
}

class _AccountDetailScreenState extends ConsumerState<AccountDetailScreen> {
  @override
  void initState() {
    super.initState();
    Future.microtask(() {
      ref.read(accountsProvider.notifier).selectAccount(widget.customerId);
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = ref.watch(accountsProvider);
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;

    final account = state.selectedAccount ??
        state.accounts.where((a) => a.customerId == widget.customerId).firstOrNull;
    final transactions = state.selectedAccountTransactions ?? [];

    if (account == null && state.isLoadingTransactions) {
      return Scaffold(
        backgroundColor: theme.colors.background,
        body: SafeArea(
          child: Column(
            children: [
              _buildHeader(context, theme, null, l10n),
              Expanded(child: Center(child: CircularProgressIndicator(color: theme.colors.primary))),
            ],
          ),
        ),
      );
    }

    if (account == null) {
      return Scaffold(
        backgroundColor: theme.colors.background,
        body: SafeArea(
          child: Column(
            children: [
              _buildHeader(context, theme, null, l10n),
              Expanded(
                child: Center(
                  child: AppText(
                    l10n.accountNotFound,
                    style: theme.typography.sm.copyWith(
                      color: theme.colors.mutedForeground,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      );
    }

    final hasBalance = account.hasBalance;

    return Scaffold(
      backgroundColor: theme.colors.background,
      resizeToAvoidBottomInset: false,
      body: SafeArea(
        child: Column(
          children: [
            // Header with name
            _buildHeader(context, theme, account, l10n),

            // Balance and actions
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 12),
              child: Column(
                children: [
                  // Balance label
                  AppText(
                    l10n.balance,
                    style: theme.typography.sm.copyWith(
                      color: theme.colors.mutedForeground,
                    ),
                  ),
                  const SizedBox(height: 4),
                  // Balance amount
                  AppText(
                    l10n.priceFormat(account.balance.toStringAsFixed(0)),
                    style: TextStyle(
                      fontSize: 32,
                      fontWeight: FontWeight.w600,
                      color: hasBalance ? const Color(0xFFEF4444) : theme.colors.foreground,
                    ),
                  ),
                  const SizedBox(height: 16),
                  // Action buttons - full width, side by side
                  Row(
                    children: [
                      Expanded(
                        child: FButton(
                          variant: FButtonVariant.outline,
                          onPress: () => _showAddCharge(context, account, l10n),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.add, size: 18),
                              const SizedBox(width: 8),
                              AppText(l10n.charge),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: FButton(
                          onPress: hasBalance ? () => _showRecordPayment(context, account, l10n) : null,
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.payments_outlined, size: 18),
                              const SizedBox(width: 8),
                              AppText(l10n.payment),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),

            // History section
            Expanded(
              child: _TransactionHistorySection(
                transactions: transactions,
                isLoading: state.isLoadingTransactions,
                onRefresh: () => ref
                    .read(accountsProvider.notifier)
                    .selectAccount(widget.customerId),
                l10n: l10n,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context, FThemeData theme, CustomerAccount? account, AppLocalizations l10n) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
      child: Row(
        children: [
          IconButton(
            icon: const Icon(Icons.arrow_back),
            onPressed: () => context.pop(),
          ),
          const SizedBox(width: 4),
          Expanded(
            child: AppText(
              account?.displayName ?? l10n.accountTab,
              style: theme.typography.base.copyWith(
                fontWeight: FontWeight.w600,
              ),
              overflow: TextOverflow.ellipsis,
            ),
          ),
          if (account != null)
            IconButton(
              icon: const Icon(Icons.person_outline, size: 22),
              onPressed: () => context.go('/customers/${account.customerId}'),
              tooltip: l10n.viewCustomer,
            ),
        ],
      ),
    );
  }

  void _showAddCharge(BuildContext context, CustomerAccount account, AppLocalizations l10n) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: 0.5),
      builder: (ctx) => _AmountSheet(
        title: l10n.addCharge,
        account: account,
        isPayment: false,
        onComplete: () {
          ref.read(accountsProvider.notifier).selectAccount(widget.customerId);
        },
      ),
    );
  }

  void _showRecordPayment(BuildContext context, CustomerAccount account, AppLocalizations l10n) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      useRootNavigator: true,
      backgroundColor: Colors.transparent,
      barrierColor: Colors.black.withValues(alpha: 0.5),
      builder: (ctx) => _AmountSheet(
        title: l10n.record,
        account: account,
        isPayment: true,
        onComplete: () {
          ref.read(accountsProvider.notifier).selectAccount(widget.customerId);
        },
      ),
    );
  }
}

class _TransactionHistorySection extends StatelessWidget {
  final List<AccountTransaction> transactions;
  final bool isLoading;
  final Future<void> Function() onRefresh;
  final AppLocalizations l10n;

  const _TransactionHistorySection({
    required this.transactions,
    required this.isLoading,
    required this.onRefresh,
    required this.l10n,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final locale = Localizations.localeOf(context);
    final dateTimeFormat = DateFormat('dd MMMM hh:mm a', locale.languageCode);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 8),
          child: AppText(
            l10n.history,
            style: theme.typography.sm.copyWith(
              fontWeight: FontWeight.w600,
              color: theme.colors.mutedForeground,
            ),
          ),
        ),

        // List
        Expanded(
          child: isLoading && transactions.isEmpty
              ? Center(child: CircularProgressIndicator(color: theme.colors.primary))
              : transactions.isEmpty
                  ? Center(
                      child: AppText(
                        l10n.noTransactionsYet,
                        style: theme.typography.sm.copyWith(
                          color: theme.colors.mutedForeground,
                        ),
                      ),
                    )
                  : RefreshIndicator(
                      color: theme.colors.primary,
                      backgroundColor: theme.colors.background,
                      onRefresh: onRefresh,
                      child: ListView.builder(
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        itemCount: transactions.length,
                        itemBuilder: (context, index) {
                          final tx = transactions[index];
                          final isCharge = tx.type == TransactionType.charge;

                          return Padding(
                            padding: const EdgeInsets.symmetric(vertical: 10),
                            child: Row(
                              children: [
                                // Type indicator
                                Container(
                                  width: 32,
                                  height: 32,
                                  decoration: BoxDecoration(
                                    color: theme.colors.primary.withValues(alpha: 0.1),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Icon(
                                    isCharge ? Icons.arrow_upward : Icons.arrow_downward,
                                    size: 16,
                                    color: theme.colors.primary,
                                  ),
                                ),
                                const SizedBox(width: 12),

                                // Description and date
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      AppText(
                                        _transactionLabel(tx, l10n, isCharge),
                                        style: theme.typography.sm.copyWith(
                                          fontWeight: FontWeight.w500,
                                        ),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      const SizedBox(height: 4),
                                      AppText(
                                        dateTimeFormat.format(tx.createdAt.toLocal()),
                                        style: theme.typography.xs.copyWith(
                                          color: theme.colors.mutedForeground,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),

                                // Amount
                                AppText(
                                  '${isCharge ? '+' : '-'}${l10n.priceFormat(tx.amount.toStringAsFixed(0))}',
                                  style: theme.typography.sm.copyWith(
                                    fontWeight: FontWeight.w600,
                                    color: isCharge
                                        ? const Color(0xFFEF4444)
                                        : const Color(0xFF22C55E),
                                  ),
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
        ),
      ],
    );
  }
}

class _AmountSheet extends ConsumerStatefulWidget {
  final String title;
  final CustomerAccount account;
  final bool isPayment;
  final VoidCallback? onComplete;

  const _AmountSheet({
    required this.title,
    required this.account,
    required this.isPayment,
    this.onComplete,
  });

  @override
  ConsumerState<_AmountSheet> createState() => _AmountSheetState();
}

class _AmountSheetState extends ConsumerState<_AmountSheet> {
  final _amountController = TextEditingController();
  final _descriptionController = TextEditingController();
  bool _isSubmitting = false;

  @override
  void dispose() {
    _amountController.dispose();
    _descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;

    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
      child: Container(
      decoration: BoxDecoration(
        color: theme.colors.background,
        borderRadius: const BorderRadius.vertical(top: Radius.circular(20)),
      ),
      child: SafeArea(
          top: false,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Drag handle
              Container(
                margin: const EdgeInsets.only(top: 12, bottom: 8),
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: theme.colors.mutedForeground,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),

              // Header
              Padding(
                padding: const EdgeInsets.only(left: 16, right: 16, top: 2, bottom: 8),
                child: Row(
                  children: [
                    Expanded(
                      child: AppText(
                        widget.title,
                        style: theme.typography.lg.copyWith(
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                    GestureDetector(
                      onTap: () => Navigator.of(context).pop(),
                      child: Icon(Icons.close, color: theme.colors.mutedForeground),
                    ),
                  ],
                ),
              ),

              // Form content
              Flexible(
                child: SingleChildScrollView(
                  padding: const EdgeInsets.only(
                    left: 16,
                    right: 16,
                    top: 16,
                    bottom: 0,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Current balance (for payments)
                    if (widget.isPayment) ...[
                      Container(
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFEF4444).withValues(alpha: 0.08),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            AppText(
                              l10n.currentBalance,
                              style: theme.typography.sm.copyWith(
                                color: theme.colors.mutedForeground,
                              ),
                            ),
                            AppText(
                              l10n.priceFormat(widget.account.balance.toStringAsFixed(0)),
                              style: theme.typography.sm.copyWith(
                                fontWeight: FontWeight.w600,
                                color: const Color(0xFFEF4444),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 16),
                    ],

                    // Amount
                    AppText(
                      l10n.amountEgpLabel,
                      style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500),
                    ),
                    const SizedBox(height: 8),
                    FTextField(
                      control: FTextFieldControl.managed(controller: _amountController),
                      hint: '0',
                      keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    ),

                    const SizedBox(height: 16),

                    // Description
                    AppText(
                      l10n.description,
                      style: theme.typography.sm.copyWith(fontWeight: FontWeight.w500),
                    ),
                    const SizedBox(height: 8),
                    FTextField.multiline(
                      control: FTextFieldControl.managed(controller: _descriptionController),
                      hint: widget.isPayment ? l10n.cashPaymentHint : l10n.sessionBalanceHint,
                      minLines: 2,
                      maxLines: 3,
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),

            // Actions
            Padding(
              padding: EdgeInsets.only(
                left: 16,
                right: 16,
                top: 12,
                bottom: 12,
              ),
              child: Row(
                children: [
                  Expanded(
                    child: FButton(
                      variant: FButtonVariant.outline,
                      onPress: () => Navigator.of(context).pop(),
                      child: AppText(l10n.cancel),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FButton(
                      variant: widget.isPayment
                          ? null
                          : FButtonVariant.destructive,
                      onPress: _isSubmitting ? null : _submit,
                      child: _isSubmitting
                          ? SizedBox(
                              width: 20,
                              height: 20,
                              child: CircularProgressIndicator(strokeWidth: 2, color: theme.colors.primary),
                            )
                          : AppText(widget.isPayment ? l10n.record : l10n.addCharge),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    ),
    );
  }

  Future<void> _submit() async {
    final l10n = AppLocalizations.of(context)!;
    final amount = double.tryParse(_amountController.text);
    if (amount == null || amount <= 0) {
      showErrorToast(context, l10n.pleaseEnterValidAmount);
      return;
    }

    setState(() => _isSubmitting = true);

    bool success;
    if (widget.isPayment) {
      success = await ref.read(accountsProvider.notifier).recordPayment(
            customerId: widget.account.customerId,
            amount: amount,
            description: _descriptionController.text.isNotEmpty
                ? _descriptionController.text
                : null,
          );
    } else {
      success = await ref.read(accountsProvider.notifier).addCharge(
            customerId: widget.account.customerId,
            amount: amount,
            description: _descriptionController.text.isNotEmpty
                ? _descriptionController.text
                : null,
            customerName: widget.account.displayName,
          );
    }

    setState(() => _isSubmitting = false);

    if (mounted) {
      if (success) {
        Navigator.of(context).pop();
        widget.onComplete?.call();
        showSuccessToast(context, widget.isPayment ? l10n.paymentRecorded : l10n.chargeAdded);
      } else {
        showErrorToast(context, widget.isPayment ? l10n.failedToRecordPayment : l10n.failedToAddCharge);
      }
    }
  }
}

/// What a ledger line is: the till's receipt or credit note by number, in
/// the user's language; otherwise what staff typed, or just Charge / Payment
String _transactionLabel(AccountTransaction tx, AppLocalizations l10n, bool isCharge) {
  if (tx.source == 'posReceipt' && tx.sourceNumber != null) return l10n.posReceipt(tx.sourceNumber!);
  if (tx.source == 'posCreditNote' && tx.sourceNumber != null) return l10n.posCreditNote(tx.sourceNumber!);
  if (tx.description?.isNotEmpty == true) return tx.description!;
  return isCharge ? l10n.charge : l10n.payment;
}
