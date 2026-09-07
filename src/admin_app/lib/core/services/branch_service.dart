import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/branch.dart';
import '../network/api_client.dart';

abstract class BranchRepository {
  /// Every branch, inactive ones included (Owner)
  Future<List<Branch>> getBranches();

  /// The active branches, the public list every app reads
  Future<List<Branch>> getActiveBranches();
  Future<Branch> createBranch(Map<String, dynamic> data);
  Future<Branch> updateBranch(int id, Map<String, dynamic> data);
  Future<Branch> updateBranchSettings(int id, Map<String, dynamic> data);
}

class ApiBranchRepository implements BranchRepository {
  final ApiClient _apiClient;

  ApiBranchRepository(this._apiClient);

  @override
  Future<List<Branch>> getBranches() async {
    final response = await _apiClient.get<List<dynamic>>('all');
    return (response.data ?? [])
        .map((e) => Branch.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<List<Branch>> getActiveBranches() async {
    final response = await _apiClient.get<List<dynamic>>('');
    return (response.data ?? [])
        .map((e) => Branch.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<Branch> createBranch(Map<String, dynamic> data) async {
    final response = await _apiClient.post<Map<String, dynamic>>('', data: data);
    return Branch.fromJson(response.data!);
  }

  @override
  Future<Branch> updateBranch(int id, Map<String, dynamic> data) async {
    final response = await _apiClient.put<Map<String, dynamic>>('$id', data: data);
    return Branch.fromJson(response.data!);
  }

  @override
  Future<Branch> updateBranchSettings(int id, Map<String, dynamic> data) async {
    final response = await _apiClient.patch<Map<String, dynamic>>('$id/settings', data: data);
    return Branch.fromJson(response.data!);
  }
}

final branchRepositoryProvider = Provider<BranchRepository>((ref) {
  final apiClient = ref.read(branchesApiProvider);
  return ApiBranchRepository(apiClient);
});
