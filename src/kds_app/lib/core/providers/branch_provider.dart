import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/branch.dart';
import '../services/branch_service.dart';

const String _branchKey = 'kds_selected_branch_id';

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

/// The active branch scopes every branch-aware API call (X-Branch-Id
/// header). Picked once on the display and persisted, like kds_web's
/// branch store; defaults to the first branch.
class BranchNotifier extends Notifier<BranchState> {
  @override
  BranchState build() {
    return BranchState(
      selectedBranchId: _initialBranchId,
      isLoading: true,
    );
  }

  Future<void> loadBranches() async {
    try {
      final repo = ref.read(branchRepositoryProvider);
      final branches = await repo.getBranches();

      var selectedId = state.selectedBranchId;

      // If no branch selected, or the selected one is gone, pick the first
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
    // Branch-scoped providers watch selectedBranchIdProvider and rebuild.
  }

  Future<void> refresh() async {
    state = state.copyWith(isLoading: true);
    await loadBranches();
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
