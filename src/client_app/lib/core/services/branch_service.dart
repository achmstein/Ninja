import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ninja_app_core/services/branch_service.dart' show ApiBranchRepository, BranchRepository;
import '../network/api_client.dart';

export 'package:ninja_app_core/services/branch_service.dart' show ApiBranchRepository, BranchRepository;

/// The branch list (ninja_app_core's repository) through this app's own client
final branchRepositoryProvider = Provider<BranchRepository>((ref) {
  final apiClient = ref.read(branchesApiProvider);
  return ApiBranchRepository(apiClient);
});
