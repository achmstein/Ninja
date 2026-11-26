/// One part of the drawer sum, in the order the report prints it
enum DrawerPart {
  openingFloat,
  cashTaken,
  cashTabPayments,
  cashPartPayments,
  cashPartPaymentsReturned,
  payIns,
  payOuts,
  cashRefunds,
}

class DrawerLine {
  final DrawerPart part;

  /// Signed: what this part adds to (or, negative, takes from) the drawer
  final double amount;

  const DrawerLine(this.part, this.amount);

  bool get isOut => amount < 0;
}

/// What the drawer should hold, part by part, the way Sales works it out:
/// float + cash taken at settle (net of the change handed back) + cash tab
/// payments + cash for parts of open bills − part payments given back +
/// pay-ins − pay-outs − cash refunds. Printed in full so the lines add up
/// to the expected figure in front of the cashier.
class DrawerFormula {
  final double openingFloat;
  final double cashTaken;
  final double cashTabPayments;

  /// Cash taken for part of a bill still open: in the drawer from the
  /// moment it was taken
  final double cashPartPayments;

  /// Cash part payments given back during the shift, as a positive number
  final double cashPartPaymentsReturned;
  final double payIns;
  final double payOuts;
  final double cashRefunds;

  const DrawerFormula({
    required this.openingFloat,
    required this.cashTaken,
    required this.cashTabPayments,
    this.cashPartPayments = 0,
    this.cashPartPaymentsReturned = 0,
    required this.payIns,
    required this.payOuts,
    required this.cashRefunds,
  });

  /// Every part, float and cash taken always, the rest only when non-zero
  List<DrawerLine> get lines => [
        DrawerLine(DrawerPart.openingFloat, openingFloat),
        DrawerLine(DrawerPart.cashTaken, cashTaken),
        if (cashTabPayments != 0) DrawerLine(DrawerPart.cashTabPayments, cashTabPayments),
        if (cashPartPayments != 0) DrawerLine(DrawerPart.cashPartPayments, cashPartPayments),
        if (cashPartPaymentsReturned != 0) DrawerLine(DrawerPart.cashPartPaymentsReturned, -cashPartPaymentsReturned),
        if (payIns != 0) DrawerLine(DrawerPart.payIns, payIns),
        if (payOuts != 0) DrawerLine(DrawerPart.payOuts, -payOuts),
        if (cashRefunds != 0) DrawerLine(DrawerPart.cashRefunds, -cashRefunds),
      ];

  /// The sum of the parts, to the piastre
  double get total => _round2(openingFloat +
      cashTaken +
      cashTabPayments +
      cashPartPayments -
      cashPartPaymentsReturned +
      payIns -
      payOuts -
      cashRefunds);

  /// Whether the parts reach the server's own figure
  bool addsUpTo(double expected) => (total - expected).abs() < 0.005;

  static double _round2(double value) => (value * 100).roundToDouble() / 100;
}
