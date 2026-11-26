import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../l10n/app_localizations.dart';
import '../brand/brand_provider.dart';
import '../brand/brand_mark.dart';
import '../layout/breakpoints.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import '../../features/call_centre/call_centre_mode.dart';
import '../theme/type_roles.dart';

/// Header branch switcher, same contract as pos_web's: the business's mark and
/// name with the active branch under them, and a menu of branches. Picking a branch scopes every branch-aware API call via the
/// X-Branch-Id header, so everything on screen refetches. Only the branches
/// the token allows are listed; with a single one there is nothing to switch
/// and the block is plain. A till that may take the business's calls (a call
/// centre bought, every branch held) also lists Call centre: every sale then
/// starts from the caller, and the active branch is the one the order is for.
class BranchSwitcher extends ConsumerWidget {
  const BranchSwitcher({super.key});

  /// The least width the brand shows its chevron in: the mark, the chevron
  /// and a few letters of the name between them
  static const _chevronFrom = 120.0;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final branchState = ref.watch(branchProvider);
    final mayCallCentre = ref.watch(callCentreAvailableProvider);
    final inCallCentre = ref.watch(callCentreModeProvider);

    final active = branchState.selectedBranch;
    final branchName = active?.name.localized(context) ?? l10n.branches;
    // In call-centre mode the till answers for no branch: the one it works as is the caller's
    final branchLabel = inCallCentre ? '${l10n.callCentre} · $branchName' : branchName;
    final business = ref.watch(brandProvider).displayName(Localizations.localeOf(context));
    final switchable = branchState.branches.length > 1 || mayCallCentre;

    // With every chip in the header at once a phone leaves the brand room
    // for its mark and little else: the chevron goes before the mark does
    Widget brand({required bool withChevron}) => LayoutBuilder(
          builder: (context, box) => Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            const BrandMark(size: 32),
            const SizedBox(width: 8),
            // Takes what the header leaves it and cuts a long name short with
            // an ellipsis, rather than pushing past the edge
            Flexible(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Two lines at their roles' own height (20 each) fit the 48 dp row
                  Text(
                    business.isEmpty ? branchLabel : business,
                    maxLines: 1,
                    softWrap: false,
                    overflow: TextOverflow.ellipsis,
                    style: theme.type.detail.copyWith(
                      fontWeight: FontWeight.w600,
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
                      style: theme.type.caption.copyWith(
                        color: theme.colors.mutedForeground,
                      ),
                    ),
                ],
              ),
            ),
            if (withChevron && box.maxWidth >= _chevronFrom) ...[
              const SizedBox(width: 8),
              Icon(FIcons.chevronsUpDown, size: Sizes.iconSmall, color: theme.colors.mutedForeground),
            ],
          ],
          ),
        );

    // A phone gives the name every dp it can (pos_web's `px-2`)
    final inset = EdgeInsets.symmetric(horizontal: context.isCompact ? 8 : 12);

    if (!switchable) {
      return SizedBox(
        height: Sizes.control,
        child: Padding(
          padding: inset,
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
                title: Text(branch.name.localized(context), style: theme.type.body),
                suffix: !inCallCentre && branch.id == branchState.selectedBranchId
                    ? const Icon(FIcons.check, size: Sizes.icon)
                    : null,
                onPress: () {
                  if (inCallCentre) ref.read(callCentreModeSwitchProvider).set(false);
                  ref.read(branchProvider.notifier).selectBranch(branch.id);
                },
              ),
          ],
        ),
        if (mayCallCentre)
          FItemGroup(
            children: [
              FItem(
                prefix: const Icon(FIcons.headset, size: Sizes.icon),
                title: Text(l10n.callCentre, style: theme.type.body),
                suffix: inCallCentre ? const Icon(FIcons.check, size: Sizes.icon) : null,
                onPress: () => ref.read(callCentreModeSwitchProvider).set(true),
              ),
            ],
          ),
      ],
      // A plain tappable rather than a button: the button's own vertical
      // padding left two lines of text less than the 48 dp they need
      builder: (context, controller, _) => FTappable(
        onPress: controller.toggle,
        child: SizedBox(
          height: Sizes.control,
          child: Padding(
            padding: inset,
            child: brand(withChevron: true),
          ),
        ),
      ),
    );
  }
}
