import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/pos_toast.dart';
import '../../../l10n/app_localizations.dart';
import '../providers/shifts_provider.dart';

/// The branch's two customer-facing switches — taking orders, taking
/// reservations — for a mid-day pause. The shift flips both on its own
/// (open → on, close → off); the switches are for in between, so they sit
/// on the shift screen the header chip leads to.
class TradingSwitches extends ConsumerStatefulWidget {
  const TradingSwitches({super.key});

  @override
  ConsumerState<TradingSwitches> createState() => _TradingSwitchesState();
}

class _TradingSwitchesState extends ConsumerState<TradingSwitches> {
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
    final flags = ref.watch(branchFlagsProvider);
    final disabled = !flags.known || _pending;

    return Container(
      decoration: BoxDecoration(
        color: theme.colors.background,
        border: Border.all(color: theme.colors.border),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          _FlagRow(
            label: l10n.takingOrders,
            on: flags.takingOrders,
            disabled: disabled,
            onChange: (on) => _setFlag('isOrderingEnabled', on),
          ),
          Container(height: 1, color: theme.colors.border),
          _FlagRow(
            label: l10n.takingReservations,
            on: flags.takingReservations,
            disabled: disabled,
            onChange: (on) => _setFlag('isReservationsEnabled', on),
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
