import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import '../../features/deliveries/providers/deliveries_provider.dart';
import '../../l10n/app_localizations.dart';
import '../theme/app_theme.dart';
import 'branch_switcher.dart';

/// The one row of chrome: the branch on the start side, and on the end the
/// rider's own switch (on duty, so the till can give them deliveries) and
/// the settings. Every target is a thumb's size: this is used on a bike.
class RiderHeader extends ConsumerWidget {
  const RiderHeader({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final onDuty = ref.watch(dutyProvider);
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
          // The whole pill flips it: a dot and a word, green while working
          Semantics(
            toggled: onDuty,
            button: true,
            child: GestureDetector(
              behavior: HitTestBehavior.opaque,
              onTap: () => ref.read(dutyProvider.notifier).set(!onDuty),
              child: Container(
                height: 44,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  color: onDuty ? green.withValues(alpha: 0.15) : theme.colors.muted,
                  borderRadius: BorderRadius.circular(22),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
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
                    FSwitch(value: onDuty, onChange: (v) => ref.read(dutyProvider.notifier).set(v)),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(width: 4),
          SizedBox.square(
            dimension: 48,
            child: FButton.icon(
              variant: FButtonVariant.ghost,
              onPress: () => context.go('/settings'),
              child: const Icon(FIcons.settings, size: 22),
            ),
          ),
        ],
      ),
    );
  }
}
