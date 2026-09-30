import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../ui/ui.dart';
import '../models/branch.dart';
import '../models/localized_text.dart';
import '../providers/branch_provider.dart';
import '../../features/places/models/place.dart';
import '../../features/places/services/place_service.dart';
import '../../l10n/app_localizations.dart';
import 'app_text.dart';

/// Thin bar that shows the branch switcher chip, hidden when only one branch
class BranchSwitcherBar extends ConsumerWidget {
  const BranchSwitcherBar({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final branchState = ref.watch(branchProvider);
    if (branchState.branches.length <= 1) return const SizedBox.shrink();

    return Padding(
      padding: const EdgeInsets.only(top: 4, bottom: 4),
      child: const BranchSwitcher(),
    );
  }
}

/// Compact branch switcher chip for use in app bars
class BranchSwitcher extends ConsumerWidget {
  const BranchSwitcher({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final branchState = ref.watch(branchProvider);
    final theme = context.theme;

    if (branchState.branches.length <= 1) {
      return const SizedBox.shrink();
    }

    final selectedBranch = branchState.selectedBranch;
    if (selectedBranch == null) return const SizedBox.shrink();

    // A chip in the top bar's end corner: where the customer is ordering from
    return Pressable(
      onTap: () => _showBranchPicker(context, ref, branchState.branches, selectedBranch),
      child: Container(
        height: 36,
        padding: const EdgeInsetsDirectional.only(start: 10, end: 8),
        decoration: ShapeDecoration(color: theme.colors.muted, shape: const StadiumBorder()),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(LucideIcons.mapPin, size: 14, color: theme.colors.foreground),
            const SizedBox(width: 4),
            ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 120),
              child: AppText(
                selectedBranch.name.localized(context),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.typography.caption.copyWith(color: theme.colors.foreground, fontWeight: FontWeight.w600),
              ),
            ),
            const SizedBox(width: 2),
            Icon(LucideIcons.chevronDown, size: 16, color: theme.colors.mutedForeground),
          ],
        ),
      ),
    );
  }

  void _showBranchPicker(BuildContext context, WidgetRef ref, List<Branch> branches, Branch current) {
    // Check for active session
    final sessions = ref.read(myStaysProvider);
    final hasActiveSession = sessions.value?.any((s) => s.status == StayStatus.active) ?? false;

    if (hasActiveSession) {
      final l10n = AppLocalizations.of(context)!;
      showIsland(
        context: context,
        title: Text(l10n.cannotSwitchBranchDuringSession),
        icon: Icon(LucideIcons.circleX, color: context.theme.colors.destructive),
      );
      return;
    }

    showNinjaSheet(
      context: context,
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
      builder: (ctx) => TileGroup(
        children: [
          for (final branch in branches)
            NinjaTile(
              icon: LucideIcons.mapPin,
              title: AppText(branch.name.localized(context)),
              trailing: branch.id == current.id ? Icon(LucideIcons.check, size: 18, color: ctx.theme.colors.foreground) : const SizedBox.shrink(),
              onPress: () {
                Navigator.pop(ctx);
                if (branch.id != current.id) ref.read(branchProvider.notifier).selectBranch(branch.id);
              },
            ),
        ],
      ),
    );
  }
}
