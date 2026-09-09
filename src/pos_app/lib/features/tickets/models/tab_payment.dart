import '../../../core/models/money.dart';
import 'enums.dart';

/// `POST /api/tickets/tab-payments`: money taken against a customer's tab.
class TabPaymentRequest {
  final String customerId;
  final String? customerName;
  final PaymentTender tender;
  final double amount;

  const TabPaymentRequest({
    required this.customerId,
    this.customerName,
    required this.tender,
    required this.amount,
  });

  Map<String, dynamic> toJson() => {
        'customerId': customerId,
        'customerName': customerName,
        'tender': tender.value,
        'amount': amount,
      };
}

/// The slip Sales issued. Number 0: an earlier attempt with the same
/// request id already went through, and the money is on the ledger.
class TabPaymentResult {
  final int id;
  final int number;

  const TabPaymentResult({required this.id, required this.number});

  factory TabPaymentResult.fromJson(Map<String, dynamic> json) =>
      TabPaymentResult(id: toInt(json['id']), number: toInt(json['number']));
}
