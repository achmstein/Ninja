import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/providers/branch_provider.dart';
import '../models/kitchen_station.dart';
import '../services/kitchen_service.dart';

const String _prefix = 'kds_station_';

/// The branch's stations that show on a screen — the ones this display can
/// be. Refetched with the branch.
final screenStationsProvider = FutureProvider<List<KitchenStation>>((ref) async {
  final branchId = ref.watch(selectedBranchIdProvider);
  if (branchId == null) return const [];
  final stations = await ref.read(kitchenRepositoryProvider).getStations();
  return [
    for (final station in stations)
      if (station.showsOnScreen) station,
  ];
});

/// Which station this display is, per branch, remembered on the device: a
/// tablet on the grill stays the grill after a restart. No entry is the pass.
class StationPicksNotifier extends Notifier<Map<int, int>> {
  @override
  Map<int, int> build() {
    _load();
    return const {};
  }

  Future<void> _load() async {
    final prefs = await SharedPreferences.getInstance();
    final picks = <int, int>{
      for (final key in prefs.getKeys())
        if (key.startsWith(_prefix))
          if ((int.tryParse(key.substring(_prefix.length)), prefs.getInt(key)) case (final branch?, final station?))
            branch: station,
    };
    if (ref.mounted) state = picks;
  }

  /// This display becomes [stationId] at the active branch; null is the pass
  Future<void> select(int? stationId) async {
    final branchId = ref.read(selectedBranchIdProvider);
    if (branchId == null) return;
    state = {...state}..removeWhere((branch, _) => branch == branchId);
    if (stationId != null) state = {...state, branchId: stationId};
    final prefs = await SharedPreferences.getInstance();
    if (stationId == null) {
      await prefs.remove('$_prefix$branchId');
    } else {
      await prefs.setInt('$_prefix$branchId', stationId);
    }
  }
}

final stationPicksProvider = NotifierProvider<StationPicksNotifier, Map<int, int>>(StationPicksNotifier.new);

/// The station this display is at the active branch, or null for the pass.
/// A pick the back office has since removed, or moved to a printer, reads
/// as the pass rather than an empty board.
final selectedStationProvider = Provider<KitchenStation?>((ref) {
  final branchId = ref.watch(selectedBranchIdProvider);
  final picked = branchId == null ? null : ref.watch(stationPicksProvider)[branchId];
  if (picked == null) return null;
  final screens = ref.watch(screenStationsProvider).value ?? const <KitchenStation>[];
  for (final station in screens) {
    if (station.id == picked) return station;
  }
  return null;
});

/// The station's id for the API, null on the pass
final selectedStationIdProvider = Provider<int?>((ref) => ref.watch(selectedStationProvider)?.id);
