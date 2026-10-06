import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../l10n/app_localizations.dart';
import 'package:ninja_app_core/brand/brand_provider.dart';
import '../brand/brand_mark.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';

/// Header branch switcher, same contract as pos_web's: the business's mark and
/// name with the active branch under them, and a menu of branches. Picking a branch scopes every branch-aware API call via the
/// X-Branch-Id header, so everything on screen refetches. Only the branches
/// the token allows are listed; with a single one there is nothing to switch
/// and the block is plain.
class BranchSwitcher extends ConsumerWidget {
  const BranchSwitcher({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final branchState = ref.watch(branchProvider);

    final active = branchState.selectedBranch;
    final branchLabel = active?.name.localized(context) ?? l10n.branches;
    final business = ref.watch(brandProvider).displayName(Localizations.localeOf(context));
    final switchable = branchState.branches.length > 1;

    Widget brand({required bool withChevron}) => Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const BrandMark(size: 36),
            const SizedBox(width: 10),
            // Takes what the header leaves it and cuts a long name short with
            // an ellipsis, rather than pushing past the edge
            Flexible(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // The bar is the switcher's alone: room for the two lines with Arabic's taller letters
                  Text(
                    business.isEmpty ? branchLabel : business,
                    maxLines: 1,
                    softWrap: false,
                    overflow: TextOverflow.ellipsis,
                    style: theme.typography.sm.copyWith(
                      fontWeight: FontWeight.w600,
                      height: 1.3,
                      color: theme.colors.foreground,
                    ),
                  ),
                  // One branch: the business is the place, and its branch says nothing more
                  if (business.isNotEmpty && switchable)
                    Text(
                      branchLabel,
                      maxLines: 1,
                      softWrap: false,
                      overflow: TextOverflow.ellipsis,
                      style: theme.typography.xs.copyWith(
                        color: theme.colors.mutedForeground,
                        height: 1.3,
                      ),
                    ),
                ],
              ),
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
      // A plain tappable rather than a button: the button's own vertical
      // padding left two lines of text less than the 48 dp they need
      builder: (context, controller, _) => FTappable(
        onPress: controller.toggle,
        child: SizedBox(
          height: 48,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12),
            child: brand(withChevron: true),
          ),
        ),
      ),
    );
  }
}
