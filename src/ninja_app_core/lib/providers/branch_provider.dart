import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../auth/auth_service.dart';
import '../config.dart';
import '../models/branch.dart';
import '../services/branch_service.dart';

String get _branchKey => '${NinjaCore.config.appKey}_selected_branch_id';

/// The branch list as last fetched, so a device started without the
/// internet still knows its branch (a till prints its name on receipts)
String get _branchesKey => '${NinjaCore.config.appKey}_branches';

/// Cached initial branch ID loaded before app starts
int? _initialBranchId;

/// Call this before runApp() to preload the saved branch
Future<void> initializeBranch() async {
  final prefs = await SharedPreferences.getInstance();
  _initialBranchId = prefs.getInt(_branchKey);
}

/// Drop the remembered branch: the device is leaving this business
Future<void> forgetBranch() async {
  _initialBranchId = null;
  final prefs = await SharedPreferences.getInstance();
  await prefs.remove(_branchKey);
  await prefs.remove(_branchesKey);
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

  /// Loaded, and nothing to work in: the token names no branch this list holds
  bool get noBranch => !isLoading && error == null && branches.isEmpty;

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
/// header). Picked once on the device and persisted, like the web apps'
/// branch store; defaults to the first branch.
class BranchNotifier extends Notifier<BranchState> {
  @override
  BranchState build() {
    // A refreshed token may carry a changed assignment: re-filter then.
    // The first load after sign-in is app.dart's; it is skipped while running.
    ref.listen(authServiceProvider.select((s) => s.branches), (previous, next) {
      if (previous != null && !listEquals(previous, next) && !state.isLoading) loadBranches();
    });
    ref.listen(authServiceProvider.select((s) => s.allBranches), (previous, next) {
      if (previous != null && previous != next && !state.isLoading) loadBranches();
    });
    return BranchState(
      selectedBranchId: _initialBranchId,
      isLoading: true,
    );
  }

  Future<void> loadBranches() async {
    try {
      // The public list, narrowed to the token's branch claim; owners hold all,
      // and so does an account given every branch (`*`, a call centre's)
      final auth = ref.read(authServiceProvider);
      final all = await ref.read(branchRepositoryProvider).getBranches();
      unawaited(_keepBranches(all));
      _select(allowedBranches(all, auth));
    } catch (e) {
      debugPrint('Failed to load branches: $e');
      final kept = await _keptBranches();
      if (kept != null && kept.isNotEmpty) {
        // Offline: work from the list last seen; the error stays noted
        _select(allowedBranches(kept, ref.read(authServiceProvider)));
        state = state.copyWith(error: e.toString());
      } else {
        state = state.copyWith(isLoading: false, error: e.toString());
      }
    }
  }

  void _select(List<Branch> branches) {
    var selectedId = state.selectedBranchId;

    // If no branch selected, or the selected one is gone, pick the first
    if (selectedId == null || !branches.any((b) => b.id == selectedId)) {
      selectedId = branches.isNotEmpty ? branches.first.id : null;
      if (selectedId != null) {
        unawaited(_saveBranchId(selectedId));
      }
    }

    state = state.copyWith(
      branches: branches,
      selectedBranchId: selectedId,
      isLoading: false,
    );
  }

  Future<void> _keepBranches(List<Branch> all) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_branchesKey, json.encode([for (final b in all) b.toJson()]));
  }

  Future<List<Branch>?> _keptBranches() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final kept = prefs.getString(_branchesKey);
      if (kept == null) return null;
      return [for (final b in json.decode(kept) as List<dynamic>) Branch.fromJson(b as Map<String, dynamic>)];
    } catch (_) {
      return null;
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

/// The branches an account may work in: every one for an owner or an account
/// given every branch (a `*` in the claim, new branches included), otherwise
/// those its claim names.
List<Branch> allowedBranches(List<Branch> all, AuthState auth) =>
    auth.isOwner || auth.allBranches ? all : all.where((b) => auth.branches.contains(b.id)).toList();

final branchProvider = NotifierProvider<BranchNotifier, BranchState>(
  BranchNotifier.new,
);

/// Convenience provider for the selected branch ID
final selectedBranchIdProvider = Provider<int?>((ref) {
  return ref.watch(branchProvider).selectedBranchId;
});
