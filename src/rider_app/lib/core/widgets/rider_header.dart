import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../features/deliveries/providers/deliveries_provider.dart';
import '../../l10n/app_localizations.dart';
import '../network/api_errors.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:ninja_app_core/widgets/confirm_dialog.dart';
import 'branch_switcher.dart';
import 'rider_toast.dart';

/// The one row of chrome: the branch on the start side, and on the end the
/// rider's own switch (on duty, so the till can give them deliveries) and
/// the settings. Every target is a thumb's size: this is used on a bike.
class RiderHeader extends ConsumerWidget {
  const RiderHeader({super.key});

  /// Flips duty; when the till does not hear it the switch goes back and the rider is told
  static Future<void> _toggle(BuildContext context, WidgetRef ref, bool onDuty) async {
    final l10n = AppLocalizations.of(context)!;
    try {
      await ref.read(dutyProvider.notifier).set(onDuty);
    } catch (e) {
      if (context.mounted) showRiderToast(context, RiderToastType.error, l10n.dutyNotChanged, description: describeError(e, l10n));
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final duty = ref.watch(dutyProvider);
    final onDuty = duty.onDuty;
    final green = AppColors.emerald(theme.colors.brightness);

    return Container(
      height: 64,
      padding: const EdgeInsets.symmetric(horizontal: 8),
      decoration: BoxDecoration(
        color: theme.colors.background,
        border: Border(bottom: BorderSide(color: theme.colors.border)),
      ),
      child: Row(
        children: [
          const Flexible(child: BranchSwitcher()),
          const SizedBox(width: 8),
          _DutyControl(
            onDuty: onDuty,
            pending: duty.pending,
            green: green,
            onGoOn: () => _toggle(context, ref, true),
            onGoOff: () async {
              // Going off takes the rider out of the till's list: asked once,
              // so a stray tap on the road does not
              final yes = await showConfirmDialog(
                context,
                title: l10n.goOffDutyConfirm,
                description: l10n.goOffDutyHint,
                cancelLabel: l10n.stayOnDuty,
                actionLabel: l10n.goOffDuty,
              );
              if (yes && context.mounted) await _toggle(context, ref, false);
            },
          ),
          const SizedBox(width: 4),
          SizedBox.square(
            dimension: 48,
            child: Semantics(
              label: l10n.settings,
              button: true,
              child: FButton.icon(
                variant: FButtonVariant.ghost,
                onPress: () => context.go('/settings'),
                child: const Icon(FIcons.settings, size: 22),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// The rider's one control, one thing a state: off duty, a solid "Go on duty"
/// button, the obvious thing to press; on duty, a calm green status that
/// asks before going off; while the till has not answered, a spinner where
/// the icon was. 48 dp high, as everything here is used on a bike.
class _DutyControl extends StatelessWidget {
  final bool onDuty;
  final bool pending;
  final Color green;
  final VoidCallback onGoOn;
  final VoidCallback onGoOff;

  const _DutyControl({
    required this.onDuty,
    required this.pending,
    required this.green,
    required this.onGoOn,
    required this.onGoOff,
  });

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    const spinner = SizedBox.square(dimension: 16, child: FCircularProgress());

    if (!onDuty) {
      return SizedBox(
        height: 48,
        child: FButton(
          mainAxisSize: MainAxisSize.min,
          onPress: pending ? null : onGoOn,
          prefix: pending ? spinner : const Icon(FIcons.power, size: 18),
          child: Text(l10n.goOnDuty, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w600)),
        ),
      );
    }

    return Semantics(
      button: true,
      toggled: true,
      label: '${l10n.onDuty}. ${l10n.goOffDuty}',
      excludeSemantics: true,
      child: FTappable(
        onPress: pending ? null : onGoOff,
        child: Container(
          height: 48,
          padding: const EdgeInsetsDirectional.symmetric(horizontal: 14),
          decoration: BoxDecoration(
            color: green.withValues(alpha: 0.12),
            border: Border.all(color: green.withValues(alpha: 0.45)),
            borderRadius: BorderRadius.circular(24),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              if (pending)
                spinner
              else
                Container(
                  width: 10,
                  height: 10,
                  decoration: BoxDecoration(shape: BoxShape.circle, color: green),
                ),
              const SizedBox(width: 8),
              Text(l10n.onDuty, style: theme.typography.sm.copyWith(fontWeight: FontWeight.w600, color: green)),
            ],
          ),
        ),
      ),
    );
  }
}
