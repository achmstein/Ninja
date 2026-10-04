import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ninja_app_core/models/branch.dart';
import 'package:ninja_app_core/network/api_client.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';

/// The branch call only a till makes: the taking-orders / taking-reservations
/// flags the shift panel flips (the shared core reads the branch list)
abstract class BranchSettingsRepository {
  Future<Branch> updateBranchSettings(int id, Map<String, dynamic> data);
}

class ApiBranchSettingsRepository implements BranchSettingsRepository {
  final ApiClient _apiClient;

  ApiBranchSettingsRepository(this._apiClient);

  @override
  Future<Branch> updateBranchSettings(int id, Map<String, dynamic> data) async {
    final response = await _apiClient.patch<Map<String, dynamic>>('$id/settings', data: data);
    return Branch.fromJson(response.data!);
  }
}

final branchSettingsRepositoryProvider = Provider<BranchSettingsRepository>((ref) {
  return ApiBranchSettingsRepository(ref.read(branchesApiProvider));
});

/// Flip a branch's switches, then read the list again so every screen sees
/// them; false when the change did not go through
final branchSettingsProvider = Provider<BranchSettings>(BranchSettings.new);

class BranchSettings {
  final Ref _ref;

  BranchSettings(this._ref);

  Future<bool> update(int branchId, Map<String, dynamic> data) async {
    try {
      await _ref.read(branchSettingsRepositoryProvider).updateBranchSettings(branchId, data);
      await _ref.read(branchProvider.notifier).loadBranches();
      return true;
    } catch (e) {
      debugPrint('Failed to update branch settings: $e');
      return false;
    }
  }
}
