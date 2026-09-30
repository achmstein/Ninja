import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/features/sale/models/pos_order_request.dart';
import 'package:pos_app/features/sale/models/sale_line.dart';

void main() {
  // 50 and a +10 large: the pad shows 60 a cup
  const large = SaleLine(
    productId: 1,
    nameEn: 'Latte',
    nameAr: 'لاتيه',
    price: 60,
    quantity: 2,
    customizations: [
      SaleCustomization(customizationId: 3, customizationNameEn: 'Size', optionId: 9, optionNameEn: 'Large', priceAdjustment: 10),
    ],
  );

  test('a line goes out before its options, which Ordering adds back on', () {
    final item = (PosOrderRequest(lines: [large]).toJson()['items'] as List).single as Map<String, dynamic>;

    expect(item['unitPrice'], 50);
    expect((item['selectedCustomizations'] as List).single['priceAdjustment'], 10);
  });

  test('a line with nothing chosen goes out at its price', () {
    const tea = SaleLine(productId: 2, nameEn: 'Tea', nameAr: 'شاي', price: 20);

    expect(tea.basePrice, 20);
    expect(large.basePrice, 50);
    expect(large.total, 120, reason: 'what the pad shows is unchanged');
  });
}
