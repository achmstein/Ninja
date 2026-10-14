import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import '../models/catalog_item.dart';
import '../services/catalog_service.dart';

String _itemsKey(int? branchId) => 'pos.catalog.items.${branchId ?? 0}';
String _categoriesKey(int? branchId) => 'pos.catalog.categories.${branchId ?? 0}';

/// Fetch a list and keep it on the till, so a till started without the
/// internet still has the branch's menu to sell from. When the fetch fails
/// the last copy kept stands in; with none, the failure stands.
Future<List<T>> _fetchKept<T>(
  String key,
  Future<List<T>> Function() fetch,
  Map<String, dynamic> Function(T) toJson,
  T Function(Map<String, dynamic>) fromJson,
) async {
  final prefs = await SharedPreferences.getInstance();
  try {
    final fresh = await fetch();
    await prefs.setString(key, json.encode([for (final e in fresh) toJson(e)]));
    return fresh;
  } catch (_) {
    final kept = prefs.getString(key);
    if (kept == null) rethrow;
    return [for (final e in json.decode(kept) as List<dynamic>) fromJson(e as Map<String, dynamic>)];
  }
}

/// The menu for the active branch (prices and availability are per branch,
/// carried by the X-Branch-Id header). Refreshed on the hub's
/// `CatalogChanged` — an item marked sold out on another till.
class CatalogItemsNotifier extends AsyncNotifier<List<CatalogItem>> {
  @override
  Future<List<CatalogItem>> build() async {
    final branchId = ref.watch(selectedBranchIdProvider);
    return _fetch(branchId);
  }

  Future<List<CatalogItem>> _fetch(int? branchId) => _fetchKept(
        _itemsKey(branchId),
        ref.read(catalogRepositoryProvider).getItems,
        (item) => item.toJson(),
        CatalogItem.fromJson,
      );

  Future<void> refresh() async {
    final result = await AsyncValue.guard(() => _fetch(ref.read(selectedBranchIdProvider)));
    if (!ref.mounted) return;
    if (result.hasValue) state = result;
  }

  /// Flip sold-out on the spot and put it back if the server disagrees
  Future<bool> setAvailability(int itemId, bool isAvailable) async {
    final before = state.value;
    if (before != null) {
      state = AsyncData([
        for (final item in before)
          if (item.id == itemId)
            CatalogItem(
              id: item.id,
              name: item.name,
              description: item.description,
              price: item.price,
              effectivePrice: item.effectivePrice,
              pictureUri: item.pictureUri,
              catalogTypeId: item.catalogTypeId,
              isAvailable: isAvailable,
              displayOrder: item.displayOrder,
              customizations: item.customizations,
            )
          else
            item,
      ]);
    }
    try {
      await ref.read(catalogRepositoryProvider).setAvailability(itemId, isAvailable);
      return true;
    } catch (_) {
      if (before != null && ref.mounted) state = AsyncData(before);
      return false;
    }
  }
}

final catalogItemsProvider =
    AsyncNotifierProvider<CatalogItemsNotifier, List<CatalogItem>>(CatalogItemsNotifier.new);

final catalogCategoriesProvider = FutureProvider<List<CatalogCategory>>((ref) async {
  final branchId = ref.watch(selectedBranchIdProvider);
  final categories = await _fetchKept(
    _categoriesKey(branchId),
    ref.read(catalogRepositoryProvider).getCategories,
    (category) => category.toJson(),
    CatalogCategory.fromJson,
  );
  return [...categories]..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
});

/// The attached customer's most-ordered item ids, ranked — their "usuals".
/// Empty for a customer without enough history; the sale pad hides the row.
final customerTopItemsProvider = FutureProvider.family<List<int>, String>((ref, userId) async {
  ref.watch(selectedBranchIdProvider);
  return ref.read(catalogRepositoryProvider).getCustomerTopItems(userId);
});
