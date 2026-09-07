import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/admin_user.dart';
import '../services/admins_service.dart';

/// Admins state
class AdminsState {
  final bool isLoading;
  final String? error;
  final List<AdminUser> admins;
  final int totalCount;
  final String? searchQuery;

  const AdminsState({
    this.isLoading = false,
    this.error,
    this.admins = const [],
    this.totalCount = 0,
    this.searchQuery,
  });

  AdminsState copyWith({
    bool? isLoading,
    String? error,
    List<AdminUser>? admins,
    int? totalCount,
    String? searchQuery,
    bool clearSearch = false,
    bool clearError = false,
  }) {
    return AdminsState(
      isLoading: isLoading ?? this.isLoading,
      error: clearError ? null : (error ?? this.error),
      admins: admins ?? this.admins,
      totalCount: totalCount ?? this.totalCount,
      searchQuery: clearSearch ? null : (searchQuery ?? this.searchQuery),
    );
  }
}

/// Admins provider
class AdminsNotifier extends Notifier<AdminsState> {
  late AdminsRepository _repository;

  @override
  AdminsState build() {
    _repository = ref.read(adminsRepositoryProvider);
    return const AdminsState();
  }

  Future<void> loadAdmins({int first = 0, int max = 50}) async {
    state = state.copyWith(isLoading: true, clearError: true);

    try {
      final admins = await _repository.getAdmins(
        first: first,
        max: max,
        role: 'Admin,Cashier',
        search: state.searchQuery,
      );

      state = state.copyWith(
        isLoading: false,
        admins: admins,
        totalCount: admins.length,
      );
    } catch (e) {
      debugPrint('Failed to load admins: $e');
      state = state.copyWith(isLoading: false, error: e.toString());
    }
  }

  void setSearchQuery(String? query) {
    if (query == null || query.isEmpty) {
      state = state.copyWith(clearSearch: true);
    } else {
      state = state.copyWith(searchQuery: query);
    }
    loadAdmins();
  }

  Future<bool> createAdmin({
    required String name,
    required String email,
    required String password,
    bool isOwner = false,
  }) async {
    try {
      await _repository.createAdmin(
        name: name,
        email: email,
        password: password,
        isOwner: isOwner,
      );

      // Refresh admin list
      await loadAdmins();
      return true;
    } catch (e) {
      debugPrint('Failed to create admin: $e');
      state = state.copyWith(error: e.toString());
      return false;
    }
  }

  Future<bool> updateAdminName(String adminId, String newName) async {
    try {
      await _repository.updateAdminName(adminId, newName);
      await loadAdmins();
      return true;
    } catch (e) {
      debugPrint('Failed to update admin name: $e');
      state = state.copyWith(error: e.toString());
      return false;
    }
  }

  Future<bool> resetAdminPassword(String adminId, String newPassword) async {
    try {
      await _repository.resetAdminPassword(adminId, newPassword);
      return true;
    } catch (e) {
      debugPrint('Failed to reset admin password: $e');
      state = state.copyWith(error: e.toString());
      return false;
    }
  }

  /// Replaces the branches a staff account may work in
  Future<bool> setBranches(String adminId, List<int> branchIds) async {
    try {
      await _repository.setBranches(adminId, branchIds);
      await loadAdmins();
      return true;
    } catch (e) {
      debugPrint('Failed to set branches: $e');
      state = state.copyWith(error: e.toString());
      return false;
    }
  }

  Future<bool> toggleAdminEnabled(String adminId) async {
    try {
      await _repository.toggleAdminEnabled(adminId);
      await loadAdmins();
      return true;
    } catch (e) {
      debugPrint('Failed to toggle admin enabled: $e');
      state = state.copyWith(error: e.toString());
      return false;
    }
  }
}

/// Admins provider
final adminsProvider =
    NotifierProvider<AdminsNotifier, AdminsState>(AdminsNotifier.new);
