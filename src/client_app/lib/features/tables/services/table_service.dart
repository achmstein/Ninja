import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../models/cafe_table.dart';

/// Abstract table repository
abstract class TableRepository {
  Future<CafeTable> getTable(int id);
}

/// API-backed table repository
class ApiTableRepository implements TableRepository {
  final ApiClient _apiClient;

  ApiTableRepository(this._apiClient);

  /// Resolve a scanned table QR code
  @override
  Future<CafeTable> getTable(int id) async {
    final response = await _apiClient.get<Map<String, dynamic>>('$id');
    return CafeTable.fromJson(response.data!);
  }
}

final tableRepositoryProvider = Provider<TableRepository>((ref) {
  return ApiTableRepository(ref.watch(tablesApiClientProvider));
});
