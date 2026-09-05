import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/providers/branch_provider.dart';
import '../models/catalog_item.dart';
import '../services/catalog_service.dart';

/// The menu for the active branch (prices and availability are per branch,
/// carried by the X-Branch-Id header). Refreshed on the hub's
/// `CatalogChanged` — an item marked sold out on another till.
class CatalogItemsNotifier extends AsyncNotifier<List<CatalogItem>> {
  @override
  Future<List<CatalogItem>> build() async {
    ref.watch(selectedBranchIdProvider);
    return ref.read(catalogRepositoryProvider).getItems();
  }

  Future<void> refresh() async {
    final result = await AsyncValue.guard(() => ref.read(catalogRepositoryProvider).getItems());
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
  ref.watch(selectedBranchIdProvider);
  final categories = await ref.read(catalogRepositoryProvider).getCategories();
  return [...categories]..sort((a, b) => a.displayOrder.compareTo(b.displayOrder));
});
