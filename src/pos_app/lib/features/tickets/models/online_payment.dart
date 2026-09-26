import '../../../core/models/money.dart';

/// A guest's payment from their phone on a bill (Sales `OnlinePaymentView`):
/// online payments. Pending while they are at the provider's checkout, Paid
/// once the provider confirmed it, Refunded when the till gave it back.
class OnlinePaymentView {
  final String key;

  /// "Full", "Items", "Equal" or "Custom"
  final String mode;
  final String? payerName;

  /// Their share of the bill: what counts against the total
  final double amount;

  /// The provider's fee the guest paid on top; not the café's money
  final double fee;

  /// On top of the share; the staff's, never the bill's
  final double tip;

  /// "Pending", "Paid" or "Refunded"
  final String status;
  final DateTime? createdAt;
  final DateTime? paidAt;
  final String? transactionId;
  final DateTime? refundedAt;

  const OnlinePaymentView({
    required this.key,
    this.mode = 'Full',
    this.payerName,
    required this.amount,
    this.fee = 0,
    this.tip = 0,
    required this.status,
    this.createdAt,
    this.paidAt,
    this.transactionId,
    this.refundedAt,
  });

  bool get isPending => status == 'Pending';
  bool get isPaid => status == 'Paid';
  bool get isRefunded => status == 'Refunded';

  factory OnlinePaymentView.fromJson(Map<String, dynamic> json) {
    DateTime? date(String key) => json[key] == null ? null : DateTime.tryParse(json[key] as String);
    return OnlinePaymentView(
      key: json['key'] as String,
      mode: json['mode'] as String? ?? 'Full',
      payerName: json['payerName'] as String?,
      amount: toNumber(json['amount']),
      fee: toNumber(json['fee']),
      tip: toNumber(json['tip']),
      status: json['status'] as String? ?? 'Pending',
      createdAt: date('createdAt'),
      paidAt: date('paidAt'),
      transactionId: json['transactionId'] as String?,
      refundedAt: date('refundedAt'),
    );
  }
}

/// What the guests have paid online, and whether one is still paying
extension OnlinePaymentsSummary on List<OnlinePaymentView> {
  /// Paid for good: the settle adds these as Online tenders by itself
  double get paidOnline => fold(0, (sum, p) => p.isPaid ? sum + p.amount : sum);

  /// A guest is at the provider's checkout: the bill cannot settle meanwhile
  bool get anyPending => any((p) => p.isPending);
}
