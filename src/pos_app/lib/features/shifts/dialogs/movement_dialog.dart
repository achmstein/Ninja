import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:uuid/uuid.dart';
import '../../../core/network/api_errors.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../core/widgets/pos_dialog.dart';
import '../../../l10n/app_localizations.dart';
import '../models/shift.dart';
import '../providers/shifts_provider.dart';
import '../services/shifts_service.dart';
import '../widgets/amount_entry.dart';

/// Records cash put into or taken out of the drawer mid-shift (supplier
/// paid from the till, float topped up, ...). Amount comes off the keypad;
/// the reason is required — an unexplained drawer movement is exactly what
/// the Z report exists to catch. Resolves to true once recorded.
Future<bool> showMovementDialog(BuildContext context, int shiftId, CashMovementType type) async {
  final recorded = await showPosDialog<bool>(
    context,
    builder: (context) => _MovementDialog(shiftId: shiftId, type: type),
  );
  return recorded ?? false;
}

class _MovementDialog extends ConsumerStatefulWidget {
  final int shiftId;
  final CashMovementType type;
  const _MovementDialog({required this.shiftId, required this.type});

  @override
  ConsumerState<_MovementDialog> createState() => _MovementDialogState();
}

class _MovementDialogState extends ConsumerState<_MovementDialog> {
  String _amount = '';
  final _reason = TextEditingController();
  bool _pending = false;
  final String _requestId = const Uuid().v4();

  @override
  void initState() {
    super.initState();
    _reason.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _reason.dispose();
    super.dispose();
  }

  double get _value => double.tryParse(_amount.isEmpty ? '0' : _amount) ?? 0;
  bool get _canSubmit => _value > 0 && _reason.text.trim().isNotEmpty && !_pending;

  Future<void> _submit() async {
    if (!_canSubmit) return;
    final l10n = AppLocalizations.of(context)!;
    setState(() => _pending = true);
    try {
      await ref.read(shiftsRepositoryProvider).addMovement(
            widget.shiftId,
            CashMovementRequest(type: widget.type, amount: _value, reason: _reason.text.trim()),
            requestId: _requestId,
          );
      ref.read(currentShiftProvider.notifier).refresh();
      ref.invalidate(shiftProvider(widget.shiftId));
      if (!mounted) return;
      showPosToast(context, PosToastType.success, l10n.movementRecorded);
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
    final title = widget.type == CashMovementType.payOut ? l10n.payOut : l10n.payIn;
    return DialogScroll(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 16),
          AmountEntry(label: l10n.amount, value: _amount, onChange: (v) => setState(() => _amount = v)),
          const SizedBox(height: 16),
          FTextField(
            control: FTextFieldControl.managed(controller: _reason),
            label: Text(l10n.reason),
            maxLines: 1,
            textInputAction: TextInputAction.done,
            onSubmit: (_) => _submit(),
          ),
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
                  onPress: _canSubmit ? _submit : null,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    child: Text(title, style: theme.typography.base.forButton),
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
