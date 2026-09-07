import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/models/branch.dart';
import '../../../core/providers/branch_provider.dart';
import '../../../core/services/branch_service.dart';

class BranchesManagementState {
  final bool isLoading;
  final String? error;
  final List<Branch> branches;

  const BranchesManagementState({
    this.isLoading = false,
    this.error,
    this.branches = const [],
  });

  BranchesManagementState copyWith({
    bool? isLoading,
    String? error,
    List<Branch>? branches,
    bool clearError = false,
  }) {
    return BranchesManagementState(
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
      branches: branches ?? this.branches,
    );
  }
}

class BranchesManagementNotifier extends Notifier<BranchesManagementState> {
  late BranchRepository _repository;

  @override
  BranchesManagementState build() {
    _repository = ref.read(branchRepositoryProvider);
    return const BranchesManagementState();
  }

  Future<void> loadBranches() async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final branches = await _repository.getBranches();
      state = state.copyWith(
        isLoading: false,
        branches: branches,
      );
    } catch (e) {
      debugPrint('Failed to load branches: $e');
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  Future<bool> createBranch(Map<String, dynamic> data) async {
    try {
      await _repository.createBranch(data);
      await loadBranches();
      ref.read(branchProvider.notifier).refresh();
      return true;
    } catch (e) {
      debugPrint('Failed to create branch: $e');
      state = state.copyWith(error: e.toString());
      return false;
    }
  }

  Future<bool> updateBranch(int id, Map<String, dynamic> data) async {
    try {
      await _repository.updateBranch(id, data);
      await loadBranches();
      ref.read(branchProvider.notifier).refresh();
      return true;
    } catch (e) {
      debugPrint('Failed to update branch: $e');
      state = state.copyWith(error: e.toString());
      return false;
    }
  }

}

final branchesManagementProvider =
    NotifierProvider<BranchesManagementNotifier, BranchesManagementState>(
  BranchesManagementNotifier.new,
);
