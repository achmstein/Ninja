import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:uuid/uuid.dart';
import '../../../core/models/money.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/printing/print_service.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../models/shift.dart';
import '../providers/shifts_provider.dart';
import '../services/shifts_service.dart';
import '../widgets/amount_entry.dart';
import '../widgets/shift_report.dart';

/// Count the drawer and close the shift. The count comes off the keypad (a
/// count of exactly 0 is a valid — if sad — answer, so the cashier must
/// type something before confirming). On success the dialog flips to the
/// frozen Z report from the server: the over/short verdict, the tender
/// split, and every movement — printed on the 80 mm roll when a printer is
/// set up. Resolves to the Z once closed.
Future<ShiftView?> showCloseShiftDialog(BuildContext context, ShiftView shift) {
  return showFDialog<ShiftView>(
    context: context,
    useRootNavigator: true,
    builder: (context, style, animation) => FDialog.raw(
      style: style,
      animation: animation,
      constraints: const BoxConstraints(maxWidth: 512),
      builder: (context, _) => _CloseShiftDialog(shift: shift),
    ),
  );
}

class _CloseShiftDialog extends ConsumerStatefulWidget {
  final ShiftView shift;
  const _CloseShiftDialog({required this.shift});

  @override
  ConsumerState<_CloseShiftDialog> createState() => _CloseShiftDialogState();
}

class _CloseShiftDialogState extends ConsumerState<_CloseShiftDialog> {
  String _amount = '';
  bool _pending = false;
  ShiftView? _result;
  final String _requestId = const Uuid().v4();

  double? get _value => _amount.isEmpty ? null : double.tryParse(_amount);

  Future<void> _close() async {
    final amount = _value;
    if (amount == null || amount < 0 || _pending) return;
    final l10n = AppLocalizations.of(context)!;
    setState(() => _pending = true);
    try {
      final z = await ref.read(shiftsRepositoryProvider).closeShift(widget.shift.id, amount, requestId: _requestId);
      ref.read(currentShiftProvider.notifier).refresh();
      ref.invalidate(closedShiftsProvider);
      // Closing the shift turned the branch's flags off (through Tenant.API)
      ref.read(branchProvider.notifier).refresh();
      if (!mounted) return;
      setState(() => _result = z);
      showPosToast(context, PosToastType.success, l10n.shiftClosed);
      // The Z comes out by itself, like a receipt; a till with no printer stays quiet
      if (ref.read(printServiceProvider).isConfigured) _print(z, auto: true);
    } catch (e) {
      if (!mounted) return;
      setState(() => _pending = false);
      showPosToast(context, PosToastType.error, describeError(e, l10n));
    }
  }

  Future<void> _print(ShiftView shift, {bool auto = false}) async {
    final l10n = AppLocalizations.of(context)!;
    try {
      await ref.read(printServiceProvider).printShiftReport(shift, l10n: l10n, locale: Localizations.localeOf(context));
      if (mounted && !auto) showPosToast(context, PosToastType.success, l10n.printed);
    } catch (e) {
      if (mounted) showPosToast(context, PosToastType.error, describePrintError(e, l10n));
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final result = _result;

    // ----- Z report view (after closing) -----
    if (result != null) {
      return ConstrainedBox(
        constraints: BoxConstraints(maxHeight: MediaQuery.sizeOf(context).height * 0.95),
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(l10n.shiftClosed, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
              const SizedBox(height: 16),
              ShiftReport(shift: result),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: SizedBox(
                      height: 56,
                      child: FButton(
                        variant: FButtonVariant.outline,
                        onPress: () => Navigator.of(context, rootNavigator: true).pop(result),
                        child: Text(l10n.done, style: theme.typography.base.forButton),
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: SizedBox(
                      height: 56,
                      child: FButton(
                        onPress: () => _print(result),
                        prefix: const Icon(FIcons.printer, size: 20),
                        child: Text(l10n.print, style: theme.typography.base.forButton),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      );
    }

    // ----- count entry view -----
    final canClose = _value != null && _value! >= 0 && !_pending;
    return SingleChildScrollView(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.closeShiftTitle, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
            decoration: BoxDecoration(color: theme.colors.secondary, borderRadius: BorderRadius.circular(10)),
            child: Row(
              children: [
                Text(l10n.expectedInDrawer, style: theme.typography.sm.copyWith(color: theme.colors.mutedForeground)),
                const Spacer(),
                Text(money(context, widget.shift.expectedInDrawer),
                    style: theme.typography.lg.copyWith(fontWeight: FontWeight.w700, fontFeatures: const [FontFeature.tabularFigures()])),
              ],
            ),
          ),
          const SizedBox(height: 16),
          AmountEntry(label: l10n.countedAmount, value: _amount, onChange: (v) => setState(() => _amount = v)),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 48,
                  child: FButton(
                    variant: FButtonVariant.outline,
                    onPress: _pending ? null : () => Navigator.of(context, rootNavigator: true).pop(),
                    child: Text(l10n.cancel, style: theme.typography.base.forButton),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: SizedBox(
                  height: 48,
                  child: FButton(
                    variant: FButtonVariant.destructive,
                    onPress: canClose ? _close : null,
                    child: Text(l10n.confirmCloseShift, style: theme.typography.base.forButton),
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
