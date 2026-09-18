import 'dart:ui' show Locale;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/auth/auth_service.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/network/api_client.dart';
import '../models/menu_item.dart';
import '../models/user_preference.dart';

/// Abstract interface for menu data access
abstract class MenuRepository {
  Future<List<MenuItem>> getMenuItems({int? categoryId});
  Future<MenuItem> getMenuItem(int id);
  Future<List<MenuCategory>> getCategories();
  Future<UserItemPreference?> getUserPreference(int catalogItemId);
  Future<List<UserItemPreference>> getUserPreferences(List<int> catalogItemIds);
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
  Future<List<MenuItem>> getMenuItems({int? categoryId}) async {
    final queryParams = <String, dynamic>{};
    if (categoryId != null) {
      queryParams['categoryId'] = categoryId;
    }

    final response = await _apiClient.get<List<dynamic>>(
      'items',
      queryParameters: queryParams,
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
  Future<List<MenuCategory>> getCategories() async {
    final response = await _apiClient.get<List<dynamic>>(
      'categories',
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

/// Provider for menu items
final menuItemsProvider = FutureProvider.family<List<MenuItem>, int?>(
  (ref, categoryId) async {
    final service = ref.watch(menuRepositoryProvider);
    return service.getMenuItems(categoryId: categoryId);
  },
);

/// Provider for categories — keyed by branch ID for clean state per branch
final categoriesProvider = FutureProvider.family<List<MenuCategory>, int>((ref, branchId) async {
  final service = ref.watch(menuRepositoryProvider);
  return service.getCategories();
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

/// The signed-in user's most-ordered items ("your usuals"), ranked. Empty for
/// a guest or a user without enough history, so the menu section hides.
final topMenuItemsProvider = FutureProvider<List<MenuItem>>((ref) async {
  if (!ref.watch(isAuthenticatedProvider)) return const [];
  final service = ref.watch(menuRepositoryProvider);
  final ids = await service.getMyTopItems();
  if (ids.isEmpty) return const [];
  final items = await service.getMenuItems();
  final byId = {for (final item in items) item.id: item};
  return [
    for (final id in ids)
      if (byId[id] != null) byId[id]!,
  ];
});

/// Provider for grouped menu items by category with localized names.
/// Keyed by (Locale, branchId) for clean state per branch.
final groupedMenuItemsProvider = FutureProvider.family<Map<MenuCategory, List<MenuItem>>, (Locale, int)>((ref, _) async {
  final service = ref.watch(menuRepositoryProvider);
  final categories = await service.getCategories();
  final items = await service.getMenuItems();

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
