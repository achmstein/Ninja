import '../../../core/models/money.dart';
import '../../tickets/models/enums.dart';

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

/// What one tender took over the shift (Sales `TenderTotal`).
class TenderTotal {
  final PaymentTender tender;
  final double amount;
  final int count;

  const TenderTotal({required this.tender, required this.amount, required this.count});

  factory TenderTotal.fromJson(Map<String, dynamic> json) => TenderTotal(
        tender: PaymentTender.fromName(json['tender'] as String?),
        amount: toNumber(json['amount']),
        count: toInt(json['count']),
      );
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
  final double salesTotal;
  final List<TenderTotal> tenderTotals;
  final double changeGiven;
  final double refundsTotal;
  final double cashRefunds;
  final double payInsTotal;
  final double payOutsTotal;

  /// Money taken against tabs during the shift, by tender — beside the
  /// sales, never inside them
  final List<TenderTotal> tabPaymentTenderTotals;
  final double expectedInDrawer;

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
    this.tenderTotals = const [],
    this.changeGiven = 0,
    this.refundsTotal = 0,
    this.cashRefunds = 0,
    this.payInsTotal = 0,
    this.payOutsTotal = 0,
    this.tabPaymentTenderTotals = const [],
    this.expectedInDrawer = 0,
  });

  bool get isClosed => status == 'Closed';

  /// What the drawer should have held at close: the frozen figure when
  /// closed, the live one otherwise
  double get expected => expectedCash ?? expectedInDrawer;

  factory ShiftView.fromJson(Map<String, dynamic> json) {
    DateTime? date(String key) => json[key] == null ? null : DateTime.tryParse(json[key] as String);
    double? optional(String key) => json[key] == null ? null : toNumber(json[key]);
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
      tenderTotals: ((json['tenderTotals'] as List<dynamic>?) ?? [])
          .map((e) => TenderTotal.fromJson(e as Map<String, dynamic>))
          .toList(),
      changeGiven: toNumber(json['changeGiven']),
      refundsTotal: toNumber(json['refundsTotal']),
      cashRefunds: toNumber(json['cashRefunds']),
      payInsTotal: toNumber(json['payInsTotal']),
      payOutsTotal: toNumber(json['payOutsTotal']),
      tabPaymentTenderTotals: ((json['tabPaymentTenderTotals'] as List<dynamic>?) ?? [])
          .map((e) => TenderTotal.fromJson(e as Map<String, dynamic>))
          .toList(),
      expectedInDrawer: toNumber(json['expectedInDrawer']),
    );
  }
}

/// `POST /api/shifts/{id}/movements`
class CashMovementRequest {
  final CashMovementType type;
  final double amount;
  final String reason;

  const CashMovementRequest({required this.type, required this.amount, required this.reason});

  Map<String, dynamic> toJson() => {'type': type.value, 'amount': amount, 'reason': reason};
}
