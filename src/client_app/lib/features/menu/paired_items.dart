import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../core/providers/branch_provider.dart';
import '../../core/providers/locale_provider.dart';
import '../cart/models/cart_item.dart';
import 'models/menu_item.dart';
import 'models/user_preference.dart';
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

/// Whether an item can go in with one tap (the plus, a held press): it is on,
/// and either it has nothing to choose at all or the customer has a saved way
/// of it that still answers every required choice. Anything else opens, so
/// nobody gets a dish made a way they did not pick (client_web's canQuickAdd).
bool canQuickAdd(MenuItem item, [UserItemPreference? preference]) {
  if (!item.isAvailable) return false;
  if (item.customizations.isEmpty) return true;
  if (preference == null || preference.selectedOptions.isEmpty) return false;
  final picked = _quickChoices(item, preference);
  return item.customizations.every((c) => !c.isRequired || picked.any((s) => s.customizationId == c.id));
}

/// What a dish goes in with untouched: per choice the customer's saved
/// options where they still exist, else the business's defaults; nothing sold out
List<SelectedCustomization> _quickChoices(MenuItem item, UserItemPreference? preference) => [
  for (final customization in item.customizations)
    for (final option in _picks(customization, preference))
      if (!option.isOutOfStock)
        SelectedCustomization(
          customizationId: customization.id,
          customizationName: customization.name,
          optionId: option.id,
          optionName: option.name,
          priceAdjustment: option.priceAdjustment,
        ),
];

Iterable<CustomizationOption> _picks(ItemCustomization customization, UserItemPreference? preference) {
  final saved = {
    for (final o in preference?.selectedOptions ?? const <UserPreferenceOption>[])
      if (o.customizationId == customization.id) o.optionId,
  };
  final chosen = customization.options.where((o) => saved.contains(o.id));
  return chosen.isNotEmpty ? chosen : customization.options.where((o) => o.isDefault);
}

/// At most this many suggestions on an item's sheet: a few to glance at, never a second menu.
const maxOnSheet = 3;

/// The one suggestion the cart offers, once: the first pairing of the items
/// in it, the last added first, that goes in with one tap. None once the
/// cart holds anything a suggestion added, so taking one never brings on
/// the next; the customer saying "not now" is kept by the caller.
MenuItem? cartNudge(List<CartItem> cart, Map<int, MenuItem> menu, [Map<int, UserItemPreference> preferences = const {}]) {
  if (cart.any((line) => line.suggestion != null)) return null;
  for (final line in cart.reversed) {
    final item = menu[line.productId];
    if (item == null) continue;
    for (final paired in pairedFor(item, menu, cart)) {
      if (canQuickAdd(paired, preferences[paired.id])) return paired;
    }
  }
  return null;
}

/// A suggested item as a cart line: the customer's saved way (else the
/// business's defaults), nothing sold out, one of it, saying where it was suggested.
CartItem suggestedLine(MenuItem item, String suggestion, [UserItemPreference? preference]) =>
    quickAddLine(item, preference).copyWith(suggestion: suggestion);

/// The line a tap on a dish's plus (or a held press) adds: the customer's
/// saved way (else the business's defaults), nothing sold out, one of it
/// (client_web's quickAddChoice)
CartItem quickAddLine(MenuItem item, [UserItemPreference? preference]) =>
    CartItem.fromMenuItem(item, customizations: _quickChoices(item, preference));
