import '../../../core/models/money.dart';
import 'enums.dart';

/// One tender against the bill. An account payment names the tab it charges.
class SettlePayment {
  final PaymentTender tender;
  final double amount;
  final String? customerId;
  final String? customerName;

  const SettlePayment({
    required this.tender,
    required this.amount,
    this.customerId,
    this.customerName,
  });

  factory SettlePayment.fromJson(Map<String, dynamic> json) => SettlePayment(
        tender: PaymentTender.values.firstWhere((t) => t.value == json['tender'], orElse: () => PaymentTender.cash),
        amount: toNumber(json['amount']),
        customerId: json['customerId'] as String?,
        customerName: json['customerName'] as String?,
      );

  Map<String, dynamic> toJson() => {
        'tender': tender.value,
        'amount': amount,
        'customerId': customerId,
        'customerName': customerName,
      };
}

/// Request DTOs are classes with `toJson()` rather than inline maps so a
/// later offline queue can serialize them unchanged.
class SettleRequest {
  final List<SettlePayment> payments;

  /// When the money was actually taken — a sale replayed from the offline
  /// queue is dated then, not now
  final DateTime? settledAt;

  /// The number the till printed on the offline receipt
  final String? provisionalReceiptNumber;

  /// The shift that was open on the till when an offline sale was made, so
  /// its cash lands in that drawer rather than whichever is open at replay.
  /// Left out of the body when null (a live settle, or a sale queued before
  /// the till recorded it): the server then uses the open shift.
  final int? shiftId;

  const SettleRequest({required this.payments, this.settledAt, this.provisionalReceiptNumber, this.shiftId});

  Map<String, dynamic> toJson() => {
        'payments': payments.map((p) => p.toJson()).toList(),
        'settledAt': settledAt?.toUtc().toIso8601String(),
        'provisionalReceiptNumber': provisionalReceiptNumber,
        if (shiftId != null) 'shiftId': shiftId,
      };
}

class SettleResult {
  final int receiptNumber;
  final double change;

  const SettleResult({required this.receiptNumber, required this.change});

  factory SettleResult.fromJson(Map<String, dynamic> json) => SettleResult(
        receiptNumber: toInt(json['receiptNumber']),
        change: toNumber(json['change']),
      );
}
