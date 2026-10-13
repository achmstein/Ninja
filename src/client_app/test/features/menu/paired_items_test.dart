import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/models/localized_text.dart';
import 'package:ninja_client/features/cart/models/cart_item.dart';
import 'package:ninja_client/features/menu/models/menu_item.dart';
import 'package:ninja_client/features/menu/models/user_preference.dart';
import 'package:ninja_client/features/menu/paired_items.dart';

MenuItem dish(int id, {List<int> paired = const [], bool available = true, List<ItemCustomization> customizations = const []}) => MenuItem(
      id: id,
      name: LocalizedText(en: 'Dish $id'),
      description: LocalizedText(en: ''),
      price: 10,
      catalogTypeId: 1,
      catalogTypeName: LocalizedText(en: 'Food'),
      isAvailable: available,
      pairedItemIds: paired,
      customizations: customizations,
    );

CartItem line(int productId) => CartItem(productId: productId, productName: LocalizedText(en: 'Dish $productId'), unitPrice: 10);

void main() {
  // A cappuccino goes with a waffle, then ice cream, then a cake that is sold out; a waffle goes with a milkshake that needs its size picked
  final size = ItemCustomization(
    id: 50,
    name: LocalizedText(en: 'Size'),
    isRequired: true,
    options: [
      CustomizationOption(id: 501, name: LocalizedText(en: 'Small'), isDefault: true),
      CustomizationOption(id: 502, name: LocalizedText(en: 'Large'), priceAdjustment: 10),
    ],
  );
  final cappuccino = dish(1, paired: [2, 3, 4]);
  final waffle = dish(2, paired: [5]);
  final iceCream = dish(3);
  final cake = dish(4, available: false);
  final milkshake = dish(5, customizations: [size]);
  final menu = {for (final d in [cappuccino, waffle, iceCream, cake, milkshake]) d.id: d};

  group('pairedFor', () {
    test("keeps the business's order and drops what this branch is out of", () {
      expect(pairedFor(cappuccino, menu, []).map((d) => d.id), [2, 3]);
    });

    test('leaves out what is already in the cart', () {
      expect(pairedFor(cappuccino, menu, [line(1), line(2)]).map((d) => d.id), [3]);
    });

    test('suggests nothing for an item that pairs with nothing, or with items gone from the menu', () {
      expect(pairedFor(iceCream, menu, []), isEmpty);
      expect(pairedFor(dish(9, paired: [99]), menu, []), isEmpty);
    });
  });

  group('cartNudge', () {
    test('offers a pairing of the item added last', () {
      expect(cartNudge([line(1)], menu)?.id, 2);
    });

    test('skips what needs a choice first', () {
      // The waffle's milkshake needs its size, so the cappuccino's ice cream is offered
      expect(cartNudge([line(1), line(2)], menu)?.id, 3);
    });

    test('offers nothing more once the cart holds something a suggestion added', () {
      expect(cartNudge([line(1), line(2).copyWith(suggestion: 'CartNudge')], menu), isNull);
      expect(cartNudge([line(1), line(3).copyWith(suggestion: 'Pairing')], menu), isNull);
    });

    test('offers nothing once the pairings are in the cart, or before there is one', () {
      expect(cartNudge([line(1), line(2), line(3)], menu), isNull);
      expect(cartNudge([], menu), isNull);
    });
  });

  group('canQuickAdd', () {
    UserItemPreference saved(int itemId, List<(int, int)> picks) => UserItemPreference(
      catalogItemId: itemId,
      lastUpdated: DateTime(2026),
      selectedOptions: [for (final (c, o) in picks) UserPreferenceOption(customizationId: c, optionId: o)],
    );
    final sugar = ItemCustomization(
      id: 60,
      name: LocalizedText(en: 'Sugar'),
      options: [CustomizationOption(id: 601, name: LocalizedText(en: 'None')), CustomizationOption(id: 602, name: LocalizedText(en: 'Some'))],
    );

    test('adds an item that is on and has nothing to choose', () {
      expect(canQuickAdd(iceCream), isTrue);
      expect(canQuickAdd(cake), isFalse);
    });

    test('opens an item with choices and no saved way, even optional ones', () {
      expect(canQuickAdd(dish(7, customizations: [sugar])), isFalse);
      expect(canQuickAdd(milkshake), isFalse);
    });

    test('adds with a saved way that still answers every required choice, and puts that way in', () {
      final shake = dish(5, customizations: [size, sugar]);
      expect(canQuickAdd(shake, saved(5, [(60, 602)])), isTrue, reason: 'the size falls back to its default');
      expect(canQuickAdd(shake, saved(5, [(50, 502)])), isTrue);
      expect(quickAddLine(shake, saved(5, [(50, 502)])).selectedCustomizations.map((c) => c.optionId), [502]);
      expect(canQuickAdd(dish(8, available: false, customizations: [sugar]), saved(8, [(60, 601)])), isFalse);
    });

    test('opens when a required choice has nothing left in stock', () {
      final soldOutSize = ItemCustomization(
        id: 70,
        name: LocalizedText(en: 'Size'),
        isRequired: true,
        options: [CustomizationOption(id: 701, name: LocalizedText(en: 'Small'), isOutOfStock: true)],
      );
      expect(canQuickAdd(dish(9, customizations: [soldOutSize]), saved(9, [(70, 701)])), isFalse);
    });
  });

  test('a suggested line takes the defaults and says where it was suggested', () {
    final added = suggestedLine(milkshake, 'CartNudge');

    expect(added.selectedCustomizations.map((c) => c.optionId), [501]);
    expect(added.toJson()['suggestion'], 'CartNudge');
    expect(line(1).toJson()['suggestion'], 'None');
  });
}
