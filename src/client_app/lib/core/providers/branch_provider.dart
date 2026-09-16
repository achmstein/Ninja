import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/branch.dart';
import '../services/branch_service.dart';
import '../../../features/cart/services/cart_service.dart';

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

      // If no branch selected yet, or selected branch not in list, pick first
      if (selectedId == null || !branches.any((b) => b.id == selectedId)) {
        selectedId = branches.isNotEmpty ? branches.first.id : null;
        if (selectedId != null) {
          _saveBranchId(selectedId);
        }
      }

      state = state.copyWith(
        branches: branches,
        selectedBranchId: selectedId,
        isLoading: false,
      );
    } catch (e) {
      debugPrint('Failed to load branches: $e');
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<void> selectBranch(int branchId) async {
    if (branchId == state.selectedBranchId) return;

    state = state.copyWith(selectedBranchId: branchId);
    await _saveBranchId(branchId);

    // Branch-scoped providers use .family(branchId) so switching branches
    // creates a fresh provider instance with clean loading state.
    // myStaysProvider watches selectedBranchIdProvider directly (Notifier).
    // Cart is local state — just clear it on branch switch:
    ref.read(cartProvider.notifier).clear();
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
