import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:ninja_app_core/theme/text_styles.dart';
import 'package:uuid/uuid.dart';
import '../../../core/models/money.dart';
import '../../../core/widgets/numeric_keypad.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../models/customer_card.dart';
import '../providers/customer_providers.dart';
import '../services/customer_card_service.dart';

/// What a customer already owed when the business started keeping its tabs
/// here: the figure from the old notebook, put on their tab as it stands. No
/// money changes hands and nothing is sold, so the drawer and the shift know
/// nothing of it; the customer pays it down like any other debt. The owner's
/// or a manager's to enter (Accounts refuses a cashier). True once added.
Future<bool?> showOldBalanceDialog(BuildContext context, {required CardCustomer customer}) {
  return showFDialog<bool>(
    context: context,
    useRootNavigator: true,
    builder: (context, style, animation) => FDialog.raw(
      style: style,
      animation: animation,
      constraints: const BoxConstraints(maxWidth: 448),
      builder: (context, _) => _OldBalanceDialog(customer: customer),
    ),
  );
}

class _OldBalanceDialog extends ConsumerStatefulWidget {
  final CardCustomer customer;
  const _OldBalanceDialog({required this.customer});

  @override
  ConsumerState<_OldBalanceDialog> createState() => _OldBalanceDialogState();
}

class _OldBalanceDialogState extends ConsumerState<_OldBalanceDialog> {
  String _amountStr = '';
  bool _saving = false;
  // One request id per dialog: a retry on shaky Wi-Fi must not owe them twice
  final String _requestId = const Uuid().v4();

  double get _amount => double.tryParse(_amountStr.isEmpty ? '0' : _amountStr) ?? 0;

  Future<void> _confirm() async {
    final amount = _amount;
    if (amount <= 0 || _saving) return;
    final l10n = AppLocalizations.of(context)!;
    setState(() => _saving = true);
    try {
      await ref.read(customerCardServiceProvider).addOldBalance(
            widget.customer.id,
            amount: amount,
            description: l10n.oldBalance,
            customerName: widget.customer.name.isNotEmpty ? widget.customer.name : null,
            requestId: _requestId,
          );
      invalidateCustomerFrom(ref, widget.customer.id);
      if (!mounted) return;
      showPosToast(context, PosToastType.success, l10n.oldBalanceAdded(money(context, amount)));
      Navigator.of(context, rootNavigator: true).pop(true);
    } catch (_) {
      if (mounted) showPosToast(context, PosToastType.error, l10n.somethingWentWrong);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    const tabular = [FontFeature.tabularFigures()];
    final muted = theme.typography.sm.copyWith(color: theme.colors.mutedForeground);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsetsDirectional.fromSTEB(20, 12, 20, 12),
          decoration: BoxDecoration(border: Border(bottom: BorderSide(color: theme.colors.border))),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(l10n.addOldBalance, style: theme.typography.lg.copyWith(fontWeight: FontWeight.w600)),
              Text(
                widget.customer.name.isNotEmpty ? widget.customer.name : l10n.guest,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: muted,
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(l10n.oldBalanceHint, style: muted),
              const SizedBox(height: 12),
              Directionality(
                textDirection: TextDirection.ltr,
                child: Container(
                  height: Sizes.controlLarge,
                  alignment: Alignment.centerRight,
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(Sizes.radius)),
                  // Shrinks to fit rather than clip: a phone's larger font setting overflows the box
                  child: FittedBox(
                    fit: BoxFit.scaleDown,
                    alignment: Alignment.centerRight,
                    child: Text(
                      _amountStr.isEmpty ? '0' : _amountStr,
                      maxLines: 1,
                      style: theme.typography.xl3.copyWith(fontWeight: FontWeight.w700, fontFeatures: tabular),
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 12),
              NumericKeypad(value: _amountStr, onChange: (v) => setState(() => _amountStr = v)),
              const SizedBox(height: 12),
              SizedBox(
                height: Sizes.controlLarge,
                child: FButton(
                  onPress: _amount > 0 && !_saving ? _confirm : null,
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  suffix: Text(money(context, _amount), style: theme.typography.lg.forButton.copyWith(fontFeatures: tabular)),
                  child: Text(l10n.addOldBalance, style: theme.typography.lg.forButton),
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
