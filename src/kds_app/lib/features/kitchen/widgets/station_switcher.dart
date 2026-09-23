import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import '../../../core/models/localized_text.dart';
import '../../../l10n/app_localizations.dart';
import '../models/kitchen_station.dart';
import '../providers/station_provider.dart';

/// Which station this display is, as kds_web's StationSwitcher: the grill
/// sees the grill's lines, the bar the bar's, and the pass sees every order
/// whole. Hidden while the branch has only one screen station, where the
/// pass is all there is.
class StationSwitcher extends ConsumerWidget {
  const StationSwitcher({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final theme = context.theme;
    final l10n = AppLocalizations.of(context)!;
    final screens = ref.watch(screenStationsProvider).value ?? const <KitchenStation>[];
    final station = ref.watch(selectedStationProvider);

    if (screens.length <= 1) return const SizedBox.shrink();

    void pick(int? stationId) => ref.read(stationPicksProvider.notifier).select(stationId);

    return FPopoverMenu(
      menuAnchor: AlignmentDirectional.topStart,
      childAnchor: AlignmentDirectional.bottomStart,
      menu: [
        FItemGroup(
          children: [
            FItem(
              prefix: const Icon(FIcons.layoutGrid, size: 20),
              title: Text(l10n.allStations, style: theme.typography.base),
              suffix: station == null ? const Icon(FIcons.check, size: 20) : null,
              onPress: () => pick(null),
            ),
          ],
        ),
        FItemGroup(
          children: [
            for (final s in screens)
              FItem(
                prefix: const Icon(FIcons.chefHat, size: 20),
                title: Text(s.name.localized(context), style: theme.typography.base),
                suffix: s.id == station?.id ? const Icon(FIcons.check, size: 20) : null,
                onPress: () => pick(s.id),
              ),
          ],
        ),
      ],
      builder: (context, controller, _) => SizedBox(
        height: 48,
        child: FButton(
          variant: FButtonVariant.outline,
          mainAxisSize: MainAxisSize.min,
          onPress: controller.toggle,
          prefix: Icon(station == null ? FIcons.layoutGrid : FIcons.chefHat, size: 20),
          suffix: Icon(FIcons.chevronsUpDown, size: 16, color: theme.colors.mutedForeground),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 160),
            child: Text(
              station?.name.localized(context) ?? l10n.allStations,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ),
      ),
    );
  }
}
