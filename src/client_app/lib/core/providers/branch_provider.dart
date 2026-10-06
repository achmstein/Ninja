import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/branch.dart';
import '../services/branch_service.dart';
import '../services/location_service.dart';
import '../../../features/cart/services/cart_service.dart';
import '../../../features/cart/services/order_move.dart';
import '../../../features/menu/services/menu_service.dart';

const String _branchKey = 'selected_branch_id';

/// Cached initial branch ID loaded before app starts
int? _initialBranchId;

/// Call this before runApp() to preload the saved branch
Future<void> initializeBranch() async {
  final prefs = await SharedPreferences.getInstance();
  _initialBranchId = prefs.getInt(_branchKey);
}

class BranchState {
  final List<Branch> branches;
  final int? selectedBranchId;
  final bool isLoading;
  final String? error;

  const BranchState({
    this.branches = const [],
    this.selectedBranchId,
    this.isLoading = false,
    this.error,
  });

  Branch? get selectedBranch {
    if (selectedBranchId == null) return null;
    try {
      return branches.firstWhere((b) => b.id == selectedBranchId);
    } catch (_) {
      return null;
    }
  }

  BranchState copyWith({
    List<Branch>? branches,
    int? selectedBranchId,
    bool? isLoading,
    String? error,
  }) {
    return BranchState(
      branches: branches ?? this.branches,
      selectedBranchId: selectedBranchId ?? this.selectedBranchId,
      isLoading: isLoading ?? this.isLoading,
      error: error,
    );
  }
}

class BranchNotifier extends Notifier<BranchState> {
  @override
  BranchState build() {
    _loadBranches();
    return BranchState(
      selectedBranchId: _initialBranchId,
      isLoading: true,
    );
  }

  Future<void> _loadBranches() async {
    try {
      final repo = ref.read(branchRepositoryProvider);
      final branches = await repo.getBranches();

      var selectedId = state.selectedBranchId;

      // The app opens at the branch last used; where that is not one of the business's (a first
      // visit, a branch since removed) at the first open one taking orders in the owner's order,
      // asking the customer nothing: the menu is the same everywhere, and a delivery address or a
      // booking moves the app, the order with it, to the branch that counts
      final firstVisit = selectedId == null;
      if (selectedId == null || !branches.any((b) => b.id == selectedId)) {
        final ordered = [...branches]..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
        selectedId = (ordered.where((b) => b.isActive && b.isOrderingEnabled).firstOrNull ??
                ordered.where((b) => b.isActive).firstOrNull ??
                ordered.firstOrNull)
            ?.id;
        if (selectedId != null) {
          _saveBranchId(selectedId);
        }
      }

      state = state.copyWith(
        branches: branches,
        selectedBranchId: selectedId,
        isLoading: false,
      );
      if (firstVisit && branches.length > 1) _nearestOnFirstVisit(branches);
    } catch (e) {
      debugPrint('Failed to load branches: $e');
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  /// A first visit, where the phone already gives the position without a
  /// prompt: the nearest open branch, rather than the owner's first
  Future<void> _nearestOnFirstVisit(List<Branch> branches) async {
    await ref.read(locationProvider.notifier).readQuietly();
    final here = ref.read(locationProvider).here;
    if (here == null) return;
    final open = branches.where((b) => b.isActive && b.isOrderingEnabled).toList();
    final nearest = byDistance(open, here, (b) => b.point).firstOrNull;
    if (nearest != null && nearest.meters != null) await selectBranch(nearest.item.id);
  }

  /// Moves the app to another branch, the order with it: the dishes stay, at
  /// the new branch's prices, and one it does not serve goes (order_move.dart);
  /// what changed is said ([orderMoveProvider]). Branch-scoped providers use
  /// .family(branchId) or watch the selected branch, so they fetch afresh.
  Future<void> selectBranch(int branchId) async {
    if (branchId == state.selectedBranchId) return;

    state = state.copyWith(selectedBranchId: branchId);
    await _saveBranchId(branchId);

    if (ref.read(cartProvider).isEmpty) return;
    try {
      final menu = await ref.read(menuRepositoryProvider).getMenuItems(branchId: branchId);
      // Moved again meanwhile: that move carries the order
      if (state.selectedBranchId != branchId) return;
      final move = moveLines(ref.read(cartProvider).items, menu);
      if (!move.changed) return;
      ref.read(cartProvider.notifier).setItems(move.items);
      ref.read(orderMoveProvider.notifier).say(OrderMoveNotice(branchId, move));
    } catch (e) {
      // The menu could not be had: the order goes as it is, and the branch's own check of it says what is off
      debugPrint('Moving the order: $e');
    }
  }

  Future<void> refresh() async {
    state = state.copyWith(isLoading: true);
    await _loadBranches();
  }

  /// Re-fetch branch data without showing a loading spinner.
  Future<void> refreshSilently() async {
    await _loadBranches();
  }

  Future<void> _saveBranchId(int branchId) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setInt(_branchKey, branchId);
  }
}

final branchProvider = NotifierProvider<BranchNotifier, BranchState>(
  BranchNotifier.new,
);

/// Convenience provider for the selected branch ID
final selectedBranchIdProvider = Provider<int?>((ref) {
  return ref.watch(branchProvider).selectedBranchId;
});
