import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/features/cart/services/checkout_flow.dart';
import 'package:ninja_client/features/orders/models/order.dart';
import 'package:ninja_client/features/pay/models/pay_view.dart';
import 'package:ninja_client/features/pay/pay_ahead.dart';

// Paying ahead online (client_web's lib/pay-ahead.ts): what the checkout is
// told, what the customer carries, and how the dock follows such an order
void main() {
  group('the fee on an order paid ahead', () {
    test('is nothing where the business carries it', () {
      final options = PayAheadOptions.fromJson({'available': true, 'feeMode': 'Business', 'feePercent': 2.75, 'feeFixed': 3});
      expect(options.feeFor(200), 0);
    });

    test('covers what the provider keeps where the customer carries it, as Sales works it out', () {
      final options = PayAheadOptions.fromJson({'available': true, 'feeMode': 'Guest', 'feePercent': 2.75, 'feeFixed': 3});
      // (200 + 3) / (1 - 0.0275) = 208.74 charged
      expect(options.feeFor(200), 8.74);
      expect(PayAhead(offered: true, online: false, options: options).feeFor(200), 0, reason: 'paid in cash: no fee');
    });
  });

  group('an order paid ahead', () {
    Order order(String status, {bool paid = false}) => Order.fromJson({
          'orderNumber': 41,
          'date': '2026-10-06T10:00:00Z',
          'status': status,
          'total': 115,
          'paysOnline': true,
          'paidOnlineAt': paid ? '2026-10-06T10:01:00Z' : null,
          'paymentDueBy': '2026-10-06T10:20:00Z',
        });

    test('waits for its payment on the dock, with no clock of its own', () {
      final waiting = order('AwaitingPayment');
      expect(waiting.status, OrderStatus.awaitingPayment);
      expect(orderStageOf(waiting), OrderStage.awaitingPayment);
      expect(lingerOf(OrderStage.awaitingPayment), isNull);
      expect(waiting.paidAhead, isFalse);
      expect(waiting.paymentDueBy, DateTime.utc(2026, 10, 6, 10, 20));
    });

    test('once paid, it is with the business and nothing is owed at the door', () {
      final paid = order('Submitted', paid: true);
      expect(orderStageOf(paid), OrderStage.sent);
      expect(paid.paidAhead, isTrue);
    });

    test('is read as Sales says it stands', () {
      final due = OrderToPay.fromJson({
        'orderId': 41,
        'amount': 115,
        'fee': 3.29,
        'charged': 118.29,
        'currency': 'EGP',
        'status': 'Due',
        'dueBy': '2026-10-06T10:20:00Z',
        'holdsCards': true,
      });
      expect(due.isDue, isTrue);
      expect(due.charged, 118.29);
      expect(due.holdsCards, isTrue);

      final held = PaymentStatus.fromJson({'status': 'Authorized', 'orderId': 41, 'charged': 118.29});
      expect(held.isHeld, isTrue);
      expect(held.isSecured, isTrue, reason: 'a card held is money in');
      expect(held.orderId, 41);
      expect(PaymentStatus.fromJson({'status': 'Voided'}).isSecured, isFalse);
    });
  });
}
