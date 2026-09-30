import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers/branch_provider.dart';
import '../../core/providers/locale_provider.dart';
import '../cart/models/cart_item.dart';
import 'models/menu_item.dart';
import 'services/menu_service.dart';

/// Every item on the branch's menu by id, to read an item's pairings
/// against; empty until the menu has loaded.
final menuByIdProvider = Provider<Map<int, MenuItem>>((ref) {
  final branchId = ref.watch(selectedBranchIdProvider);
  if (branchId == null) return const {};
  final grouped = ref.watch(groupedMenuItemsProvider((ref.watch(localeProvider), branchId))).value;
  if (grouped == null) return const {};
  return {
    for (final items in grouped.values)
      for (final item in items) item.id: item,
  };
});

/// What an item suggests alongside it ("goes well with"), in the business's
/// order: only what this branch sells right now, never the item itself, and
/// nothing already in the cart.
List<MenuItem> pairedFor(MenuItem item, Map<int, MenuItem> menu, List<CartItem> cart) {
  final inCart = cart.map((line) => line.productId).toSet();
  return [
    for (final id in item.pairedItemIds)
      if (menu[id] case final paired?)
        if (paired.isAvailable && paired.id != item.id && !inCart.contains(paired.id)) paired,
  ];
}

/// Whether an item can go in with one tap: it is on and nothing needs choosing.
bool canQuickAdd(MenuItem item) => item.isAvailable && !item.customizations.any((c) => c.isRequired);

/// The one suggestion the cart shows: the first pairing of the items in it,
/// the last added first, that goes in with one tap and was not waved away.
MenuItem? cartNudge(List<CartItem> cart, Map<int, MenuItem> menu, Set<int> dismissed) {
  for (final line in cart.reversed) {
    final item = menu[line.productId];
    if (item == null) continue;
    for (final paired in pairedFor(item, menu, cart)) {
      if (canQuickAdd(paired) && !dismissed.contains(paired.id)) return paired;
    }
  }
  return null;
}

/// A suggested item as a cart line: the business's defaults, nothing sold
/// out, one of it, saying where it was suggested.
CartItem suggestedLine(MenuItem item, String suggestion) {
  final choices = <SelectedCustomization>[
    for (final customization in item.customizations)
      for (final option in customization.options)
        if (option.isDefault && !option.isOutOfStock)
          SelectedCustomization(
            customizationId: customization.id,
            customizationName: customization.name,
            optionId: option.id,
            optionName: option.name,
            priceAdjustment: option.priceAdjustment,
          ),
  ];
  return CartItem.fromMenuItem(item, customizations: choices).copyWith(suggestion: suggestion);
}
