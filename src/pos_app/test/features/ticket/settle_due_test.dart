import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/features/ticket/screens/settle_screen.dart';
import 'package:pos_app/features/tickets/models/enums.dart';
import 'package:pos_app/features/tickets/models/settle.dart';
import 'package:pos_app/features/tickets/models/ticket_detail.dart';

/// The settle takes only what is left, and the receipt printed right after
/// it lists every payment the bill had.
void main() {
  test('the till takes the total less what was paid online and what was taken in parts', () {
    expect(settleDue(300), 300);
    expect(settleDue(300, onlinePaid: 100), 200);
    expect(settleDue(300, partPaid: 120), 180);
    expect(settleDue(300, onlinePaid: 100, partPaid: 120.5), 79.5);
    // To the piastre, whatever the floats make of it
    expect(settleDue(100.1, partPaid: 33.4, onlinePaid: 33.3), 33.4);
  });

  test('nothing is due once the parts and the phones cover the bill, never less than nothing', () {
    expect(settleDue(300, onlinePaid: 180, partPaid: 120), 0);
    expect(settleDue(300, onlinePaid: 200, partPaid: 120), 0);
  });

  test('the receipt lists the tenders just taken, then the parts, then what was paid online', () {
    final payments = receiptPayments(
      const [SettlePayment(tender: PaymentTender.cash, amount: 80)],
      partPayments: const [
        PartPayment(id: 4, tender: PaymentTender.card, amount: 120, payerName: 'Sara'),
        PartPayment(id: 5, tender: PaymentTender.cash, amount: 50),
      ],
      onlinePaid: 50,
    );
    expect(payments.map((p) => (p.tender, p.amount, p.customerName)), [
      (PaymentTender.cash, 80.0, null),
      (PaymentTender.card, 120.0, 'Sara'),
      (PaymentTender.cash, 50.0, null),
      (PaymentTender.online, 50.0, null),
    ]);
    // They add up to the bill
    expect(payments.fold<double>(0, (sum, p) => sum + p.amount), 300);
  });

  test('a bill with no parts and nothing online prints only what the till took', () {
    const taken = [SettlePayment(tender: PaymentTender.card, amount: 300)];
    expect(receiptPayments(taken), hasLength(1));
    expect(receiptPayments(taken).single.tender, PaymentTender.card);
  });
}
