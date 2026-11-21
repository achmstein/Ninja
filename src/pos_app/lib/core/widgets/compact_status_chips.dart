import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import '../../features/shifts/dialogs/open_shift_dialog.dart';
import '../../features/shifts/providers/shifts_provider.dart';
import '../../features/shifts/widgets/trading_chip.dart';
import '../../l10n/app_localizations.dart';
import '../models/dates.dart';
import 'compact_chip.dart';

/// The shift chip on a phone: its dot alone, green while a shift is open and
/// grey when none is. It says and does what [ShiftChip] does, to the shift
/// screen or the open-shift dialog; the header picks between the two by width.
class CompactShiftChip extends ConsumerWidget {
  const CompactShiftChip({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final l10n = AppLocalizations.of(context)!;
    final async = ref.watch(currentShiftProvider);
    if (!async.hasValue) return const SizedBox.shrink();
    final shift = async.value;
    final openedAt = shift?.openedAt;

    return CompactChip(
      label: shift == null
          ? l10n.noShiftChip
          : '${l10n.shiftTitle} ${openedAt == null ? '' : formatTime(context, openedAt)}'.trim(),
      icon: Container(
        width: 12,
        height: 12,
        decoration: BoxDecoration(
          color: shift == null ? AppColors.gray400 : AppColors.emerald500,
          shape: BoxShape.circle,
        ),
      ),
      onPress: () async {
        if (shift != null) {
          context.go('/shift');
        } else if (await showOpenShiftDialog(context) && context.mounted) {
          context.go('/shift');
        }
      },
    );
  }
}

/// The trading chip on a phone: the shop and its dot, green while customers
/// can order and reserve and amber when either is stopped. It says what
/// [TradingChip] says and opens the same two switches.
class CompactTradingChip extends ConsumerWidget {
  const CompactTradingChip({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final flags = ref.watch(branchFlagsProvider);
    // Nothing to say until the branch is known
    if (!flags.known) return const SizedBox.shrink();

    final ordersOff = !flags.takingOrders;
    final reservationsOff = flags.reservations && !flags.takingReservations;
    return CompactChip(
      label: ordersOff && reservationsOff
          ? l10n.paused
          : ordersOff
              ? l10n.ordersPaused
              : reservationsOff
                  ? l10n.reservationsPaused
                  : l10n.openToCustomers,
      icon: Stack(
        clipBehavior: Clip.none,
        children: [
          const Icon(FIcons.store, size: Sizes.icon),
          PositionedDirectional(
            top: -3,
            end: -3,
            child: Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(
                color: flags.paused ? AppColors.amber500 : AppColors.emerald500,
                shape: BoxShape.circle,
                border: Border.all(color: theme.colors.background, width: 2),
              ),
            ),
          ),
        ],
      ),
      onPress: () => showTradingDialog(context),
    );
  }
}
