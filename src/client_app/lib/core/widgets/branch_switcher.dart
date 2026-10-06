import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import '../ui/ui.dart';
import '../theme/theme_provider.dart';
import '../models/branch.dart';
import '../models/localized_text.dart';
import '../providers/branch_provider.dart';
import '../providers/branch_switch.dart';
import '../services/location_service.dart';
import '../../l10n/app_localizations.dart';
import 'app_text.dart';

/// A branch's quiet facts on one line: open or not, and how far
class BranchFacts extends StatelessWidget {
  final Branch branch;
  final double? meters;

  const BranchFacts({super.key, required this.branch, this.meters});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final muted = theme.colors.mutedForeground;
    final (text, dot) = switch (branchOpenState(branch)) {
      BranchOpenState.open => (l10n.branchOpen, NinjaColors.success),
      BranchOpenState.notOrdering => (l10n.branchNotOrdering, NinjaColors.warning),
      BranchOpenState.closed => (l10n.branchClosed, muted),
    };
    final style = context.localeText(theme.typography.caption.copyWith(color: muted));
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(width: 6, height: 6, decoration: BoxDecoration(color: dot, shape: BoxShape.circle)),
        const SizedBox(width: 6),
        Flexible(child: AppText(text, style: style, maxLines: 1, overflow: TextOverflow.ellipsis)),
        if (meters != null) ...[
          AppText(' · ', style: style),
          Text(distanceText(context, meters!), textDirection: TextDirection.ltr, style: style.copyWith(fontFeatures: NinjaTypography.tabular)),
        ],
      ],
    );
  }
}

/// The way there in Google Maps, for a branch the owner put on the map
class DirectionsButton extends StatelessWidget {
  final Branch branch;

  /// Drawn on the muted row that is lit: the pill takes the page's colour to stand off it
  final bool onMuted;

  const DirectionsButton({super.key, required this.branch, this.onMuted = false});

  @override
  Widget build(BuildContext context) {
    final point = branch.point;
    if (point == null) return const SizedBox.shrink();
    final theme = context.theme;
    return Pressable(
      onTap: () => launchUrl(directionsUri(point), mode: LaunchMode.externalApplication),
      child: Container(
        height: 36,
        padding: const EdgeInsets.symmetric(horizontal: 12),
        decoration: ShapeDecoration(color: onMuted ? theme.colors.background : theme.colors.muted, shape: const StadiumBorder()),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(LucideIcons.navigation, size: 14, color: theme.colors.foreground),
            const SizedBox(width: 6),
            AppText(
              AppLocalizations.of(context)!.directions,
              style: context.localeText(theme.typography.caption.copyWith(fontWeight: FontWeight.w600, color: theme.colors.foreground)),
            ),
          ],
        ),
      ),
    );
  }
}

/// "Use my location", quiet, for a customer who said no or was not asked: a
/// tap asks then. Gone once the position is known; a spinner while it is found
class UseMyLocationButton extends ConsumerWidget {
  const UseMyLocationButton({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final location = ref.watch(locationProvider);
    if (location.here != null) return const SizedBox.shrink();
    final style = context.localeText(theme.typography.caption.copyWith(fontWeight: FontWeight.w600, color: theme.colors.mutedForeground));
    if (location.locating) {
      return Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          SizedBox.square(dimension: 14, child: CircularProgressIndicator(strokeWidth: 2, color: theme.colors.mutedForeground)),
          const SizedBox(width: 6),
          AppText(l10n.locating, style: style),
        ],
      );
    }
    return Pressable(
      onTap: () async {
        final allowed = await ref.read(locationProvider.notifier).locate();
        if (!allowed && context.mounted) {
          showIsland(context: context, title: Text(l10n.locationOff), icon: Icon(LucideIcons.mapPinOff, color: theme.colors.mutedForeground));
        }
      },
      child: SizedBox(
        height: 36,
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(LucideIcons.locateFixed, size: 14, color: theme.colors.mutedForeground),
            const SizedBox(width: 6),
            AppText(l10n.useMyLocation, style: style),
          ],
        ),
      ),
    );
  }
}

/// The branches as a sheet from the bottom, the one looked at lit: closest
/// first when the customer let the app know where they are, each with how
/// far, whether it is open and the way there. A tap moves the app to it, the
/// order with it. The position is read where the phone already gives it,
/// never asked for (client_web's BranchSheet).
Future<void> showBranchSheet(BuildContext context) => showNinjaSheet<void>(
      context: context,
      padding: const EdgeInsets.fromLTRB(12, 0, 12, 16),
      builder: (sheetContext) => const _BranchSheet(),
    );

class _BranchSheet extends ConsumerStatefulWidget {
  const _BranchSheet();

  @override
  ConsumerState<_BranchSheet> createState() => _BranchSheetState();
}

class _BranchSheetState extends ConsumerState<_BranchSheet> {
  @override
  void initState() {
    super.initState();
    // Something to measure: a position the phone already gives, never a prompt
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final branches = ref.read(branchProvider).branches;
      if (branches.length > 1 && branches.any((b) => b.point != null)) ref.read(locationProvider.notifier).readQuietly();
    });
  }

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final state = ref.watch(branchProvider);
    final here = ref.watch(locationProvider).here;
    final sorted = branchesByDistance(state.branches, state.selectedBranchId, here);
    final anyPoint = state.branches.any((b) => b.point != null);

    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(4, 0, 4, 4),
          child: AppText(
            l10n.selectBranch,
            style: context.localeText(theme.typography.headline.copyWith(fontWeight: FontWeight.w800, color: theme.colors.foreground)),
          ),
        ),
        if (anyPoint && sorted.length > 1)
          const Padding(
            padding: EdgeInsetsDirectional.only(start: 4, bottom: 8),
            child: Align(alignment: AlignmentDirectional.centerStart, child: UseMyLocationButton()),
          ),
        for (final (:item, :meters) in sorted)
          _BranchRow(
            branch: item,
            meters: meters,
            selected: item.id == state.selectedBranchId,
            onPick: () {
              final navigator = Navigator.of(context);
              final parent = navigator.context;
              navigator.pop();
              requestBranchSwitch(parent, ref, item.id);
            },
          ),
      ],
    );
  }
}

class _BranchRow extends StatelessWidget {
  final Branch branch;
  final double? meters;
  final bool selected;
  final VoidCallback onPick;

  const _BranchRow({required this.branch, required this.meters, required this.selected, required this.onPick});

  @override
  Widget build(BuildContext context) {
    final theme = context.theme;
    final address = branch.address?.localized(context) ?? '';
    return Semantics(
      selected: selected,
      button: true,
      child: Container(
        constraints: const BoxConstraints(minHeight: 64),
        margin: const EdgeInsets.only(bottom: 6),
        padding: const EdgeInsetsDirectional.only(end: 8),
        decoration: BoxDecoration(color: selected ? theme.colors.muted : null, borderRadius: BorderRadius.circular(20)),
        child: Row(
          children: [
            Expanded(
              child: Pressable(
                onTap: onPick,
                child: Padding(
                  padding: const EdgeInsetsDirectional.fromSTEB(16, 12, 8, 12),
                  child: Row(
                    children: [
                      Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(color: selected ? theme.colors.background : theme.colors.muted, shape: BoxShape.circle),
                        child: Icon(LucideIcons.mapPin, size: 20, color: theme.colors.foreground),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Flexible(
                                  child: AppText(
                                    branch.name.localized(context),
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: context.localeText(theme.typography.body.copyWith(fontWeight: FontWeight.w600, color: theme.colors.foreground)),
                                  ),
                                ),
                                if (selected) ...[
                                  const SizedBox(width: 6),
                                  Icon(LucideIcons.check, size: 16, color: theme.colors.foreground),
                                ],
                              ],
                            ),
                            if (address.isNotEmpty)
                              AppText(
                                address,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: context.localeText(theme.typography.caption.copyWith(color: theme.colors.mutedForeground)),
                              ),
                            BranchFacts(branch: branch, meters: meters),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
            DirectionsButton(branch: branch, onMuted: selected),
          ],
        ),
      ),
    );
  }
}
