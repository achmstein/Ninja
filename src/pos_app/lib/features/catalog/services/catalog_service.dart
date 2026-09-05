import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../models/catalog_item.dart';

/// What the till reads from the catalog: the menu to sell from, and the
/// sold-out switch. Editing items is the back office's job.
abstract class CatalogRepository {
  Future<List<CatalogItem>> getItems();
  Future<List<CatalogCategory>> getCategories();
  Future<void> setAvailability(int itemId, bool isAvailable, {String? requestId});
}

class ApiCatalogRepository implements CatalogRepository {
  final ApiClient _apiClient;

  ApiCatalogRepository(this._apiClient);

  @override
  Future<List<CatalogItem>> getItems() async {
    final response = await _apiClient.get<List<dynamic>>('items');
    return (response.data ?? []).map((e) => CatalogItem.fromJson(e as Map<String, dynamic>)).toList();
  }

  @override
  Future<List<CatalogCategory>> getCategories() async {
    final response = await _apiClient.get<List<dynamic>>('categories');
    return (response.data ?? []).map((e) => CatalogCategory.fromJson(e as Map<String, dynamic>)).toList();
  }

  @override
  Future<void> setAvailability(int itemId, bool isAvailable, {String? requestId}) async {
    await _apiClient.patch('items/$itemId/availability', data: {'isAvailable': isAvailable}, requestId: requestId);
  }
}

final catalogRepositoryProvider = Provider<CatalogRepository>((ref) {
  return ApiCatalogRepository(ref.read(catalogApiProvider));
});
