import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:shimmer/shimmer.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import '../../../core/layout/breakpoints.dart';
import '../../../l10n/app_localizations.dart';
import '../dialogs/close_shift_dialog.dart';
import '../dialogs/movement_dialog.dart';
import '../dialogs/open_shift_dialog.dart';
import '../models/shift.dart';
import '../providers/shifts_provider.dart';
import '../widgets/shift_report.dart';
import '../../../core/theme/type_roles.dart';

const _maxWidth = 768.0;
const _actionBarHeight = 80.0;

/// A phone's bar is two rows of ordinary buttons, with the same 12 dp around them
const _actionBarHeightCompact = 12 + Sizes.control + Sizes.gapSm + Sizes.control + 12;

/// The live X report of the branch's open shift: what the drawer should
/// hold right now and how it got there — where the header chip lands. The
/// pause switches (taking orders / reservations) sit above the figures;
/// actions live in a sticky bottom bar: pay in / pay out, and closing the
/// shift (destructive — it freezes the Z). With no shift open, this is the
/// place to open one.
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
            Icon(FIcons.banknote, size: Sizes.iconHero, color: theme.colors.mutedForeground),
            const SizedBox(height: 16),
            Text(l10n.noShiftOpen, style: theme.type.body.copyWith(fontWeight: FontWeight.w500)),
            const SizedBox(height: 16),
            SizedBox(
              height: Sizes.controlLarge,
              child: FButton(
                mainAxisSize: MainAxisSize.min,
                onPress: () => showOpenShiftDialog(context),
                child: Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Text(l10n.openShiftAction, style: theme.type.mainAction),
                ),
              ),
            ),
            const SizedBox(height: 16),
            SizedBox(
              height: Sizes.control,
              child: FButton(
                variant: FButtonVariant.outline,
                mainAxisSize: MainAxisSize.min,
                onPress: () => context.go('/shifts'),
                prefix: const Icon(FIcons.history, size: Sizes.icon),
                child: Text(l10n.shiftHistory, style: theme.type.button),
              ),
            ),
          ],
        ),
      );
    }

    final compact = context.isCompact;

    return Stack(
      children: [
        Align(
          alignment: Alignment.topCenter,
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: _maxWidth),
            child: SingleChildScrollView(
              padding: EdgeInsets.fromLTRB(16, 16, 16, (compact ? _actionBarHeightCompact : _actionBarHeight) + 16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    children: [
                      SizedBox.square(
                        dimension: Sizes.control,
                        child: FButton.icon(
                          variant: FButtonVariant.ghost,
                          onPress: () => context.go('/'),
                          child: Icon(FIcons.arrowLeft, size: Sizes.iconNav),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(l10n.shiftNumber(shift.id),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: theme.type.title),
                      ),
                      const SizedBox(width: 8),
                      const ShiftStatusPill(open: true),
                      const SizedBox(width: 8),
                      // A phone keeps the shift's number whole and the history its icon
                      if (compact)
                        Tooltip(
                          message: l10n.shiftHistory,
                          child: SizedBox.square(
                            dimension: Sizes.control,
                            child: FButton.icon(
                              onPress: () => context.go('/shifts'),
                              child: const Icon(FIcons.history, size: Sizes.icon),
                            ),
                          ),
                        )
                      else
                        SizedBox(
                          height: Sizes.control,
                          child: FButton(
                            variant: FButtonVariant.outline,
                            mainAxisSize: MainAxisSize.min,
                            onPress: () => context.go('/shifts'),
                            prefix: const Icon(FIcons.history, size: Sizes.icon),
                            child: Text(l10n.shiftHistory, style: theme.type.button),
                          ),
                        ),
                    ],
                  ),
                  const FDivider(),
                  const SizedBox(height: 16),
                  ShiftReport(shift: shift),
                ],
              ),
            ),
          ),
        ),
        Positioned(
          left: 0,
          right: 0,
          bottom: 0,
          child: ShiftActionBar(
            onPayIn: () => showMovementDialog(context, shift.id, CashMovementType.payIn),
            onPayOut: () => showMovementDialog(context, shift.id, CashMovementType.payOut),
            onClose: () => showCloseShiftDialog(context, shift),
          ),
        ),
      ],
    );
  }
}

/// The sticky bar under the open shift: the drawer's movements and the
/// shift's close. Three across do not fit a phone, so there the close takes
/// a row of its own, as on pos_web.
class ShiftActionBar extends StatelessWidget {
  final VoidCallback onPayIn;
  final VoidCallback onPayOut;
  final VoidCallback onClose;

  const ShiftActionBar({super.key, required this.onPayIn, required this.onPayOut, required this.onClose});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final compact = context.isCompact;

    Widget action(String label, {required IconData icon, required FButtonVariant variant, required VoidCallback onPress}) =>
        SizedBox(
          height: compact ? Sizes.control : Sizes.controlLarge,
          child: FButton(
            variant: variant,
            onPress: onPress,
            prefix: Icon(icon, size: Sizes.icon),
            // Half a phone is a few pixels short of the Arabic for the drawer's
            // two movements: the words shrink to their button rather than run over
            child: Flexible(
              child: FittedBox(
                fit: BoxFit.scaleDown,
                child: Text(label, maxLines: 1, style: theme.type.button),
              ),
            ),
          ),
        );

    final payIn = action(l10n.payIn, icon: FIcons.arrowDownToLine, variant: FButtonVariant.outline, onPress: onPayIn);
    final payOut = action(l10n.payOut, icon: FIcons.arrowUpFromLine, variant: FButtonVariant.outline, onPress: onPayOut);
    final close = action(l10n.closeShiftAction, icon: FIcons.lock, variant: FButtonVariant.destructive, onPress: onClose);

    return Container(
      height: compact ? _actionBarHeightCompact : _actionBarHeight,
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: theme.colors.background.withValues(alpha: 0.95),
        border: Border(top: BorderSide(color: theme.colors.border)),
      ),
      child: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: _maxWidth - 32),
          child: compact
              ? Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(child: payIn),
                        const SizedBox(width: Sizes.gapSm),
                        Expanded(child: payOut),
                      ],
                    ),
                    const SizedBox(height: Sizes.gapSm),
                    close,
                  ],
                )
              : Row(
                  children: [
                    Expanded(child: payIn),
                    const SizedBox(width: 8),
                    Expanded(child: payOut),
                    const SizedBox(width: 8),
                    Expanded(child: close),
                  ],
                ),
        ),
      ),
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
        borderRadius: BorderRadius.circular(Sizes.radius),
      ),
      child: Text(
        open ? l10n.shiftOpenBadge : l10n.shiftClosedBadge,
        style: theme.type.detail.copyWith(
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
          decoration: BoxDecoration(color: theme.colors.muted, borderRadius: BorderRadius.circular(Sizes.radius)),
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
