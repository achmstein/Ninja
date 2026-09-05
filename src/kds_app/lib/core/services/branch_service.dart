import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/branch.dart';
import '../network/api_client.dart';

/// The one branch call the kitchen makes: the list to switch between (the
/// same public list kds_web reads).
abstract class BranchRepository {
  Future<List<Branch>> getBranches();
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
}

final branchRepositoryProvider = Provider<BranchRepository>((ref) {
  final apiClient = ref.read(branchesApiProvider);
  return ApiBranchRepository(apiClient);
});
