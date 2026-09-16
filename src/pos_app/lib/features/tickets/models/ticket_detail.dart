import '../../../core/models/localized_text.dart';
import '../../../core/models/money.dart';
import 'enums.dart';

/// A line on a bill (Sales `TicketLineView`).
class TicketLineView {
  final int id;
  final String source;
  final int? orderId;
  final LocalizedText? description;
  /// Chosen options, bilingual like the item name (Sales `LocalizedText`)
  final LocalizedText? details;
  final double qty;
  final double unitPrice;
  final double discount;
  final double total;
  final String? customerId;
  final String? customerName;
  final String? guestId;

  const TicketLineView({
    required this.id,
    this.source = 'Order',
    this.orderId,
    this.description,
    this.details,
    this.qty = 0,
    this.unitPrice = 0,
    this.discount = 0,
    this.total = 0,
    this.customerId,
    this.customerName,
    this.guestId,
  });

  factory TicketLineView.fromJson(Map<String, dynamic> json) {
    return TicketLineView(
      id: toInt(json['id']),
      source: json['source'] as String? ?? 'Order',
      orderId: json['orderId'] == null ? null : toInt(json['orderId']),
      description: LocalizedText.parseNullable(json['description']),
      details: LocalizedText.parseNullable(json['details']),
      qty: toNumber(json['qty']),
      unitPrice: toNumber(json['unitPrice']),
      discount: toNumber(json['discount']),
      total: toNumber(json['total']),
      customerId: json['customerId'] as String?,
      customerName: json['customerName'] as String?,
      guestId: json['guestId'] as String?,
    );
  }
}

/// A payment taken against a bill (Sales `PaymentView`).
class PaymentView {
  final int id;
  final PaymentTender tender;
  final double amount;

  /// The tab an Account payment was put on — the only tab a refund can go back to
  final String? customerId;
  final String? customerName;
  final DateTime? recordedAt;

  const PaymentView({
    required this.id,
    required this.tender,
    required this.amount,
    this.customerId,
    this.customerName,
    this.recordedAt,
  });

  factory PaymentView.fromJson(Map<String, dynamic> json) {
    return PaymentView(
      id: toInt(json['id']),
      tender: PaymentTender.fromName(json['tender'] as String?),
      amount: toNumber(json['amount']),
      customerId: json['customerId'] as String?,
      customerName: json['customerName'] as String?,
      recordedAt: json['recordedAt'] == null ? null : DateTime.tryParse(json['recordedAt'] as String),
    );
  }
}

/// One line of a credit note (Sales `RefundLineView`).
class RefundLineView {
  final int ticketLineId;
  final LocalizedText? description;
  final double qty;
  final double amount;

  const RefundLineView({required this.ticketLineId, this.description, this.qty = 0, this.amount = 0});

  factory RefundLineView.fromJson(Map<String, dynamic> json) => RefundLineView(
        ticketLineId: toInt(json['ticketLineId']),
        description: LocalizedText.parseNullable(json['description']),
        qty: toNumber(json['qty']),
        amount: toNumber(json['amount']),
      );
}

/// Money that went back on a settled bill, with its reason (Sales `RefundView`).
class RefundView {
  final int id;
  final int number;
  final double amount;
  final String reason;
  final PaymentTender tender;
  final String? customerName;
  final String refundedBy;
  final DateTime? refundedAt;
  final List<RefundLineView> lines;

  const RefundView({
    required this.id,
    required this.number,
    required this.amount,
    required this.reason,
    required this.tender,
    this.customerName,
    this.refundedBy = '',
    this.refundedAt,
    this.lines = const [],
  });

  factory RefundView.fromJson(Map<String, dynamic> json) => RefundView(
        id: toInt(json['id']),
        number: toInt(json['number']),
        amount: toNumber(json['amount']),
        reason: json['reason'] as String? ?? '',
        tender: PaymentTender.fromName(json['tender'] as String?),
        customerName: json['customerName'] as String?,
        refundedBy: json['refundedBy'] as String? ?? '',
        refundedAt: json['refundedAt'] == null ? null : DateTime.tryParse(json['refundedAt'] as String),
        lines: ((json['lines'] as List<dynamic>?) ?? [])
            .map((e) => RefundLineView.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

/// The whole bill (Sales `TicketDetail`). Money figures come from the
/// server: live under the branch's rules while open, frozen at settle.
class TicketDetail {
  final int id;
  final TicketType? type;
  final TicketStatus status;
  final int? sessionId;
  final DateTime? sessionEndedAt;
  final int? placeId;
  // LEGACY(places): the old room/table ids a bill opened before the remodel names, next to placeId — remove when every till and customer app is on /api/places and /api/stays.
  final int? roomId;
  final int? tableId;
  final LocalizedText? locationName;
  final String? label;
  final String? guestPhone;
  final DateTime? openedAt;
  final DateTime? settledAt;
  final String? settledBy;
  final int? receiptNumber;

  /// What the till printed while offline, when the sale was replayed
  final String? provisionalReceiptNumber;
  final DateTime? voidedAt;
  final String? voidedBy;
  final String? voidReason;
  final double subtotal;

  /// The bill discount as money; zero when none
  final double discount;

  /// The rate behind it as a fraction; null for a fixed amount or none
  final double? discountRate;
  final String? discountReason;
  final String? discountBy;
  final double serviceCharge;
  final double serviceChargeRate;
  final double vat;
  final double vatRate;
  final bool vatIncluded;
  final double total;
  final double refundedTotal;
  final double change;
  final List<TicketLineView> lines;
  final List<PaymentView> payments;
  final List<RefundView> refunds;

  const TicketDetail({
    required this.id,
    this.type,
    this.status = TicketStatus.open,
    this.sessionId,
    this.sessionEndedAt,
    this.placeId,
    this.roomId,
    this.tableId,
    this.locationName,
    this.label,
    this.guestPhone,
    this.openedAt,
    this.settledAt,
    this.settledBy,
    this.receiptNumber,
    this.provisionalReceiptNumber,
    this.voidedAt,
    this.voidedBy,
    this.voidReason,
    this.subtotal = 0,
    this.discount = 0,
    this.discountRate,
    this.discountReason,
    this.discountBy,
    this.serviceCharge = 0,
    this.serviceChargeRate = 0,
    this.vat = 0,
    this.vatRate = 0,
    this.vatIncluded = false,
    this.total = 0,
    this.refundedTotal = 0,
    this.change = 0,
    this.lines = const [],
    this.payments = const [],
    this.refunds = const [],
  });

  bool get isOpen => status == TicketStatus.open;
  bool get isSettled => status == TicketStatus.settled;

  /// Keyed on the timestamp rather than the status, like pos_web, so the
  /// tombstone still renders if the status enum ever gains states
  bool get isVoided => voidedAt != null;

  factory TicketDetail.fromJson(Map<String, dynamic> json) {
    DateTime? date(String key) =>
        json[key] == null ? null : DateTime.tryParse(json[key] as String);
    return TicketDetail(
      id: toInt(json['id']),
      type: TicketType.fromName(json['type'] as String?),
      status: TicketStatus.fromName(json['status'] as String?),
      sessionId: json['sessionId'] == null ? null : toInt(json['sessionId']),
      sessionEndedAt: date('sessionEndedAt'),
      placeId: json['placeId'] == null ? null : toInt(json['placeId']),
      // LEGACY(places): old roomId/tableId read next to placeId — remove when every till and customer app is on /api/places and /api/stays.
      roomId: json['roomId'] == null ? null : toInt(json['roomId']),
      tableId: json['tableId'] == null ? null : toInt(json['tableId']),
      locationName: LocalizedText.parseNullable(json['locationName']),
      label: json['label'] as String?,
      guestPhone: json['guestPhone'] as String?,
      openedAt: date('openedAt'),
      settledAt: date('settledAt'),
      settledBy: json['settledBy'] as String?,
      receiptNumber: json['receiptNumber'] == null ? null : toInt(json['receiptNumber']),
      provisionalReceiptNumber: json['provisionalReceiptNumber'] as String?,
      voidedAt: date('voidedAt'),
      voidedBy: json['voidedBy'] as String?,
      voidReason: json['voidReason'] as String?,
      subtotal: toNumber(json['subtotal']),
      discount: toNumber(json['discount']),
      discountRate: json['discountRate'] == null ? null : toNumber(json['discountRate']),
      discountReason: json['discountReason'] as String?,
      discountBy: json['discountBy'] as String?,
      serviceCharge: toNumber(json['serviceCharge']),
      serviceChargeRate: toNumber(json['serviceChargeRate']),
      vat: toNumber(json['vat']),
      vatRate: toNumber(json['vatRate']),
      vatIncluded: json['vatIncluded'] as bool? ?? false,
      total: toNumber(json['total']),
      refundedTotal: toNumber(json['refundedTotal']),
      change: toNumber(json['change']),
      lines: ((json['lines'] as List<dynamic>?) ?? [])
          .map((e) => TicketLineView.fromJson(e as Map<String, dynamic>))
          .toList(),
      payments: ((json['payments'] as List<dynamic>?) ?? [])
          .map((e) => PaymentView.fromJson(e as Map<String, dynamic>))
          .toList(),
      refunds: ((json['refunds'] as List<dynamic>?) ?? [])
          .map((e) => RefundView.fromJson(e as Map<String, dynamic>))
          .toList(),
    );
  }
}
