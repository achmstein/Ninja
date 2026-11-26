import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/features/shifts/models/shift.dart';
import 'package:pos_app/features/tickets/models/enums.dart';

void main() {
  test('the drawer parts add up to what the server expects', () {
    // An 85 bill paid with 100: 15 change; a cash tab payment, a pay-in,
    // a pay-out and a cash refund
    final shift = ShiftView.fromJson({
      'id': 9,
      'status': 'Open',
      'openingFloat': 500,
      'salesTotal': 85,
      'grossSales': 85,
      'netSales': 75,
      'tenderTotals': [
        {'tender': 'Cash', 'amount': 85, 'count': 1, 'tendered': 100},
      ],
      'cashTendered': 100,
      'changeGiven': 15,
      'refundsTotal': 10,
      'cashRefunds': 10,
      'payInsTotal': 50,
      'payOutsTotal': 30,
      'tabPaymentsTotal': 40,
      'cashTabPayments': 40,
      'expectedInDrawer': 635,
    });

    expect(shift.cashTaken, 85);
    expect(shift.tenderTotals.single.tendered, 100);
    final drawer = shift.drawer;
    expect(drawer.lines.map((l) => (l.part, l.amount)), [
      (DrawerPart.openingFloat, 500.0),
      (DrawerPart.cashTaken, 85.0),
      (DrawerPart.cashTabPayments, 40.0),
      (DrawerPart.payIns, 50.0),
      (DrawerPart.payOuts, -30.0),
      (DrawerPart.cashRefunds, -10.0),
    ]);
    expect(drawer.total, 635);
    expect(drawer.addsUpTo(shift.expectedInDrawer), isTrue);
  });

  test('cash for parts of open bills goes in, and what was given back comes out', () {
    // A 100 bill settled in cash, two cash parts of bills still open (60 and
    // 40) and a card one (80, never the drawer's), and a 40 part given back
    final shift = ShiftView.fromJson({
      'id': 12,
      'status': 'Open',
      'openingFloat': 500,
      'salesTotal': 100,
      'tenderTotals': [
        {'tender': 'Cash', 'amount': 100, 'count': 1, 'tendered': 100},
      ],
      'cashTendered': 100,
      'changeGiven': 0,
      'payOutsTotal': 20,
      'partPaymentsTotal': 180,
      'cashPartPayments': 100,
      'partPaymentsReturned': 40,
      'cashPartPaymentsReturned': 40,
      'partPaymentTenderTotals': [
        {'tender': 'Cash', 'amount': 100, 'count': 2},
        {'tender': 'Card', 'amount': 80, 'count': 1},
      ],
      'expectedInDrawer': 640,
    });

    expect(shift.partPaymentsTotal, 180);
    expect(shift.cashPartPayments, 100);
    expect(shift.partPaymentsReturned, 40);
    expect(shift.cashPartPaymentsReturned, 40);
    expect(shift.partPaymentTenderTotals.map((t) => (t.tender, t.amount, t.count)), [
      (PaymentTender.cash, 100.0, 2),
      (PaymentTender.card, 80.0, 1),
    ]);
    final drawer = shift.drawer;
    expect(drawer.lines.map((l) => (l.part, l.amount)), [
      (DrawerPart.openingFloat, 500.0),
      (DrawerPart.cashTaken, 100.0),
      (DrawerPart.cashPartPayments, 100.0),
      (DrawerPart.cashPartPaymentsReturned, -40.0),
      (DrawerPart.payOuts, -20.0),
    ]);
    // 500 + 100 + 100 − 40 − 20
    expect(drawer.total, 640);
    expect(drawer.lines.fold<double>(0, (sum, l) => sum + l.amount), 640);
    expect(drawer.addsUpTo(shift.expectedInDrawer), isTrue);
  });

  test('a server from before part payments: no such rows, and the drawer still adds up', () {
    final shift = ShiftView.fromJson({
      'id': 13,
      'openingFloat': 200,
      'cashTendered': 50,
      'changeGiven': 0,
      'expectedInDrawer': 250,
    });
    expect(shift.partPaymentsTotal, 0);
    expect(shift.cashPartPayments, 0);
    expect(shift.partPaymentsReturned, 0);
    expect(shift.cashPartPaymentsReturned, 0);
    expect(shift.partPaymentTenderTotals, isEmpty);
    expect(shift.drawer.lines.map((l) => l.part), [DrawerPart.openingFloat, DrawerPart.cashTaken]);
    expect(shift.drawer.addsUpTo(shift.expectedInDrawer), isTrue);
  });

  test('parts that are nothing are left off, float and cash taken never', () {
    const drawer = DrawerFormula(openingFloat: 0, cashTaken: 0, cashTabPayments: 0, payIns: 0, payOuts: 0, cashRefunds: 0);
    expect(drawer.lines.map((l) => l.part), [DrawerPart.openingFloat, DrawerPart.cashTaken]);
    expect(drawer.total, 0);
  });

  test('a server from before the new fields still reads: gross cash row, net from refunds', () {
    final shift = ShiftView.fromJson({
      'id': 3,
      'salesTotal': 200,
      'refundsTotal': 20,
      'changeGiven': 5,
      'tenderTotals': [
        {'tender': 'Cash', 'amount': 105, 'count': 1},
        {'tender': 'Card', 'amount': 100, 'count': 1},
      ],
      'tabPaymentTenderTotals': [
        {'tender': 'Cash', 'amount': 30, 'count': 1},
        {'tender': 'Card', 'amount': 12, 'count': 1},
      ],
    });
    expect(shift.grossSales, 200);
    expect(shift.netSales, 180);
    expect(shift.cashTendered, 105);
    expect(shift.cashTaken, 100);
    expect(shift.cashTabPayments, 30);
    expect(shift.tabPaymentsTotal, 42);
  });

  test('a closed shift carries its late cash and the over/short with it', () {
    final shift = ShiftView.fromJson({
      'id': 4,
      'status': 'Closed',
      'openingFloat': 100,
      'cashTendered': 60,
      'changeGiven': 0,
      'closingCount': 160,
      'expectedCash': 100,
      'overShort': 60,
      'expectedInDrawer': 160,
      'lateCash': 60,
      'adjustedOverShort': 0,
    });
    expect(shift.expected, 100);
    expect(shift.lateCash, 60);
    expect(shift.adjustedOverShort, 0);
    // The parts reach the drawer with the late cash in it
    expect(shift.drawer.addsUpTo(shift.expectedInDrawer), isTrue);
    expect(shift.expected + shift.lateCash, shift.expectedInDrawer);
  });

  test('an open shift has no adjusted over/short', () {
    expect(ShiftView.fromJson({'id': 1}).adjustedOverShort, isNull);
  });

  test('a tender the till does not know is never taken for cash', () {
    expect(PaymentTender.fromName('Voucher'), PaymentTender.other);
    expect(PaymentTender.fromName(null), PaymentTender.other);
    expect(PaymentTender.fromName(''), PaymentTender.other);
    expect(PaymentTender.fromName('Cash'), PaymentTender.cash);
    expect(PaymentTender.fromName('Talabat'), PaymentTender.talabat);

    // An unknown tender's money stays out of the drawer's cash
    final shift = ShiftView.fromJson({
      'id': 2,
      'tenderTotals': [
        {'tender': 'Voucher', 'amount': 50, 'count': 1},
      ],
    });
    expect(shift.tenderTotals.single.tender, PaymentTender.other);
    expect(shift.cashTendered, 0);
  });
}
