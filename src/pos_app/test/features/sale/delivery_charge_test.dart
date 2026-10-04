import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/features/sale/models/sale_delivery.dart';

DeliveryCharge _charge({bool hasDelivery = true, bool addingToTicket = false, bool featureOn = true, bool known = true, bool failed = false, bool delivers = true}) =>
    deliveryCharge(hasDelivery: hasDelivery, addingToTicket: addingToTicket, featureOn: featureOn, termsKnown: known, termsFailed: failed, delivers: delivers);

void main() {
  test('a delivery the branch confirms goes out with a rider', () {
    expect(_charge(), DeliveryCharge.ready);
    expect(deliveryBlocksCharge(_charge()), isFalse);
  });

  test('a delivery on the sale is never quietly charged as a counter sale', () {
    expect(_charge(known: false), DeliveryCharge.checking);
    expect(_charge(known: false, failed: true), DeliveryCharge.failed);
    expect(_charge(delivers: false), DeliveryCharge.notOffered);
    expect(_charge(featureOn: false), DeliveryCharge.notOffered);
    for (final blocked in [_charge(known: false), _charge(known: false, failed: true), _charge(delivers: false)]) {
      expect(deliveryBlocksCharge(blocked), isTrue);
    }
  });

  test('no delivery, or a round on an open bill, is an ordinary charge', () {
    expect(_charge(hasDelivery: false), DeliveryCharge.none);
    expect(_charge(addingToTicket: true, known: false), DeliveryCharge.none);
    expect(deliveryBlocksCharge(DeliveryCharge.none), isFalse);
  });
}
