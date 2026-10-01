import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/models/localized_text.dart';
import 'package:ninja_client/features/cart/models/cart_item.dart';
import 'package:ninja_client/features/cart/services/cart_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The order is kept on the phone, as the web keeps it: a reload finds the
/// tray as it was left, and a placed (emptied) order is not brought back.

final _latte = CartItem(
  productId: 2,
  productName: const LocalizedText(en: 'Latte', ar: 'لاتيه'),
  unitPrice: 50,
  originalUnitPrice: 60,
  pictureUri: 'https://example.com/latte.webp',
  quantity: 2,
  specialInstructions: 'Oat milk',
  selectedCustomizations: [
    SelectedCustomization(
      customizationId: 1,
      customizationName: const LocalizedText(en: 'Size'),
      optionId: 3,
      optionName: const LocalizedText(en: 'Large'),
      priceAdjustment: 10,
    ),
  ],
  suggestion: 'Pairing',
);

Future<Cart> _reopened() async {
  final container = ProviderContainer();
  addTearDown(container.dispose);
  container.read(cartProvider);
  // The stored order is read as the cart starts
  await Future<void>.delayed(const Duration(milliseconds: 10));
  return container.read(cartProvider);
}

void main() {
  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('an order put together is there again after a reload, every field of it', () async {
    final first = ProviderContainer();
    first.read(cartProvider.notifier).addItem(_latte);
    await Future<void>.delayed(const Duration(milliseconds: 10));
    first.dispose();

    final cart = await _reopened();
    final item = cart.items.single;
    expect(item.productName.en, 'Latte');
    expect(item.productName.ar, 'لاتيه');
    expect(item.quantity, 2);
    expect(item.originalUnitPrice, 60);
    expect(item.pictureUri, 'https://example.com/latte.webp');
    expect(item.specialInstructions, 'Oat milk');
    expect(item.selectedCustomizations.single.optionName.en, 'Large');
    expect(item.suggestion, 'Pairing');
    expect(cart.totalPrice, 120);
  });

  test('a placed order, emptied, is not brought back', () async {
    final first = ProviderContainer();
    first.read(cartProvider.notifier).addItem(_latte);
    first.read(cartProvider.notifier).clear();
    await Future<void>.delayed(const Duration(milliseconds: 10));
    first.dispose();

    expect((await _reopened()).isEmpty, isTrue);
  });

  test('a stored order this version cannot read starts the tray empty', () async {
    SharedPreferences.setMockInitialValues({'ninja-cart': 'not json'});
    expect((await _reopened()).isEmpty, isTrue);
  });
}
