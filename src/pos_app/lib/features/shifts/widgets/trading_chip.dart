import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:ninja_app_core/theme/text_styles.dart';
import '../../../l10n/app_localizations.dart';
import '../providers/shifts_provider.dart';
import 'trading_switches.dart';

/// Header button for the branch's two customer-facing switches: taking
/// orders, taking reservations. It says where the branch stands (a green dot
/// while customers can do both, amber and which one is stopped otherwise) and
/// opens the switches in a dialog, so a pause in the middle of a rush is two
/// taps from any screen instead of a trip into the shift's details. The shift
/// still flips both by itself: on when it opens, off when it closes.
class TradingChip extends ConsumerWidget {
  const TradingChip({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final flags = ref.watch(branchFlagsProvider);
    // Nothing to say until the branch is known
    if (!flags.known) return const SizedBox.shrink();

    final ordersOff = !flags.takingOrders;
    final reservationsOff = flags.reservations && !flags.takingReservations;
    final label = ordersOff && reservationsOff
        ? l10n.paused
        : ordersOff
            ? l10n.ordersPaused
            : reservationsOff
                ? l10n.reservationsPaused
                : l10n.openToCustomers;

    return ConstrainedBox(
      constraints: const BoxConstraints(minHeight: Sizes.controlSmall),
      child: FButton(
        variant: FButtonVariant.outline,
        mainAxisSize: MainAxisSize.min,
        onPress: () => showTradingDialog(context),
        prefix: Stack(
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
        child: Text(
          label,
          style: theme.typography.sm.forButton
              .copyWith(color: flags.paused ? AppColors.amber(theme.colors.brightness) : null),
        ),
      ),
    );
  }
}

/// The two switches, from anywhere in the till
Future<void> showTradingDialog(BuildContext context) => showFDialog<void>(
      context: context,
      useRootNavigator: true,
      builder: (context, style, animation) => FDialog.raw(
        style: style,
        animation: animation,
        constraints: const BoxConstraints(maxWidth: 448),
        builder: (context, _) => const _TradingDialog(),
      ),
    );

class _TradingDialog extends ConsumerWidget {
  const _TradingDialog();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final reservations = ref.watch(branchFlagsProvider).reservations;

    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              const Icon(FIcons.store, size: Sizes.icon),
              const SizedBox(width: 8),
              Expanded(
                child: Text(reservations ? l10n.ordersAndReservations : l10n.customerOrders,
                    style: theme.typography.xl.copyWith(fontWeight: FontWeight.w600)),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(l10n.tradingHint, style: theme.typography.base.copyWith(color: theme.colors.mutedForeground)),
          const SizedBox(height: 16),
          const TradingSwitches(),
          const SizedBox(height: 16),
          SizedBox(
            height: Sizes.control,
            child: FButton(
              variant: FButtonVariant.outline,
              onPress: () => Navigator.of(context, rootNavigator: true).pop(),
              child: Text(l10n.done, style: theme.typography.base.forButton),
            ),
          ),
        ],
      ),
    );
  }
}
