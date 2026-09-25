import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../../core/models/dates.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/text_styles.dart';
import '../../../l10n/app_localizations.dart';
import '../dialogs/open_shift_dialog.dart';
import '../models/shift.dart';
import '../providers/shifts_provider.dart';

/// Header status chip: one plain outline button that reads the day — a
/// status dot plus the shift's open time, muted "No shift" when none, and
/// an amber "Paused" when the store has stopped taking orders or
/// reservations mid-shift. Tap → straight to the shift screen (its X
/// report, drawer movements, the pause switches and the close), or the
/// open-shift dialog when none is open. Quiet while the first answer is
/// still loading. The dot does the signalling so the chip keeps the same
/// surface, border and foreground as every other control in the chrome.
class ShiftChip extends ConsumerWidget {
  const ShiftChip({super.key});

  Future<void> _open(BuildContext context, ShiftView? shift) async {
    if (shift != null) {
      context.go('/shift');
    } else if (await showOpenShiftDialog(context) && context.mounted) {
      context.go('/shift');
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final async = ref.watch(currentShiftProvider);
    if (!async.hasValue) return const SizedBox.shrink();
    final shift = async.value;
    final paused = shift != null && ref.watch(branchFlagsProvider).paused;
    final openedAt = shift?.openedAt;

    return SizedBox(
      height: 40,
      child: FButton(
        variant: FButtonVariant.outline,
        mainAxisSize: MainAxisSize.min,
        onPress: () => _open(context, shift),
        prefix: Container(
          width: 8,
          height: 8,
          decoration: BoxDecoration(
            color: shift == null
                ? AppColors.gray400
                : paused
                    ? AppColors.amber500
                    : AppColors.emerald500,
            shape: BoxShape.circle,
          ),
        ),
        suffix: paused
            ? Text(l10n.paused,
                style: theme.typography.xs.forButton.copyWith(color: AppColors.amber(theme.colors.brightness)))
            : null,
        child: Text(
          shift == null
              ? l10n.noShiftChip
              : '${l10n.shiftTitle} ${openedAt == null ? '' : formatTime(context, openedAt)}',
          style: theme.typography.sm.forButton.copyWith(fontFeatures: const [FontFeature.tabularFigures()]),
        ),
      ),
    );
  }
}
