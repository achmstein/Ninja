import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/models/branch.dart';
import 'package:ninja_client/core/models/localized_text.dart';
import 'package:ninja_client/features/cart/models/cart_item.dart';
import 'package:ninja_client/features/cart/services/order_move.dart';
import 'package:ninja_client/features/delivery/services/delivery_service.dart';
import 'package:ninja_client/features/menu/models/menu_item.dart';

CartItem _line(int productId, double unitPrice, {List<int> options = const [], double? original}) => CartItem(
      productId: productId,
      productName: LocalizedText(en: 'Dish $productId'),
      unitPrice: unitPrice,
      originalUnitPrice: original,
      selectedCustomizations: [
        for (final id in options)
          SelectedCustomization(
            customizationId: 1,
            customizationName: LocalizedText(en: 'Size'),
            optionId: id,
            optionName: LocalizedText(en: 'Option $id'),
            priceAdjustment: id == 2 ? 10 : 0,
          ),
      ],
    );

MenuItem _item(int id, double price,
        {bool available = true, bool outOfStock = false, bool onOffer = false, double? offerPrice, bool optionOut = false}) =>
    MenuItem(
      id: id,
      name: LocalizedText(en: 'Dish $id'),
      description: LocalizedText(en: ''),
      price: price,
      catalogTypeId: 1,
      catalogTypeName: LocalizedText(en: 'Mains'),
      isAvailable: available,
      isOutOfStock: outOfStock,
      isOnOffer: onOffer,
      offerPrice: offerPrice,
      customizations: [
        ItemCustomization(id: 1, name: LocalizedText(en: 'Size'), options: [
          CustomizationOption(id: 1, name: LocalizedText(en: 'Small')),
          CustomizationOption(id: 2, name: LocalizedText(en: 'Large'), priceAdjustment: 10, isOutOfStock: optionOut),
        ]),
      ],
    );

Branch _branch(int id, {bool active = true, bool ordering = true}) =>
    Branch(id: id, name: LocalizedText(en: 'B$id'), displayOrder: 0, isActive: active, isOrderingEnabled: ordering);

void main() {
  group('moving the order to another branch', () {
    test('keeps a line the branch serves at the same price as it was', () {
      final move = moveLines([_line(1, 50)], [_item(1, 50)]);
      expect(move.items, hasLength(1));
      expect(move.changed, isFalse);
    });

    test('takes the price there, and its offer', () {
      final move = moveLines([_line(1, 50, options: [2]), _line(3, 50)], [_item(1, 55), _item(3, 50, onOffer: true, offerPrice: 40)]);
      expect(move.items.map((l) => l.unitPrice), [55, 40]);
      expect(move.items.first.totalPrice, 65, reason: 'the option keeps its own price');
      expect(move.items.last.originalUnitPrice, 50);
      expect(move.repriced, hasLength(2));
    });

    test('drops a dish not served there, sold out there, or with an option sold out there', () {
      final move = moveLines(
        [_line(1, 50), _line(2, 50), _line(3, 50), _line(4, 50, options: [2]), _line(5, 50, options: [9])],
        [_item(2, 50, available: false), _item(3, 50, outOfStock: true), _item(4, 50, optionOut: true), _item(5, 50)],
      );
      expect(move.items, isEmpty);
      expect(move.dropped.map((l) => l.productId), [1, 2, 3, 4, 5]);
    });
  });

  group('the branch an address belongs to', () {
    test('is the nearest that reaches it and takes orders', () {
      final reaching = [(branchId: 2, meters: 900.0), (branchId: 1, meters: 2500.0)];
      expect(servingBranch(reaching, [_branch(1), _branch(2)])?.branchId, 2);
      expect(servingBranch(reaching, [_branch(1), _branch(2, ordering: false)])?.branchId, 1);
    });

    test('is none when nothing the customer can order from reaches it', () {
      expect(servingBranch([(branchId: 9, meters: 100.0)], [_branch(1)]), isNull);
      expect(servingBranch(const [], [_branch(1)]), isNull);
    });

    test('reads the server\'s answer', () {
      final resolution = DeliveryResolution.fromJson({
        'delivers': true,
        'branches': [
          {'branchId': 3, 'distanceMeters': 1200, 'fee': 20, 'minimumOrder': 100, 'signInRequired': false},
        ],
      });
      expect(resolution.delivers, isTrue);
      expect(resolution.branches.single, (branchId: 3, meters: 1200.0));
    });
  });
}
