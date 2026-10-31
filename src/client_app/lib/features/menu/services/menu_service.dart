import 'dart:ui' show Locale;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/network/api_client.dart';
import '../../../core/providers/branch_provider.dart';
import '../models/menu_item.dart';
import '../models/user_preference.dart';

/// Abstract interface for menu data access
abstract class MenuRepository {
  /// [branchId]: the branch whose menu (prices, what it serves) is asked for. A provider that caches
  /// the answer names it, so what it keeps is that branch's whatever the app is at when it refetches;
  /// left out, the branch the app is at
  Future<List<MenuItem>> getMenuItems({int? categoryId, int? branchId});
  Future<MenuItem> getMenuItem(int id);
  Future<List<MenuCategory>> getCategories({int? branchId});
  Future<UserItemPreference?> getUserPreference(int catalogItemId);
  Future<List<UserItemPreference>> getUserPreferences(List<int> catalogItemIds);
  Future<List<UserItemPreference>> getAllUserPreferences();
  Future<void> saveUserPreferences(SaveUserPreferencesRequest request);
  Future<List<int>> getFavorites();
  Future<void> addFavorite(int itemId);
  Future<void> removeFavorite(int itemId);
  Future<List<int>> getMyTopItems();
}

/// Menu repository backed by the catalog API
class ApiMenuRepository implements MenuRepository {
  final ApiClient _apiClient;

  ApiMenuRepository(this._apiClient);

  /// Get all menu items
  @override
  Future<List<MenuItem>> getMenuItems({int? categoryId, int? branchId}) async {
    final queryParams = <String, dynamic>{};
    if (categoryId != null) {
      queryParams['categoryId'] = categoryId;
    }

    final response = await _apiClient.get<List<dynamic>>(
      'items',
      queryParameters: queryParams,
      headers: branchId == null ? null : {'X-Branch-Id': '$branchId'},
    );

    return (response.data ?? [])
        .map((e) => MenuItem.fromJson(e as Map<String, dynamic>))
        .where((item) => item.isAvailable)
        .toList();
  }

  /// Get menu item by ID
  @override
  Future<MenuItem> getMenuItem(int id) async {
    final response = await _apiClient.get<Map<String, dynamic>>(
      'items/$id',
    );

    return MenuItem.fromJson(response.data!);
  }

  /// Get all categories
  @override
  Future<List<MenuCategory>> getCategories({int? branchId}) async {
    final response = await _apiClient.get<List<dynamic>>(
      'categories',
      headers: branchId == null ? null : {'X-Branch-Id': '$branchId'},
    );

    return (response.data ?? [])
        .map((e) => MenuCategory.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  /// Get user's preference for a specific item
  @override
  Future<UserItemPreference?> getUserPreference(int catalogItemId) async {
    try {
      final response = await _apiClient.get<Map<String, dynamic>>(
        'preferences/$catalogItemId',
      );

      if (response.data != null) {
        return UserItemPreference.fromJson(response.data!);
      }
      return null;
    } catch (e) {
      // Return null if no preference found (404) or any error
      return null;
    }
  }

  /// Get user's preferences for multiple items
  @override
  Future<List<UserItemPreference>> getUserPreferences(List<int> catalogItemIds) async {
    if (catalogItemIds.isEmpty) return [];

    try {
      final response = await _apiClient.post<List<dynamic>>(
        'preferences/batch',
        data: catalogItemIds,
      );

      return (response.data ?? [])
          .map((e) => UserItemPreference.fromJson(e as Map<String, dynamic>))
          .toList();
    } catch (e) {
      return [];
    }
  }

  /// Every item the user has a saved way of
  @override
  Future<List<UserItemPreference>> getAllUserPreferences() async {
    try {
      final response = await _apiClient.get<List<dynamic>>('preferences');
      return (response.data ?? []).map((e) => UserItemPreference.fromJson(e as Map<String, dynamic>)).toList();
    } catch (e) {
      return [];
    }
  }

  /// Save user's preferences after successful order
  @override
  Future<void> saveUserPreferences(SaveUserPreferencesRequest request) async {
    await _apiClient.post(
      'preferences',
      data: request.toJson(),
    );
  }

  /// Get user's favorite item IDs
  @override
  Future<List<int>> getFavorites() async {
    try {
      final response = await _apiClient.get<List<dynamic>>('favorites');
      return (response.data ?? []).map((e) => e as int).toList();
    } catch (e) {
      return [];
    }
  }

  /// Add an item to favorites
  @override
  Future<void> addFavorite(int itemId) async {
    await _apiClient.post('favorites/$itemId');
  }

  /// Remove an item from favorites
  @override
  Future<void> removeFavorite(int itemId) async {
    await _apiClient.delete('favorites/$itemId');
  }

  /// Get the current user's most-frequently-ordered item IDs, ranked
  @override
  Future<List<int>> getMyTopItems() async {
    try {
      final response = await _apiClient.get<List<dynamic>>('top-items');
      return (response.data ?? []).map((e) => e as int).toList();
    } catch (e) {
      return [];
    }
  }
}

/// Provider for menu repository
final menuRepositoryProvider = Provider<MenuRepository>((ref) {
  final apiClient = ref.watch(catalogApiProvider);
  return ApiMenuRepository(apiClient);
});

/// Notifier for selected category
class SelectedCategoryNotifier extends Notifier<int?> {
  @override
  int? build() => null;

  void select(int? categoryId) => state = categoryId;
}

/// Provider for selected category
final selectedCategoryProvider = NotifierProvider<SelectedCategoryNotifier, int?>(SelectedCategoryNotifier.new);

/// Provider for user's preference for a specific item
final userPreferenceProvider = FutureProvider.family<UserItemPreference?, int>(
  (ref, catalogItemId) async {
    final service = ref.watch(menuRepositoryProvider);
    return service.getUserPreference(catalogItemId);
  },
);

/// The signed-in user's saved way of each item (what they chose the last time
/// they ordered it), by item id: one request for the whole menu. Empty for a guest.
final itemPreferencesProvider = FutureProvider<Map<int, UserItemPreference>>((ref) async {
  if (!ref.watch(isAuthenticatedProvider)) return const {};
  final list = await ref.watch(menuRepositoryProvider).getAllUserPreferences();
  return {for (final preference in list) preference.catalogItemId: preference};
});

/// One item's saved way, or null (none, or not loaded yet); an item rebuilds only when its own changes
final itemPreferenceProvider = Provider.family<UserItemPreference?, int>((ref, id) => ref.watch(itemPreferencesProvider).value?[id]);

/// The signed-in user's most-ordered items ("your usuals"), ranked. Empty for
/// a guest or a user without enough history, so the menu section hides.
/// The branch the app is at: its prices, and only what it serves.
final topMenuItemsProvider = FutureProvider<List<MenuItem>>((ref) async {
  if (!ref.watch(isAuthenticatedProvider)) return const [];
  final branchId = ref.watch(selectedBranchIdProvider);
  if (branchId == null) return const [];
  final service = ref.watch(menuRepositoryProvider);
  final ids = await service.getMyTopItems();
  if (ids.isEmpty) return const [];
  final items = await service.getMenuItems(branchId: branchId);
  final byId = {for (final item in items) item.id: item};
  return [
    for (final id in ids)
      if (byId[id] != null) byId[id]!,
  ];
});

/// Provider for grouped menu items by category with localized names.
/// Keyed by (Locale, branchId), and asked of that branch by name: what one
/// key keeps is that branch's menu, whichever branch the app is at when it refetches.
final groupedMenuItemsProvider = FutureProvider.family<Map<MenuCategory, List<MenuItem>>, (Locale, int)>((ref, key) async {
  final branchId = key.$2;
  final service = ref.watch(menuRepositoryProvider);
  final categories = await service.getCategories(branchId: branchId);
  final items = await service.getMenuItems(branchId: branchId);

  final grouped = <MenuCategory, List<MenuItem>>{};

  // Add "Most Popular" section at the top if there are popular items
  final popularItems = items.where((item) => item.isPopular).toList();
  if (popularItems.isNotEmpty) {
    final popularCategory = MenuCategory(
      id: -1,
      name: LocalizedText(en: 'Most Popular', ar: 'الأكثر طلباً'),
      displayOrder: -1,
    );
    grouped[popularCategory] = popularItems;
  }

  for (final category in categories) {
    final categoryItems = items.where((item) => item.catalogTypeId == category.id).toList();
    if (categoryItems.isNotEmpty) {
      grouped[category] = categoryItems;
    }
  }
  return grouped;
});
