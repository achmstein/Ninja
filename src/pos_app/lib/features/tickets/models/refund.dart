import '../../../core/models/money.dart';
import 'enums.dart';

/// One line (or part of it) coming back on a credit note
class RefundLineRequest {
  final int lineId;
  final double qty;

  const RefundLineRequest({required this.lineId, required this.qty});

  Map<String, dynamic> toJson() => {'lineId': lineId, 'qty': qty};
}

/// `POST /api/tickets/{id}/refunds`: cash out of the drawer, or back onto
/// a tab that paid
class RefundRequest {
  final List<RefundLineRequest> lines;
  final String reason;
  final PaymentTender tender;
  final String? customerId;
  final String? customerName;

  const RefundRequest({
    required this.lines,
    required this.reason,
    required this.tender,
    this.customerId,
    this.customerName,
  });

  Map<String, dynamic> toJson() => {
        'lines': lines.map((l) => l.toJson()).toList(),
        'reason': reason,
        'tender': tender.value,
        'customerId': customerId,
        'customerName': customerName,
      };
}

/// The credit note Sales issued: its number and what went back
class RefundResult {
  final int number;
  final double amount;

  const RefundResult({required this.number, required this.amount});

  factory RefundResult.fromJson(Map<String, dynamic> json) =>
      RefundResult(number: toInt(json['number']), amount: toNumber(json['amount']));
}
