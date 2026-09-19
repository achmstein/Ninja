import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/features/sale/models/sale_line.dart';
import 'package:pos_app/features/sale/providers/sale_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

SaleLine latte({int quantity = 1, List<SaleCustomization> customizations = const []}) => SaleLine(
      productId: 1,
      nameEn: 'Latte',
      nameAr: 'لاتيه',
      price: 55,
      quantity: quantity,
      customizations: customizations,
    );

const oat = SaleCustomization(
  customizationId: 2,
  customizationNameEn: 'Milk',
  optionId: 3,
  optionNameEn: 'Oat',
  priceAdjustment: 15,
);

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await initializeSale();
  });

  test('the same item merges into one line, a different option is another line', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final sale = container.read(saleProvider.notifier);

    sale.add(latte());
    sale.add(latte(quantity: 2));
    sale.add(latte(customizations: const [oat]));

    final lines = container.read(saleProvider).lines;
    expect(lines.length, 2);
    expect(lines.first.quantity, 3);
    expect(lines.last.customizations.single.optionId, 3);
    expect(saleTotal(lines), 3 * 55 + 55);
  });

  test('pointing the cart at another bill empties it; clearing keeps the target', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final sale = container.read(saleProvider.notifier);

    sale.setTarget(104);
    sale.add(latte());
    sale.setTarget(104);
    expect(container.read(saleProvider).lines, isNotEmpty);

    sale.setTarget(null);
    expect(container.read(saleProvider).lines, isEmpty);

    sale.add(latte());
    sale.setCustomer(const SaleCustomer(name: 'Sara'));
    sale.clear();
    final state = container.read(saleProvider);
    expect(state.lines, isEmpty);
    expect(state.customer, isNull);
    expect(state.target, isNull);
  });

  test('a persisted cart is whole before the first screen builds', () async {
    SharedPreferences.setMockInitialValues({
      'ninja-pos-sale': json.encode(
        SaleState(lines: [latte(quantity: 2)], note: 'no sugar', target: 104).toJson(),
      ),
    });
    await initializeSale();

    final container = ProviderContainer();
    addTearDown(container.dispose);
    final state = container.read(saleProvider);
    expect(state.target, 104);
    expect(state.note, 'no sugar');
    expect(state.lines.single.quantity, 2);
  });
}
