import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/branch_provider.dart';
import '../models/shift.dart';
import '../services/shifts_service.dart';

/// The shift screen watches the drawer closely; the header chip only needs
/// the day's state, and shares this one query so a single refresh after
/// open/close updates the chip, the panel and the screen together
const _poll = Duration(seconds: 20);

/// The branch's open drawer shift, or null once the server has said "no
/// shift open" (vs. still loading).
class CurrentShiftNotifier extends AsyncNotifier<ShiftView?> {
  Timer? _poll_;

  @override
  Future<ShiftView?> build() async {
    ref.watch(selectedBranchIdProvider);
    _poll_?.cancel();
    _poll_ = Timer.periodic(_poll, (_) => refresh());
    ref.onDispose(() => _poll_?.cancel());
    return ref.read(shiftsRepositoryProvider).getCurrentShift();
  }

  /// Refetch without dropping what is on screen; a 404 is a real answer
  /// (the shift closed elsewhere) and replaces it with null
  Future<void> refresh() async {
    final result = await AsyncValue.guard(() => ref.read(shiftsRepositoryProvider).getCurrentShift());
    if (!ref.mounted) return;
    if (result.hasValue) state = result;
  }
}

final currentShiftProvider = AsyncNotifierProvider<CurrentShiftNotifier, ShiftView?>(CurrentShiftNotifier.new);

/// One shift by id — a Z from the history, or the open one
final shiftProvider = FutureProvider.autoDispose.family<ShiftView, int>((ref, id) async {
  ref.watch(selectedBranchIdProvider);
  return ref.read(shiftsRepositoryProvider).getShift(id);
});

const closedShiftsPageSize = 20;

/// One page of the Z history, newest first
final closedShiftsProvider = FutureProvider.autoDispose.family<List<ShiftView>, int>((ref, pageIndex) async {
  ref.watch(selectedBranchIdProvider);
  return ref.read(shiftsRepositoryProvider).getClosedShifts(pageIndex: pageIndex, pageSize: closedShiftsPageSize);
});

/// The branch's two customer-facing switches, taking orders and taking
/// reservations, read off the branch list and flipped through Branch.API.
/// The shift drives them automatically (open → both on, close → both off);
/// flipping one by hand is the mid-day pause — the kitchen is swamped, a
/// room is being cleaned. Ordering and Spaces enforce them server-side for
/// customers while the till itself is never blocked.
class BranchFlags {
  final int? branchId;
  final bool known;
  final bool takingOrders;
  final bool takingReservations;

  const BranchFlags({required this.branchId, required this.known, required this.takingOrders, required this.takingReservations});

  /// Either switch is off — the store is not fully trading
  bool get paused => known && !(takingOrders && takingReservations);
}

final branchFlagsProvider = Provider<BranchFlags>((ref) {
  final state = ref.watch(branchProvider);
  final branch = state.selectedBranch;
  return BranchFlags(
    branchId: state.selectedBranchId,
    known: branch != null,
    takingOrders: branch?.isOrderingEnabled ?? true,
    takingReservations: branch?.isReservationsEnabled ?? true,
  );
});
