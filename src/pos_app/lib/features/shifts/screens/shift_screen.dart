import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:shimmer/shimmer.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/text_styles.dart';
import '../../../l10n/app_localizations.dart';
import '../dialogs/close_shift_dialog.dart';
import '../dialogs/movement_dialog.dart';
import '../dialogs/open_shift_dialog.dart';
import '../models/shift.dart';
import '../providers/shifts_provider.dart';
import '../widgets/shift_report.dart';

const _maxWidth = 768.0;
const _actionBarHeight = 80.0;

/// The live X report of the branch's open shift: what the drawer should
/// hold right now and how it got there. Actions live in a sticky bottom
/// bar: pay in / pay out, and closing the shift (destructive — it freezes
/// the Z). With no shift open, this is the place to open one.
class ShiftScreen extends ConsumerWidget {
  const ShiftScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final async = ref.watch(currentShiftProvider);

    if (!async.hasValue) return const _Skeleton();
    final shift = async.value;

    if (shift == null) {
      return Padding(
        padding: const EdgeInsets.symmetric(vertical: 96),
        child: Column(
          children: [
            Icon(FIcons.banknote, size: 48, color: theme.colors.mutedForeground),
            const SizedBox(height: 16),
            Text(l10n.noShiftOpen, style: theme.typography.lg.copyWith(fontWeight: FontWeight.w500)),
            const SizedBox(height: 16),
            SizedBox(
              height: 56,
              child: FButton(
                mainAxisSize: MainAxisSize.min,
                onPress: () => showOpenShiftDialog(context),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Text(l10n.openShiftAction, style: theme.typography.lg.forButton),
                ),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: 48,
              child: FButton(
                variant: FButtonVariant.outline,
                mainAxisSize: MainAxisSize.min,
                onPress: () => context.go('/shifts'),
                prefix: const Icon(FIcons.history, size: 20),
                child: Text(l10n.shiftHistory, style: theme.typography.base.forButton),
              ),
            ),
          ],
        ),
      );
    }

    return Stack(
      children: [
        Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: _maxWidth),
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, _actionBarHeight + 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      SizedBox.square(
                        dimension: 48,
                        child: FButton.icon(
                          variant: FButtonVariant.ghost,
                          onPress: () => context.go('/'),
                          child: Icon(FIcons.arrowLeft, size: 24),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(l10n.shiftNumber(shift.id),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.typography.xl.copyWith(fontWeight: FontWeight.w700)),
                      ),
                      const SizedBox(width: 8),
                      const ShiftStatusPill(open: true),
                      const SizedBox(width: 8),
                      SizedBox(
                        height: 48,
                        child: FButton(
                          variant: FButtonVariant.outline,
                          mainAxisSize: MainAxisSize.min,
                          onPress: () => context.go('/shifts'),
                          prefix: const Icon(FIcons.history, size: 20),
                          child: Text(l10n.shiftHistory, style: theme.typography.base.forButton),
                        ),
                      ),
                    ],
                  ),
                  const FDivider(),
                  ShiftReport(shift: shift),
                ],
              ),
            ),
          ),
        ),
        // Sticky action bar: drawer movements + the shift close
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: Container(
            height: _actionBarHeight,
            padding: const EdgeInsets.symmetric(horizontal: 12),
            decoration: BoxDecoration(
              color: theme.colors.background.withValues(alpha: 0.95),
              border: Border(top: BorderSide(color: theme.colors.border)),
            ),
            child: Center(
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: _maxWidth - 32),
                child: Row(
                  children: [
                    Expanded(
                      child: SizedBox(
                        height: 56,
                        child: FButton(
                          variant: FButtonVariant.outline,
                          onPress: () => showMovementDialog(context, shift.id, CashMovementType.payIn),
                          prefix: const Icon(FIcons.arrowDownToLine, size: 20),
                          child: Text(l10n.payIn, style: theme.typography.base.forButton),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: SizedBox(
                        height: 56,
                        child: FButton(
                          variant: FButtonVariant.outline,
                          onPress: () => showMovementDialog(context, shift.id, CashMovementType.payOut),
                          prefix: const Icon(FIcons.arrowUpFromLine, size: 20),
                          child: Text(l10n.payOut, style: theme.typography.base.forButton),
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: SizedBox(
                        height: 56,
                        child: FButton(
                          variant: FButtonVariant.destructive,
                          onPress: () => showCloseShiftDialog(context, shift),
                          prefix: const Icon(FIcons.lock, size: 20),
                          child: Text(l10n.closeShiftAction, style: theme.typography.base.forButton),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

/// "Open" in emerald, "Closed" in the secondary tint — the shift's state
/// beside its number
class ShiftStatusPill extends StatelessWidget {
  final bool open;
  const ShiftStatusPill({super.key, required this.open});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    return Container(
      height: 32,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      alignment: Alignment.center,
      decoration: BoxDecoration(
        color: open ? AppColors.emerald500.withValues(alpha: 0.15) : theme.colors.secondary,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        open ? l10n.shiftOpenBadge : l10n.shiftClosedBadge,
        style: theme.typography.sm.copyWith(
          fontWeight: FontWeight.w500,
          color: open ? AppColors.emerald(theme.colors.brightness) : theme.colors.secondaryForeground,
        ),
      ),
    );
  }
}

class _Skeleton extends StatelessWidget {
  const _Skeleton();

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    Widget box(double height, {double? width}) => Container(
          width: width,
          height: height,
          decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(12)),
        );
    return Align(
      alignment: Alignment.topCenter,
      child: ConstrainedBox(
        constraints: const BoxConstraints(maxWidth: _maxWidth),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Shimmer.fromColors(
            baseColor: theme.colors.muted,
            highlightColor: theme.colors.background,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [box(48, width: 256), const SizedBox(height: 12), box(128), const SizedBox(height: 12), box(256)],
            ),
          ),
        ),
      ),
    );
  }
}
