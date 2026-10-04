import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import '../models/dining_table.dart';

abstract class TablesRepository {
  /// Every place of the branch with no clock, inactive ones included
  Future<List<DiningTable>> getTables();
}

class ApiTablesRepository implements TablesRepository {
  final ApiClient _apiClient;

  ApiTablesRepository(this._apiClient);

  @override
  Future<List<DiningTable>> getTables() async {
    final response = await _apiClient.get<List<dynamic>>('', queryParameters: {'timed': false});
    return (response.data ?? []).map((e) => DiningTable.fromJson(e as Map<String, dynamic>)).toList();
  }
}

final tablesRepositoryProvider = Provider<TablesRepository>((ref) {
  return ApiTablesRepository(ref.read(placesApiProvider));
});

/// The branch's tables. They change from the admin app, rarely; a branch
/// switch is the one thing that has to reload them.
final tablesProvider = FutureProvider<List<DiningTable>>((ref) async {
  ref.watch(selectedBranchIdProvider);
  return ref.read(tablesRepositoryProvider).getTables();
});
