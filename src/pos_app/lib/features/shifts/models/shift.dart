import '../../../core/models/money.dart';
import '../../tickets/models/enums.dart';
import 'drawer_formula.dart';

export 'drawer_formula.dart';

/// CashMovementType as Sales.Domain numbers it: PayIn=0, PayOut=1.
enum CashMovementType {
  payIn(0, 'PayIn'),
  payOut(1, 'PayOut');

  final int value;
  final String name_;

  const CashMovementType(this.value, this.name_);

  static CashMovementType fromName(String? name) =>
      name == CashMovementType.payOut.name_ ? CashMovementType.payOut : CashMovementType.payIn;
}

/// What a movement was for, as Sales.Domain numbers it. Wage and Advance
/// name an employee and reach Payroll; Supplier, Expense and Partner reach
/// Finance; Other is just a reason.
enum CashMovementKind {
  other(0),
  supplier(1),
  wage(2),
  advance(3),
  expense(4),
  partner(5);

  final int value;

  const CashMovementKind(this.value);

  /// What this kind needs the cashier to pick, if anything
  MovementPick? get picks => switch (this) {
        CashMovementKind.wage || CashMovementKind.advance => MovementPick.employee,
        CashMovementKind.supplier => MovementPick.supplier,
        CashMovementKind.partner => MovementPick.partner,
        CashMovementKind.expense => MovementPick.category,
        CashMovementKind.other => null,
      };

  /// The kinds a pay-out offers, and the kinds a pay-in offers
  static const List<CashMovementKind> forPayOut = [supplier, wage, advance, expense, partner, other];
  static const List<CashMovementKind> forPayIn = [partner, other];
}

/// The list a kind's picker shows
enum MovementPick { employee, supplier, partner, category }

/// Cash put into or taken out of the drawer mid-shift, with its reason
/// (Sales `CashMovementView`).
class CashMovementView {
  final CashMovementType type;
  final double amount;
  final String reason;
  final String recordedBy;
  final DateTime? recordedAt;

  const CashMovementView({
    required this.type,
    required this.amount,
    required this.reason,
    required this.recordedBy,
    this.recordedAt,
  });

  bool get isOut => type == CashMovementType.payOut;

  factory CashMovementView.fromJson(Map<String, dynamic> json) => CashMovementView(
        type: CashMovementType.fromName(json['type'] as String?),
        amount: toNumber(json['amount']),
        reason: json['reason'] as String? ?? '',
        recordedBy: json['recordedBy'] as String? ?? '',
        recordedAt: json['recordedAt'] == null ? null : DateTime.tryParse(json['recordedAt'] as String),
      );
}

/// What one tender took over the shift (Sales `TenderTotal`). [amount] is
/// what it paid towards the bills — cash net of the change handed back —
/// and [tendered] what was handed over (the same but for cash).
class TenderTotal {
  final PaymentTender tender;
  final double amount;
  final int count;
  final double tendered;

  const TenderTotal({required this.tender, required this.amount, required this.count, double? tendered})
      : tendered = tendered ?? amount;

  factory TenderTotal.fromJson(Map<String, dynamic> json) {
    final amount = toNumber(json['amount']);
    final tendered = json['tendered'] == null ? 0.0 : toNumber(json['tendered']);
    return TenderTotal(
      tender: PaymentTender.fromName(json['tender'] as String?),
      amount: amount,
      count: toInt(json['count']),
      // A server from before the field sends none (or 0): handed over is the amount
      tendered: tendered == 0 ? amount : tendered,
    );
  }
}

/// A drawer shift (Sales `ShiftView`): the live X while open, the frozen Z
/// once closed. Money figures are the server's.
class ShiftView {
  final int id;
  final String status;
  final DateTime? openedAt;
  final String? openedBy;
  final double openingFloat;
  final DateTime? closedAt;
  final String? closedBy;
  final double? closingCount;
  final double? expectedCash;
  final double? overShort;
  final List<CashMovementView> movements;
  final int ticketsSettled;

  /// Σ the settled tickets' totals, before refunds (the same as [grossSales])
  final double salesTotal;

  /// What the shift's bills came to, before refunds
  final double grossSales;

  /// [grossSales] less the refunds issued during the shift, all tenders
  final double netSales;
  final double netSalesExVat;
  final double vat;
  final double vatAdded;
  final double refundVat;

  /// The bills' payments by tender, cash net of the change handed back:
  /// they add up to [grossSales]
  final List<TenderTotal> tenderTotals;

  /// Cash handed over at settle, before the change went back
  final double cashTendered;
  final double changeGiven;

  /// Credit notes issued during the shift, every tender
  final double refundsTotal;

  /// Bill, line and loyalty discounts on the shift's tickets, as a positive number
  final double discounts;
  final double billDiscounts;
  final double lineDiscounts;
  final double loyaltyAndPromo;

  /// The part of [refundsTotal] that left the drawer as cash
  final double cashRefunds;
  final double payInsTotal;
  final double payOutsTotal;

  /// Money taken against tabs during the shift, all tenders, and the cash part
  final double tabPaymentsTotal;
  final double cashTabPayments;

  /// Money taken against tabs during the shift, by tender — beside the
  /// sales, never inside them
  final List<TenderTotal> tabPaymentTenderTotals;

  /// The drawer worked out from the shift's rows now; on a closed shift it
  /// is the frozen [expectedCash] plus any [lateCash]
  final double expectedInDrawer;

  /// Cash from sales rung up offline during the shift that reached the
  /// server after it closed: in the drawer when it was counted, not in the
  /// frozen [expectedCash]. Zero while open.
  final double lateCash;

  /// The count against the expectation with [lateCash] in it; null while open
  final double? adjustedOverShort;

  const ShiftView({
    required this.id,
    this.status = 'Open',
    this.openedAt,
    this.openedBy,
    this.openingFloat = 0,
    this.closedAt,
    this.closedBy,
    this.closingCount,
    this.expectedCash,
    this.overShort,
    this.movements = const [],
    this.ticketsSettled = 0,
    this.salesTotal = 0,
    double? grossSales,
    double? netSales,
    this.netSalesExVat = 0,
    this.vat = 0,
    this.vatAdded = 0,
    this.refundVat = 0,
    this.tenderTotals = const [],
    this.cashTendered = 0,
    this.changeGiven = 0,
    this.refundsTotal = 0,
    this.discounts = 0,
    this.billDiscounts = 0,
    this.lineDiscounts = 0,
    this.loyaltyAndPromo = 0,
    this.cashRefunds = 0,
    this.payInsTotal = 0,
    this.payOutsTotal = 0,
    this.tabPaymentsTotal = 0,
    this.cashTabPayments = 0,
    this.tabPaymentTenderTotals = const [],
    this.expectedInDrawer = 0,
    this.lateCash = 0,
    this.adjustedOverShort,
  })  : grossSales = grossSales ?? salesTotal,
        netSales = netSales ?? (grossSales ?? salesTotal) - refundsTotal;

  bool get isClosed => status == 'Closed';

  /// What the drawer should have held at close: the frozen figure when
  /// closed, the live one otherwise
  double get expected => expectedCash ?? expectedInDrawer;

  /// The cash the bills kept: handed over less the change given back
  double get cashTaken => cashTendered - changeGiven;

  /// The drawer, part by part — float + cash taken + cash tab payments +
  /// pay-ins − pay-outs − cash refunds — adding up to [expectedInDrawer]
  DrawerFormula get drawer => DrawerFormula(
        openingFloat: openingFloat,
        cashTaken: cashTaken,
        cashTabPayments: cashTabPayments,
        payIns: payInsTotal,
        payOuts: payOutsTotal,
        cashRefunds: cashRefunds,
      );

  factory ShiftView.fromJson(Map<String, dynamic> json) {
    DateTime? date(String key) => json[key] == null ? null : DateTime.tryParse(json[key] as String);
    double? optional(String key) => json[key] == null ? null : toNumber(json[key]);
    List<TenderTotal> tenders(String key) => ((json[key] as List<dynamic>?) ?? [])
        .map((e) => TenderTotal.fromJson(e as Map<String, dynamic>))
        .toList();
    double cashOf(List<TenderTotal> totals, double Function(TenderTotal) pick) =>
        totals.where((t) => t.tender == PaymentTender.cash).fold(0.0, (sum, t) => sum + pick(t));
    final tenderTotals = tenders('tenderTotals');
    final tabTenders = tenders('tabPaymentTenderTotals');
    return ShiftView(
      id: toInt(json['id']),
      status: json['status'] as String? ?? 'Open',
      openedAt: date('openedAt'),
      openedBy: json['openedBy'] as String?,
      openingFloat: toNumber(json['openingFloat']),
      closedAt: date('closedAt'),
      closedBy: json['closedBy'] as String?,
      closingCount: optional('closingCount'),
      expectedCash: optional('expectedCash'),
      overShort: optional('overShort'),
      movements: ((json['movements'] as List<dynamic>?) ?? [])
          .map((e) => CashMovementView.fromJson(e as Map<String, dynamic>))
          .toList(),
      ticketsSettled: toInt(json['ticketsSettled']),
      salesTotal: toNumber(json['salesTotal']),
      grossSales: optional('grossSales'),
      netSales: optional('netSales'),
      netSalesExVat: toNumber(json['netSalesExVat']),
      vat: toNumber(json['vat']),
      vatAdded: toNumber(json['vatAdded']),
      refundVat: toNumber(json['refundVat']),
      tenderTotals: tenderTotals,
      // A server from before the field: its cash row was what was handed over
      cashTendered: optional('cashTendered') ?? cashOf(tenderTotals, (t) => t.tendered),
      changeGiven: toNumber(json['changeGiven']),
      refundsTotal: toNumber(json['refundsTotal']),
      discounts: toNumber(json['discounts']),
      billDiscounts: toNumber(json['billDiscounts']),
      lineDiscounts: toNumber(json['lineDiscounts']),
      loyaltyAndPromo: toNumber(json['loyaltyAndPromo']),
      cashRefunds: toNumber(json['cashRefunds']),
      payInsTotal: toNumber(json['payInsTotal']),
      payOutsTotal: toNumber(json['payOutsTotal']),
      tabPaymentsTotal: optional('tabPaymentsTotal') ?? tabTenders.fold<double>(0, (sum, t) => sum + t.amount),
      cashTabPayments: optional('cashTabPayments') ?? cashOf(tabTenders, (t) => t.amount),
      tabPaymentTenderTotals: tabTenders,
      expectedInDrawer: toNumber(json['expectedInDrawer']),
      lateCash: toNumber(json['lateCash']),
      adjustedOverShort: optional('adjustedOverShort'),
    );
  }
}

/// `POST /api/shifts/{id}/movements`. The kind says what the money was
/// for; the id and name that go with it are whichever the kind picks
/// (see [CashMovementKind.picks]) — the name travels too so the Z report
/// reads without a lookup.
class CashMovementRequest {
  final CashMovementType type;
  final double amount;
  final String reason;
  final CashMovementKind kind;
  final int? employeeId;
  final String? employeeName;
  final int? supplierId;
  final String? supplierName;
  final int? partnerId;
  final String? partnerName;
  final int? categoryId;

  const CashMovementRequest({
    required this.type,
    required this.amount,
    required this.reason,
    this.kind = CashMovementKind.other,
    this.employeeId,
    this.employeeName,
    this.supplierId,
    this.supplierName,
    this.partnerId,
    this.partnerName,
    this.categoryId,
  });

  Map<String, dynamic> toJson() => {
        'type': type.value,
        'amount': amount,
        'reason': reason,
        'kind': kind.value,
        'employeeId': employeeId,
        'employeeName': employeeName,
        'supplierId': supplierId,
        'supplierName': supplierName,
        'partnerId': partnerId,
        'partnerName': partnerName,
        'categoryId': categoryId,
      };
}
