import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:pos_app/features/catalog/models/catalog_item.dart';
import 'package:pos_app/features/sale/models/pos_order_request.dart';
import 'package:pos_app/features/sale/models/sale_line.dart';
import 'package:pos_app/features/sale/till_suggestions.dart';

CatalogItem dish(int id, {List<int> paired = const [], bool available = true}) => CatalogItem(
      id: id,
      name: LocalizedText(en: 'Dish $id'),
      price: 10,
      catalogTypeId: 1,
      isAvailable: available,
      pairedItemIds: paired,
    );

SaleLine line(int productId, {String? suggestion}) =>
    SaleLine(productId: productId, nameEn: 'Dish $productId', nameAr: null, price: 10, suggestion: suggestion);

void main() {
  // A cappuccino goes with a waffle, then ice cream, then a cake that is sold out
  final cappuccino = dish(1, paired: [2, 3, 4]);
  final menu = [cappuccino, dish(2), dish(3), dish(4, available: false)];

  test("offers what the last dish goes well with, in the business's order, and nothing sold out", () {
    expect(tillSuggestions(cappuccino, menu, [line(1)]).map((d) => d.id), [2, 3]);
  });

  test('leaves out what is already on the sale', () {
    expect(tillSuggestions(cappuccino, menu, [line(1), line(2)]).map((d) => d.id), [3]);
  });

  test('offers nothing before a dish is rung up, or once the sale is empty', () {
    expect(tillSuggestions(null, menu, [line(1)]), isEmpty);
    expect(tillSuggestions(cappuccino, menu, []), isEmpty);
  });

  test('a suggested line says so to Ordering and survives the offline queue', () {
    final suggested = line(2, suggestion: 'Till');
    final item = (PosOrderRequest(lines: [suggested, line(1)]).toJson()['items'] as List).cast<Map<String, dynamic>>();

    expect(item.map((i) => i['suggestion']), ['Till', 'None']);
    expect(SaleLine.fromJson(suggested.toJson()).suggestion, 'Till');
    expect(line(1).suggested().suggestion, 'Till');
  });
}
