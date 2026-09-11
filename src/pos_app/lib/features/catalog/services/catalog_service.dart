import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../models/catalog_item.dart';

/// What the till reads from the catalog: the menu to sell from, and the
/// sold-out switch. Editing items is the back office's job.
abstract class CatalogRepository {
  Future<List<CatalogItem>> getItems();
  Future<List<CatalogCategory>> getCategories();
  Future<void> setAvailability(int itemId, bool isAvailable, {String? requestId});

  /// A specific customer's saved choices for an item, as
  /// `customizationId -> [optionId, ...]`. Empty when the customer has no
  /// saved preference (or the lookup fails) — it must never block a sale.
  Future<Map<int, List<int>>> getCustomerItemPreference(String userId, int itemId);
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

  @override
  Future<Map<int, List<int>>> getCustomerItemPreference(String userId, int itemId) async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>('preferences/$itemId/for/$userId');
      final options = (response.data?['selectedOptions'] as List<dynamic>?) ?? const [];
      final result = <int, List<int>>{};
      for (final o in options) {
        final m = o as Map<String, dynamic>;
        final cid = (m['customizationId'] as num).toInt();
        final oid = (m['optionId'] as num).toInt();
        (result[cid] ??= <int>[]).add(oid);
      }
      return result;
    } catch (_) {
      // A miss (404) or any hiccup just leaves the item defaults in place.
      return const {};
    }
  }
}

final catalogRepositoryProvider = Provider<CatalogRepository>((ref) {
  return ApiCatalogRepository(ref.read(catalogApiProvider));
});
