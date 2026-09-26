import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/features/ticket/tenders.dart';
import 'package:pos_app/features/tickets/models/enums.dart';
import 'package:pos_app/features/tickets/models/online_payment.dart';
import 'package:pos_app/l10n/app_localizations_en.dart';

/// Pay at table on the till: an Online tender is its own money, never the
/// drawer's cash, and the online list says what is paid and who is paying.
void main() {
  test('an Online tender reads as online, not as the cash a stranger would default to', () {
    expect(PaymentTender.fromName('Online'), PaymentTender.online);
    expect(PaymentTender.online.value, 4);
    expect(tenderLabel(AppLocalizationsEn(), PaymentTender.online), 'Online');
  });

  test('the till never offers Online itself', () {
    expect(baseTenders, isNot(contains(PaymentTender.online)));
  });

  test('an online payment reads as the server lists it', () {
    final payment = OnlinePaymentView.fromJson({
      'key': '5d0c3a3e-5b1c-4c55-9c1f-6a4b3c2d1e0f',
      'mode': 'Equal',
      'payerName': 'Sara',
      'amount': 33.34,
      'fee': 1.2,
      'tip': '5',
      'status': 'Paid',
      'createdAt': '2026-09-26T10:00:00Z',
      'paidAt': '2026-09-26T10:01:00Z',
      'transactionId': '123',
      'refundedAt': null,
    });
    expect(payment.payerName, 'Sara');
    expect(payment.amount, 33.34);
    expect(payment.tip, 5);
    expect(payment.isPaid, isTrue);
    expect(payment.paidAt, DateTime.utc(2026, 9, 26, 10, 1));
  });

  test('paid online counts shares that landed, never tips, pending or refunded ones', () {
    const payments = [
      OnlinePaymentView(key: 'a', amount: 40, tip: 5, status: 'Paid'),
      OnlinePaymentView(key: 'b', amount: 30, status: 'Pending'),
      OnlinePaymentView(key: 'c', amount: 20, status: 'Refunded'),
      OnlinePaymentView(key: 'd', amount: 10.5, status: 'Paid'),
    ];
    expect(payments.paidOnline, 50.5);
    expect(payments.anyPending, isTrue);
    expect(payments.where((p) => !p.isPending).toList().anyPending, isFalse);
  });
}
