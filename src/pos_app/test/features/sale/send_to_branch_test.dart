import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/features/deliveries/models/delivery_order.dart';
import 'package:pos_app/features/sale/models/pos_order_request.dart';
import 'package:pos_app/features/sale/models/sale_delivery.dart';
import 'package:pos_app/features/sale/models/sale_line.dart';
import 'package:pos_app/features/sale/services/price_check_service.dart';

void main() {
  const maadi = DeliveryAlternative(branchId: 2, distanceMeters: 1200, fee: 25, minimumOrder: 100);
  const delivery = SaleDelivery(address: 'Road 9', phone: '01001234567', latitude: 29.96, longitude: 31.26, sendTo: maadi);

  SaleLine line(int productId, double price, {List<int> options = const []}) => SaleLine(
        productId: productId,
        nameEn: 'Item $productId',
        nameAr: null,
        price: price,
        quantity: 2,
        customizations: [
          for (final id in options)
            SaleCustomization(customizationId: 1, customizationNameEn: 'Milk', optionId: id, optionNameEn: 'Option $id', priceAdjustment: 5),
        ],
      );

  group('the quote names the nearer branches', () {
    test('read from the till quote, paused ones flagged', () {
      final quote = TillDeliveryQuote.fromJson({
        'delivers': true,
        'alternatives': [
          {'branchId': 2, 'distanceMeters': 1200, 'fee': 25, 'minimumOrder': 100, 'paused': false},
          {'branchId': '3', 'distanceMeters': '2400', 'fee': '15', 'minimumOrder': 0, 'paused': true},
        ],
      });

      expect(quote.alternatives.map((a) => a.branchId), [2, 3]);
      expect(quote.alternatives.last.paused, isTrue);
      expect(quote.alternatives.last.fee, 15);
    });

    test('none from an older server', () {
      expect(TillDeliveryQuote.fromJson({'delivers': true}).alternatives, isEmpty);
    });
  });

  group('the chosen branch', () {
    test('stays while the pin stands and the branch is still offered, at its fee now', () {
      const now = DeliveryAlternative(branchId: 2, distanceMeters: 1200, fee: 30, paused: true);
      expect(keptSendTo(maadi, [now], pinned: true), same(now));
    });

    test('is dropped when the pin changes or the branch is no longer offered', () {
      expect(keptSendTo(maadi, [maadi], pinned: false), isNull);
      expect(keptSendTo(maadi, const [DeliveryAlternative(branchId: 3, distanceMeters: 900)], pinned: true), isNull);
      expect(keptSendTo(null, [maadi], pinned: true), isNull);
    });

    test("charges the delivering branch's fee, and is kept through a refresh", () {
      expect(delivery.feeWith(20), 25);
      expect(delivery.keptHere().feeWith(20), 20);
      expect(SaleDelivery.fromJson(delivery.toJson()).sendTo?.branchId, 2);
    });

    test('is named on the order, which carries no bill of this branch', () {
      final json = PosOrderRequest(lines: [line(1, 65)], delivery: delivery).toJson();
      expect(json['sendToBranchId'], 2);
      expect(json['ticketId'], isNull);
      expect(PosOrderRequest(lines: [line(1, 65)], delivery: delivery.keptHere()).toJson()['sendToBranchId'], isNull);
    });
  });

  group("the other branch's menu", () {
    test('is asked each line at its price with its options', () {
      expect(priceCheckLines([line(1, 70, options: [9])]), [
        {'itemId': 1, 'optionIds': [9], 'unitPrice': 70.0},
      ]);
    });

    test('agreeing, the cart goes as it is', () {
      final lines = [line(1, 65), line(2, 40)];
      final review = reviewPriceCheck(lines, const [PriceCheckResult(itemId: 1, price: 65), PriceCheckResult(itemId: 2, price: 40)]);
      expect(review.agrees, isTrue);
      expect(review.lines, lines);
    });

    test("a price that differs is listed and sent at the other branch's", () {
      final review = reviewPriceCheck([line(1, 65)], const [PriceCheckResult(itemId: 1, price: 70, changed: true)]);
      expect(review.items.single.kind, PriceReviewKind.changed);
      expect((review.items.single.from, review.items.single.to), (65, 70));
      expect(review.lines.single.price, 70);
      expect(review.lines.single.basePrice, 70);
    });

    test('what it ran out of, the item or one of its choices, is taken off', () {
      final review = reviewPriceCheck(
        [line(1, 65), line(2, 40, options: [9]), line(3, 30), line(4, 20)],
        const [
          PriceCheckResult(itemId: 1, price: 65),
          PriceCheckResult(itemId: 2, price: 45, soldOutOptionIds: [9]),
          PriceCheckResult(itemId: 3, price: 30, outOfStock: true),
          PriceCheckResult(itemId: 4, price: 0, available: false),
        ],
      );
      expect(review.items.map((i) => i.kind), [PriceReviewKind.optionsOut, PriceReviewKind.soldOut, PriceReviewKind.soldOut]);
      expect(review.items.first.optionIds, [9]);
      expect(review.lines.map((l) => l.productId), [1]);
    });

    test('reads a line the answer is missing as one it cannot make', () {
      final review = reviewPriceCheck([line(1, 65)], const []);
      expect(review.items.single.kind, PriceReviewKind.soldOut);
      expect(review.lines, isEmpty);
    });

    test('reads the server answer', () {
      final result = PriceCheckResult.fromJson({
        'itemId': 1, 'price': '70', 'basePrice': 65, 'available': true, 'outOfStock': false,
        'soldOutOptionIds': ['9'], 'changed': true, 'wouldPass': false,
      });
      expect(result.price, 70);
      expect(result.soldOutOptionIds, [9]);
      expect(result.changed, isTrue);
    });
  });

  test('a delivery card says where a sent order came from', () {
    final order = DeliveryOrder.fromJson({
      'orderNumber': 123,
      'total': 115,
      'takenByName': 'Sara',
      'takenAtBranchId': 1,
      'delivery': {'address': 'Road 9', 'phone': '01001234567', 'stage': 'Waiting'},
    });
    expect(order.sentFromAnotherBranch, isTrue);
    expect(order.takenByName, 'Sara');
    expect(DeliveryOrder.fromJson({'orderNumber': 1, 'total': 1, 'delivery': {'address': 'x', 'phone': 'y'}}).sentFromAnotherBranch, isFalse);
  });
}
