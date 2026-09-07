import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../l10n/app_localizations.dart';
import '../models/localized_text.dart';
import '../providers/branch_provider.dart';
import '../theme/app_theme.dart';

/// Header branch switcher, same contract as pos_web's: the brand mark with
/// the branch under it, and a menu of branches. Picking a branch scopes
/// every branch-aware API call via the X-Branch-Id header, so everything
/// on screen refetches. Only the branches the token allows are listed;
/// with a single one there is nothing to switch and the block is plain.
class BranchSwitcher extends ConsumerWidget {
  const BranchSwitcher({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final branchState = ref.watch(branchProvider);
    final isDark = ref.watch(themeProvider).resolveBrightness(context) == Brightness.dark;

    final active = branchState.selectedBranch;
    final branchLabel = active?.name.localized(context) ?? l10n.branches;
    final switchable = branchState.branches.length > 1;

    Widget brand({required bool withChevron}) => Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            // Black-on-transparent mark; invert on dark backgrounds
            ColorFiltered(
              colorFilter: isDark
                  ? const ColorFilter.matrix(<double>[
                      -1, 0, 0, 0, 255,
                      0, -1, 0, 0, 255,
                      0, 0, -1, 0, 255,
                      0, 0, 0, 1, 0,
                    ])
                  : const ColorFilter.mode(Colors.transparent, BlendMode.dst),
              child: Image.asset('assets/images/cup.png', width: 32, height: 32, fit: BoxFit.contain),
            ),
            const SizedBox(width: 8),
            Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Tight leading: two lines have to fit the 48 dp button
                // beside the button's own vertical padding (pos_web's
                // `leading-tight`)
                Text(
                  l10n.brandName,
                  style: theme.typography.sm.copyWith(
                    fontWeight: FontWeight.w600,
                    height: 1.0,
                    color: theme.colors.foreground,
                  ),
                ),
                Text(
                  branchLabel,
                  style: theme.typography.xs.copyWith(
                    color: theme.colors.mutedForeground,
                    height: 1.0,
                  ),
                ),
              ],
            ),
            if (withChevron) ...[
              const SizedBox(width: 8),
              Icon(FIcons.chevronsUpDown, size: 16, color: theme.colors.mutedForeground),
            ],
          ],
        );

    if (!switchable) {
      return SizedBox(
        height: 48,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12),
          child: brand(withChevron: false),
        ),
      );
    }

    return FPopoverMenu(
      menuAnchor: AlignmentDirectional.topStart,
      childAnchor: AlignmentDirectional.bottomStart,
      menu: [
        FItemGroup(
          children: [
            for (final branch in branchState.branches)
              FItem(
                title: Text(branch.name.localized(context), style: theme.typography.base),
                suffix: branch.id == branchState.selectedBranchId
                    ? const Icon(FIcons.check, size: 20)
                    : null,
                onPress: () => ref.read(branchProvider.notifier).selectBranch(branch.id),
              ),
          ],
        ),
      ],
      builder: (context, controller, _) => SizedBox(
        height: 48,
        child: FButton(
          variant: FButtonVariant.ghost,
          mainAxisSize: MainAxisSize.min,
          onPress: controller.toggle,
          child: brand(withChevron: true),
        ),
      ),
    );
  }
}
