import 'package:ninja_app_core/models/localized_text.dart';
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

  /// Paid for by a part payment while the bill is open: not to be paid
  /// again, nor moved
  final bool paid;

  /// How many of it were cancelled while the bill was open, with why, by
  /// whom and when. [qty] is what is still sold: a line cancelled whole has
  /// a qty of 0 and stays on the bill, struck
  final double cancelledQty;
  final String? cancelReason;
  final String? cancelledBy;
  final DateTime? cancelledAt;

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
    this.paid = false,
    this.cancelledQty = 0,
    this.cancelReason,
    this.cancelledBy,
    this.cancelledAt,
  });

  /// Some of it was cancelled
  bool get isCancelled => cancelledQty > 0;

  /// All of it was cancelled: nothing of it is sold any more
  bool get cancelledWhole => isCancelled && qty <= 0;

  /// As many as were rung up, before any were cancelled
  double get originalQty => qty + cancelledQty;

  /// An item that can still be cancelled (the server's own rule): one from an
  /// order or rung up by hand at a price, with some of it left, not yet paid
  /// for by a part payment. The room's time, a delivery fee and money off are not
  bool get cancellable => (source == 'Order' || source == 'Manual') && unitPrice > 0 && qty > 0 && !paid;

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
      paid: json['paid'] as bool? ?? false,
      // A server from before cancelling items sends none of these: nothing cancelled
      cancelledQty: toNumber(json['cancelledQty']),
      cancelReason: json['cancelReason'] as String?,
      cancelledBy: json['cancelledBy'] as String?,
      cancelledAt: json['cancelledAt'] == null ? null : DateTime.tryParse(json['cancelledAt'] as String),
    );
  }
}

/// One item of an open bill to cancel, and how many of it
class CancelLineRequest {
  final int lineId;
  final double qty;

  const CancelLineRequest({required this.lineId, required this.qty});

  Map<String, dynamic> toJson() => {'lineId': lineId, 'qty': qty};
}

/// `POST /api/tickets/{id}/lines/cancel`: items the kitchen already has,
/// taken off an open bill without voiding it. The reason is mandatory, the
/// audit trail; [stockDisposition] ("Waste" or "Restock") says what became of
/// the food, null for items with no order behind them
class CancelLinesRequest {
  final List<CancelLineRequest> lines;
  final String reason;
  final String? stockDisposition;

  const CancelLinesRequest({required this.lines, required this.reason, this.stockDisposition});

  Map<String, dynamic> toJson() => {
        'lines': lines.map((l) => l.toJson()).toList(),
        'reason': reason,
        'stockDisposition': ?stockDisposition,
      };
}

/// Whether cancelling [wanted] (line id to how many) leaves nothing sold on
/// the bill, which the server refuses as a void (Sales `Ticket.CancelLines`)
bool cancelsEverything(List<TicketLineView> lines, Map<int, double> wanted) {
  final items = lines.where((l) => l.total > 0 && (l.source == 'Order' || l.source == 'Manual'));
  final leftAfter = items.fold<double>(0, (sum, l) => sum + l.qty - (wanted[l.id] ?? 0));
  final otherSold = lines.any((l) => l.total > 0 && l.source != 'Order' && l.source != 'Manual');
  return leftAfter <= 0.0001 && !otherSold;
}

/// Money the till took for part of an open bill (Sales `PartPaymentView`):
/// one of a group paying for what they had, or an amount on account of it.
class PartPayment {
  final int id;
  final PaymentTender tender;
  final double amount;
  final String? payerName;

  /// The lines it paid for; empty for an amount on account of the bill
  final List<int> lineIds;
  final String recordedBy;
  final DateTime? recordedAt;

  const PartPayment({
    required this.id,
    required this.tender,
    required this.amount,
    this.payerName,
    this.lineIds = const [],
    this.recordedBy = '',
    this.recordedAt,
  });

  factory PartPayment.fromJson(Map<String, dynamic> json) => PartPayment(
        id: toInt(json['id']),
        tender: PaymentTender.fromName(json['tender'] as String?),
        amount: toNumber(json['amount']),
        payerName: json['payerName'] as String?,
        lineIds: ((json['lineIds'] as List<dynamic>?) ?? []).map(toInt).toList(),
        recordedBy: json['recordedBy'] as String? ?? '',
        recordedAt: json['recordedAt'] == null ? null : DateTime.tryParse(json['recordedAt'] as String),
      );
}

/// What Sales answers a part payment taken or given back with (Sales
/// `PartPaymentResult`). [partPaymentIds] is empty when a repeated request
/// was answered from what already stands.
class PartPaymentResult {
  /// The part payments this request made (or gave back)
  final List<int> partPaymentIds;

  /// Every part payment the bill counts now
  final double paid;

  /// What is left to pay: the total less the part payments and what guests
  /// paid or are paying online
  final double remaining;

  const PartPaymentResult({this.partPaymentIds = const [], this.paid = 0, this.remaining = 0});

  factory PartPaymentResult.fromJson(Map<String, dynamic> json) => PartPaymentResult(
        partPaymentIds: ((json['partPaymentIds'] as List<dynamic>?) ?? []).map(toInt).toList(),
        paid: toNumber(json['paid']),
        remaining: toNumber(json['remaining']),
      );
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

  /// The tender it was first recorded as, once a cashier has put it right
  /// (Cash, Card or InstaPay); null when it was never changed
  final PaymentTender? tenderChangedFrom;
  final String? tenderChangedBy;
  final DateTime? tenderChangedAt;

  /// Set when this was taken earlier as a part payment, before the bill
  /// closed; its method cannot be changed
  final int? partPaymentId;

  const PaymentView({
    required this.id,
    required this.tender,
    required this.amount,
    this.customerId,
    this.customerName,
    this.recordedAt,
    this.tenderChangedFrom,
    this.tenderChangedBy,
    this.tenderChangedAt,
    this.partPaymentId,
  });

  /// Only the till's own tenders can be swapped for one another, and never
  /// one taken as a part payment (the server refuses it)
  bool get canChangeTender =>
      partPaymentId == null &&
      (tender == PaymentTender.cash || tender == PaymentTender.card || tender == PaymentTender.instaPay);

  factory PaymentView.fromJson(Map<String, dynamic> json) {
    return PaymentView(
      id: toInt(json['id']),
      tender: PaymentTender.fromName(json['tender'] as String?),
      amount: toNumber(json['amount']),
      customerId: json['customerId'] as String?,
      customerName: json['customerName'] as String?,
      recordedAt: json['recordedAt'] == null ? null : DateTime.tryParse(json['recordedAt'] as String),
      tenderChangedFrom: json['tenderChangedFrom'] == null ? null : PaymentTender.fromName(json['tenderChangedFrom'] as String?),
      tenderChangedBy: json['tenderChangedBy'] as String?,
      tenderChangedAt: json['tenderChangedAt'] == null ? null : DateTime.tryParse(json['tenderChangedAt'] as String),
      partPaymentId: json['partPaymentId'] == null ? null : toInt(json['partPaymentId']),
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
  final LocalizedText? locationName;
  final String? label;
  final String? guestPhone;

  /// The cashier who rang up the order that opened the bill
  final String? takenBy;

  /// The branch whose till took that order and sent it here; null when it was taken here
  final int? takenAtBranchId;
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

  /// What the till took for part of this bill while it is open, not given
  /// back, oldest first. Empty once the bill closes: each is then one of
  /// [payments], with its `partPaymentId`
  final List<PartPayment> partPayments;

  /// Their sum: off [total], it is what the till still has to take
  final double partPaid;

  const TicketDetail({
    required this.id,
    this.type,
    this.status = TicketStatus.open,
    this.sessionId,
    this.sessionEndedAt,
    this.placeId,
    this.locationName,
    this.label,
    this.guestPhone,
    this.takenBy,
    this.takenAtBranchId,
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
    this.partPayments = const [],
    this.partPaid = 0,
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
      locationName: LocalizedText.parseNullable(json['locationName']),
      label: json['label'] as String?,
      guestPhone: json['guestPhone'] as String?,
      takenBy: json['takenBy'] as String?,
      takenAtBranchId: json['takenAtBranchId'] == null ? null : toInt(json['takenAtBranchId']),
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
      // A server from before part payments sends neither: none taken
      partPayments: ((json['partPayments'] as List<dynamic>?) ?? [])
          .map((e) => PartPayment.fromJson(e as Map<String, dynamic>))
          .toList(),
      partPaid: toNumber(json['partPaid']),
    );
  }
}
