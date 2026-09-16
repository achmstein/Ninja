import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/models/dates.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/text_styles.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../models/shift.dart';
import '../providers/shifts_provider.dart';

/// What the cashier picked in the panel; the caller carries it out once
/// the panel has stepped aside
enum ShiftPanelAction { openShift, closeShift, details }

/// Everything that says whether the store is trading, behind the one header
/// chip: the drawer shift (open or close it, or go to its X report) and the
/// two customer-facing switches — taking orders, taking reservations — for
/// a mid-day pause. The shift flips both switches on its own (open → on,
/// close → off); the switches are for in between.
Future<ShiftPanelAction?> showShiftPanel(BuildContext context, ShiftView? shift) {
  return showFDialog<ShiftPanelAction>(
    context: context,
    useRootNavigator: true,
    builder: (context, style, animation) => FDialog.raw(
      style: style,
      animation: animation,
      constraints: const BoxConstraints(maxWidth: 448),
      builder: (context, _) => _ShiftPanel(shift: shift),
    ),
  );
}

class _ShiftPanel extends ConsumerStatefulWidget {
  final ShiftView? shift;
  const _ShiftPanel({required this.shift});

  @override
  ConsumerState<_ShiftPanel> createState() => _ShiftPanelState();
}

class _ShiftPanelState extends ConsumerState<_ShiftPanel> {
  bool _pending = false;

  Future<void> _setFlag(String key, bool on) async {
    final branchId = ref.read(branchFlagsProvider).branchId;
    if (branchId == null || _pending) return;
    setState(() => _pending = true);
    final ok = await ref.read(branchProvider.notifier).updateBranchSettings(branchId, {key: on});
    if (!mounted) return;
    setState(() => _pending = false);
    if (!ok) showPosToast(context, PosToastType.error, AppLocalizations.of(context)!.somethingWentWrong);
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final shift = widget.shift;
    final flags = ref.watch(branchFlagsProvider);
    final switchesDisabled = !flags.known || _pending;
    final openedAt = shift?.openedAt;

    void pick(ShiftPanelAction action) => Navigator.of(context, rootNavigator: true).pop(action);

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(l10n.shiftTitle, style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
          const SizedBox(height: 4),
          Text(
            shift != null && openedAt != null ? '${l10n.openedAt} ${formatTime(context, openedAt)}' : l10n.noShiftOpen,
            style: theme.typography.base.copyWith(color: theme.colors.mutedForeground),
          ),
          const SizedBox(height: 20),
          Container(
            decoration: BoxDecoration(border: Border.all(color: theme.colors.border), borderRadius: BorderRadius.circular(10)),
            child: Column(
              children: [
                _FlagRow(
                  label: l10n.takingOrders,
                  on: flags.takingOrders,
                  disabled: switchesDisabled,
                  onChange: (on) => _setFlag('isOrderingEnabled', on),
                ),
                Container(height: 1, color: theme.colors.border),
                _FlagRow(
                  label: l10n.takingReservations,
                  on: flags.takingReservations,
                  disabled: switchesDisabled,
                  onChange: (on) => _setFlag('isReservationsEnabled', on),
                ),
              ],
            ),
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              if (shift != null) ...[
                SizedBox(
                  height: 48,
                  child: FButton(
                    variant: FButtonVariant.outline,
                    mainAxisSize: MainAxisSize.min,
                    onPress: () => pick(ShiftPanelAction.details),
                    child: Text(l10n.shiftDetails, style: theme.typography.base.forButton),
                  ),
                ),
                const SizedBox(width: 8),
                SizedBox(
                  height: 48,
                  child: FButton(
                    variant: FButtonVariant.destructive,
                    mainAxisSize: MainAxisSize.min,
                    onPress: () => pick(ShiftPanelAction.closeShift),
                    child: Text(l10n.closeShiftAction, style: theme.typography.base.forButton),
                  ),
                ),
              ] else
                SizedBox(
                  height: 48,
                  child: FButton(
                    mainAxisSize: MainAxisSize.min,
                    onPress: () => pick(ShiftPanelAction.openShift),
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

class _FlagRow extends StatelessWidget {
  final String label;
  final bool on;
  final bool disabled;
  final ValueChanged<bool> onChange;

  const _FlagRow({required this.label, required this.on, required this.disabled, required this.onChange});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    return FTappable(
      onPress: disabled ? null : () => onChange(!on),
      child: Container(
        constraints: const BoxConstraints(minHeight: 56),
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        child: Row(
          children: [
            Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(color: on ? AppColors.emerald500 : AppColors.amber500, shape: BoxShape.circle),
            ),
            const SizedBox(width: 8),
            Text(label, style: theme.typography.base.copyWith(fontWeight: FontWeight.w500)),
            if (!on) ...[
              const SizedBox(width: 8),
              Text(l10n.paused, style: theme.typography.xs.copyWith(color: theme.colors.mutedForeground)),
            ],
            const Spacer(),
            FSwitch(value: on, enabled: !disabled, onChange: onChange),
          ],
        ),
      ),
    );
  }
}
