import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:uuid/uuid.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../providers/shifts_provider.dart';
import '../services/shifts_service.dart';
import '../widgets/amount_entry.dart';

/// Opens the branch's drawer shift with the counted opening float. A float
/// of exactly 0 is legitimate, so the cashier must type something — even a
/// bare 0 — before confirming. Resolves to true once the shift is open.
Future<bool> showOpenShiftDialog(BuildContext context) async {
  final opened = await showFDialog<bool>(
    context: context,
    useRootNavigator: true,
    builder: (context, style, animation) => FDialog.raw(
      style: style,
      animation: animation,
      constraints: const BoxConstraints(maxWidth: 448),
      builder: (context, _) => const _OpenShiftDialog(),
    ),
  );
  return opened ?? false;
}

class _OpenShiftDialog extends ConsumerStatefulWidget {
  const _OpenShiftDialog();

  @override
  ConsumerState<_OpenShiftDialog> createState() => _OpenShiftDialogState();
}

class _OpenShiftDialogState extends ConsumerState<_OpenShiftDialog> {
  String _amount = '';
  bool _pending = false;
  // A retry on café Wi-Fi must not become a second command
  final String _requestId = const Uuid().v4();

  double? get _value => _amount.isEmpty ? null : double.tryParse(_amount);

  Future<void> _open() async {
    final amount = _value;
    if (amount == null || amount < 0 || _pending) return;
    final l10n = AppLocalizations.of(context)!;
    setState(() => _pending = true);
    try {
      await ref.read(shiftsRepositoryProvider).openShift(amount, requestId: _requestId);
      ref.read(currentShiftProvider.notifier).refresh();
      // Opening the shift turned the branch's taking-orders / reservations
      // flags on (through Tenant.API)
      ref.read(branchProvider.notifier).refresh();
      if (!mounted) return;
      showPosToast(context, PosToastType.success, l10n.shiftOpened);
      Navigator.of(context, rootNavigator: true).pop(true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _pending = false);
      showPosToast(context, PosToastType.error, describeError(e, l10n));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final canOpen = _value != null && _value! >= 0 && !_pending;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.openShiftTitle, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 16),
          AmountEntry(label: l10n.openingFloat, value: _amount, onChange: (v) => setState(() => _amount = v)),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              SizedBox(
                height: 48,
                child: FButton(
                  variant: FButtonVariant.outline,
                  mainAxisSize: MainAxisSize.min,
                  onPress: _pending ? null : () => Navigator.of(context, rootNavigator: true).pop(false),
                  child: Text(l10n.cancel, style: theme.typography.base.forButton),
                ),
              ),
              const SizedBox(width: 8),
              SizedBox(
                height: 48,
                child: FButton(
                  mainAxisSize: MainAxisSize.min,
                  onPress: canOpen ? _open : null,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: Text(l10n.openShiftAction, style: theme.typography.base.forButton),
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
