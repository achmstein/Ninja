import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/branch.dart';
import '../network/api_client.dart';

/// The two branch calls a till makes: the list to switch between (the same
/// public list pos_web reads) and the taking-orders / taking-reservations
/// flags the shift panel flips.
abstract class BranchRepository {
  Future<List<Branch>> getBranches();
  Future<Branch> updateBranchSettings(int id, Map<String, dynamic> data);
}

class ApiBranchRepository implements BranchRepository {
  final ApiClient _apiClient;

  ApiBranchRepository(this._apiClient);

  @override
  Future<List<Branch>> getBranches() async {
    final response = await _apiClient.get<List<dynamic>>('');
    return (response.data ?? [])
        .map((e) => Branch.fromJson(e as Map<String, dynamic>))
        .toList();
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
