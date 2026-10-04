import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../features/deliveries/providers/deliveries_provider.dart';
import '../../l10n/app_localizations.dart';
import '../network/api_errors.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
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
          const Spacer(),
          // The whole pill flips it: a dot and a word, green while working;
          // while the till has not answered, it says so instead of the dot
          Semantics(
            toggled: onDuty,
            button: true,
            label: onDuty ? l10n.onDuty : l10n.offDuty,
            excludeSemantics: true,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: duty.pending ? null : () => _toggle(context, ref, !onDuty),
              child: Container(
                height: 48,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: onDuty ? green.withValues(alpha: 0.15) : theme.colors.muted,
                  borderRadius: BorderRadius.circular(24),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (duty.pending)
                      const SizedBox.square(dimension: 14, child: FCircularProgress())
                    else
                      Container(
                        width: 10,
                        height: 10,
                        decoration: BoxDecoration(shape: BoxShape.circle, color: onDuty ? green : theme.colors.mutedForeground),
                      ),
                    const SizedBox(width: 8),
                    Text(
                      onDuty ? l10n.onDuty : l10n.offDuty,
                      style: theme.typography.sm.copyWith(fontWeight: FontWeight.w600, color: onDuty ? green : theme.colors.mutedForeground),
                    ),
                    const SizedBox(width: 8),
                    FSwitch(value: onDuty, onChange: duty.pending ? null : (v) => _toggle(context, ref, v)),
                  ],
                ),
              ),
            ),
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
