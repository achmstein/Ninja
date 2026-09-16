import '../../../core/models/localized_text.dart';

/// The customer's own copy of the printed receipt, as Sales returns it for a
/// bill they were on.
class Receipt {
  final int ticketId;
  final int receiptNumber;
  final int branchId;
  final String type;
  final LocalizedText? locationName;
  final DateTime settledAt;
  final List<ReceiptLine> lines;
  final double subtotal;
  final double discount;
  final double? discountRate;
  final double serviceCharge;
  final double serviceChargeRate;
  final double vat;
  final double vatRate;
  final bool vatIncluded;
  final double total;
  final double changeGiven;
  final List<ReceiptPayment> payments;
  final List<ReceiptRefund> refunds;
  final double refundedTotal;

  const Receipt({
    required this.ticketId,
    required this.receiptNumber,
    required this.branchId,
    required this.type,
    this.locationName,
    required this.settledAt,
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
    required this.changeGiven,
    required this.payments,
    required this.refunds,
    required this.refundedTotal,
  });

  static double _num(dynamic v) => (v as num?)?.toDouble() ?? 0;

  factory Receipt.fromJson(Map<String, dynamic> json) => Receipt(
        ticketId: (json['ticketId'] as num).toInt(),
        receiptNumber: (json['receiptNumber'] as num).toInt(),
        branchId: (json['branchId'] as num).toInt(),
        type: json['type'] as String? ?? '',
        locationName: LocalizedText.parseNullable(json['locationName']),
        settledAt: DateTime.parse(json['settledAt'] as String),
        lines: (json['lines'] as List<dynamic>? ?? [])
            .map((e) => ReceiptLine.fromJson(e as Map<String, dynamic>))
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
        changeGiven: _num(json['changeGiven']),
        payments: (json['payments'] as List<dynamic>? ?? [])
            .map((e) => ReceiptPayment.fromJson(e as Map<String, dynamic>))
            .toList(),
        refunds: (json['refunds'] as List<dynamic>? ?? [])
            .map((e) => ReceiptRefund.fromJson(e as Map<String, dynamic>))
            .toList(),
        refundedTotal: _num(json['refundedTotal']),
      );
}

class ReceiptLine {
  final LocalizedText description;
  final LocalizedText? details;
  final double qty;
  final double unitPrice;
  final double discount;
  final double total;
  final String? customerName;

  const ReceiptLine({
    required this.description,
    this.details,
    required this.qty,
    required this.unitPrice,
    required this.discount,
    required this.total,
    this.customerName,
  });

  factory ReceiptLine.fromJson(Map<String, dynamic> json) => ReceiptLine(
        description: LocalizedText.parse(json['description']),
        details: LocalizedText.parseNullable(json['details']),
        qty: Receipt._num(json['qty']),
        unitPrice: Receipt._num(json['unitPrice']),
        discount: Receipt._num(json['discount']),
        total: Receipt._num(json['total']),
        customerName: json['customerName'] as String?,
      );
}

class ReceiptPayment {
  final String tender;
  final double amount;
  final String? customerName;

  const ReceiptPayment({required this.tender, required this.amount, this.customerName});

  factory ReceiptPayment.fromJson(Map<String, dynamic> json) => ReceiptPayment(
        tender: json['tender'] as String? ?? '',
        amount: Receipt._num(json['amount']),
        customerName: json['customerName'] as String?,
      );
}

class ReceiptRefund {
  final int number;
  final double amount;
  final String reason;
  final String tender;
  final DateTime refundedAt;

  const ReceiptRefund({
    required this.number,
    required this.amount,
    required this.reason,
    required this.tender,
    required this.refundedAt,
  });

  factory ReceiptRefund.fromJson(Map<String, dynamic> json) => ReceiptRefund(
        number: (json['number'] as num).toInt(),
        amount: Receipt._num(json['amount']),
        reason: json['reason'] as String? ?? '',
        tender: json['tender'] as String? ?? '',
        refundedAt: DateTime.parse(json['refundedAt'] as String),
      );
}
