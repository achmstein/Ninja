import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/features/ticket/settle_action.dart';
import 'package:pos_app/features/tickets/models/enums.dart';

void main() {
  group('settleActionFor', () {
    test('takes all that is left in the way picked when nothing is typed', () {
      expect(settleActionFor(PaymentTender.cash, null, 180), (kind: SettleActionKind.take, amount: 180.0));
      expect(settleActionFor(PaymentTender.card, null, 180), (kind: SettleActionKind.take, amount: 180.0));
    });

    test('never puts an untyped amount on a tab', () {
      expect(settleActionFor(PaymentTender.account, null, 180).kind, SettleActionKind.none);
      expect(settleActionFor(PaymentTender.account, 60, 180), (kind: SettleActionKind.add, amount: 60.0));
    });

    test('adds a payment when less than what is left is typed', () {
      expect(settleActionFor(PaymentTender.cash, 100, 180), (kind: SettleActionKind.add, amount: 100.0));
      expect(settleActionFor(PaymentTender.cash, 0, 180).kind, SettleActionKind.none);
    });

    test('takes cash past what is owed, for the change, and anything else exactly', () {
      expect(settleActionFor(PaymentTender.cash, 200, 180), (kind: SettleActionKind.take, amount: 200.0));
      expect(settleActionFor(PaymentTender.card, 200, 180), (kind: SettleActionKind.take, amount: 180.0));
      expect(settleActionFor(PaymentTender.account, 200, 180), (kind: SettleActionKind.take, amount: 180.0));
    });

    test('closes a bill with nothing left to take', () {
      expect(settleActionFor(PaymentTender.cash, null, 0).kind, SettleActionKind.settle);
      expect(settleActionFor(PaymentTender.card, 50, 0).kind, SettleActionKind.settle);
    });
  });

  test('cash is offered as the notes what is left rounds up to, never the exact amount itself', () {
    expect(settleCashNotes(540), [550, 600, 1000]);
    expect(settleCashNotes(180), [200, 500]);
    expect(settleCashNotes(35), [50, 100, 200, 500]);
    expect(settleCashNotes(100), [200, 500]);
    expect(settleCashNotes(0), isEmpty);
  });
}
