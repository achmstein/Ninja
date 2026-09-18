import '../../../core/models/localized_text.dart';
import '../../places/models/place.dart';

/// A bill as the customer sees it: the till's arithmetic, none of the
/// till's names. One per Sales ticket the customer is on, open or closed.
class Bill {
  final int id;

  /// "Room" or "Cafe"
  final String type;

  /// "Open", "Settled" or "Voided"
  final String status;
  final int branchId;
  final int? placeId;
  final PlaceKind? placeKind;
  final LocalizedText? locationName;

  /// The stay this bill charges the time of, when it is a timed place's
  final int? sessionId;

  /// Set once the clock stopped and its time landed as a line; null while it runs
  final DateTime? sessionEndedAt;
  final DateTime openedAt;
  final DateTime lastActivityAt;
  final DateTime? settledAt;
  final DateTime? voidedAt;
  final int? receiptNumber;

  /// "Cash", "Card", "InstaPay", "Account" or "Mixed" once settled
  final String? paidWith;
  final List<BillLine> lines;
  final double subtotal;
  final double discount;
  final double? discountRate;
  final double serviceCharge;
  final double serviceChargeRate;
  final double vat;
  final double vatRate;
  final bool vatIncluded;
  final double total;
  final double refundedTotal;

  const Bill({
    required this.id,
    required this.type,
    required this.status,
    required this.branchId,
    this.placeId,
    this.placeKind,
    this.locationName,
    this.sessionId,
    this.sessionEndedAt,
    required this.openedAt,
    required this.lastActivityAt,
    this.settledAt,
    this.voidedAt,
    this.receiptNumber,
    this.paidWith,
    required this.lines,
    required this.subtotal,
    required this.discount,
    this.discountRate,
    required this.serviceCharge,
    required this.serviceChargeRate,
    required this.vat,
    required this.vatRate,
    required this.vatIncluded,
    required this.total,
    required this.refundedTotal,
  });

  bool get isOpen => status == 'Open';
  bool get isSettled => status == 'Settled';
  bool get isVoided => status == 'Voided';

  /// When the till closed the bill, paid or thrown out; null while open
  DateTime? get closedAt => settledAt ?? voidedAt;

  static double _num(dynamic v) => (v as num?)?.toDouble() ?? 0;
  static DateTime? _date(dynamic v) => v == null ? null : DateTime.parse(v as String);

  factory Bill.fromJson(Map<String, dynamic> json) => Bill(
        id: (json['id'] as num).toInt(),
        type: json['type'] as String? ?? '',
        status: json['status'] as String? ?? '',
        branchId: (json['branchId'] as num?)?.toInt() ?? 0,
        placeId: (json['placeId'] as num?)?.toInt(),
        placeKind: PlaceKind.fromWireName(json['placeKind'] as String?),
        locationName: LocalizedText.parseNullable(json['locationName']),
        sessionId: (json['sessionId'] as num?)?.toInt(),
        sessionEndedAt: _date(json['sessionEndedAt']),
        openedAt: DateTime.parse(json['openedAt'] as String),
        lastActivityAt: DateTime.parse(json['lastActivityAt'] as String),
        settledAt: _date(json['settledAt']),
        voidedAt: _date(json['voidedAt']),
        receiptNumber: (json['receiptNumber'] as num?)?.toInt(),
        paidWith: json['paidWith'] as String?,
        lines: (json['lines'] as List<dynamic>? ?? const [])
            .map((e) => BillLine.fromJson(e as Map<String, dynamic>))
            .toList(),
        subtotal: _num(json['subtotal']),
        discount: _num(json['discount']),
        discountRate: (json['discountRate'] as num?)?.toDouble(),
        serviceCharge: _num(json['serviceCharge']),
        serviceChargeRate: _num(json['serviceChargeRate']),
        vat: _num(json['vat']),
        vatRate: _num(json['vatRate']),
        vatIncluded: json['vatIncluded'] as bool? ?? false,
        total: _num(json['total']),
        refundedTotal: _num(json['refundedTotal']),
      );
}

class BillLine {
  final int id;

  /// "Order", "SessionTime" or "Manual"
  final String source;
  final int? orderId;
  final LocalizedText description;
  final LocalizedText? details;
  final double qty;
  final double unitPrice;
  final double discount;
  final double total;

  /// Who the line is for, by the name the till put on it; null for the
  /// place's own lines and for rounds it named nobody for
  final String? customerName;

  /// The customer's own line: ordered by them
  final bool isMine;

  const BillLine({
    required this.id,
    required this.source,
    this.orderId,
    required this.description,
    this.details,
    required this.qty,
    required this.unitPrice,
    required this.discount,
    required this.total,
    this.customerName,
    required this.isMine,
  });

  /// The place's time, as the till billed it
  bool get isTime => source == 'SessionTime';

  /// A round the till put no name on: a walk-in keyed at the counter, or a
  /// line it has not named yet. Not the customer's, but not anyone else's
  /// either, so the tile shows it with theirs rather than hiding it
  /// behind the total.
  bool get isUnassigned => !isMine && customerName == null && !isTime;

  /// A round the till named for somebody else on the bill
  bool get isOthers => !isMine && customerName != null && !isTime;

  factory BillLine.fromJson(Map<String, dynamic> json) => BillLine(
        id: (json['id'] as num).toInt(),
        source: json['source'] as String? ?? '',
        orderId: (json['orderId'] as num?)?.toInt(),
        description: LocalizedText.parse(json['description']),
        details: LocalizedText.parseNullable(json['details']),
        qty: Bill._num(json['qty']),
        unitPrice: Bill._num(json['unitPrice']),
        discount: Bill._num(json['discount']),
        total: Bill._num(json['total']),
        customerName: json['customerName'] as String?,
        isMine: json['isMine'] as bool? ?? false,
      );
}
