import '../../../core/models/localized_text.dart';
import '../../../core/models/money.dart';
import 'enums.dart';

/// A closed bill in the receipts list (Sales `SettledTicketSummary`).
class SettledTicketSummary {
  final int id;
  final int receiptNumber;
  final TicketType? type;
  final LocalizedText? locationName;
  final String? label;
  final DateTime? settledAt;
  final double total;
  final double refundedTotal;
  final String? provisionalReceiptNumber;

  const SettledTicketSummary({
    required this.id,
    required this.receiptNumber,
    this.type,
    this.locationName,
    this.label,
    this.settledAt,
    this.total = 0,
    this.refundedTotal = 0,
    this.provisionalReceiptNumber,
  });

  factory SettledTicketSummary.fromJson(Map<String, dynamic> json) => SettledTicketSummary(
        id: toInt(json['id']),
        receiptNumber: toInt(json['receiptNumber']),
        type: TicketType.fromName(json['type'] as String?),
        locationName: LocalizedText.parseNullable(json['locationName']),
        label: json['label'] as String?,
        settledAt: json['settledAt'] == null ? null : DateTime.tryParse(json['settledAt'] as String),
        total: toNumber(json['total']),
        refundedTotal: toNumber(json['refundedTotal']),
        provisionalReceiptNumber: json['provisionalReceiptNumber'] as String?,
      );
}
