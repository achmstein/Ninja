import '../../../core/models/localized_text.dart';
import '../../../core/models/money.dart';
import 'enums.dart';

/// One open bill as the floor lists it (Sales `TicketSummary`).
class TicketSummary {
  final int id;
  final TicketType? type;
  final int? sessionId;

  /// The Spaces place the bill is for; null on a counter sale
  final int? placeId;
  final LocalizedText? locationName;
  final String? label;
  final int lineCount;
  final double total;
  final DateTime? openedAt;
  final DateTime? lastActivityAt;

  /// The accounts already on this bill's lines, each once — so the till can
  /// keep one person from ending up with two tabs at the same time.
  final List<String> customerIds;

  const TicketSummary({
    required this.id,
    this.type,
    this.sessionId,
    this.placeId,
    this.locationName,
    this.label,
    this.lineCount = 0,
    this.total = 0,
    this.openedAt,
    this.lastActivityAt,
    this.customerIds = const [],
  });

  factory TicketSummary.fromJson(Map<String, dynamic> json) {
    return TicketSummary(
      id: toInt(json['id']),
      type: TicketType.fromName(json['type'] as String?),
      sessionId: json['sessionId'] == null ? null : toInt(json['sessionId']),
      placeId: json['placeId'] == null ? null : toInt(json['placeId']),
      locationName: LocalizedText.parseNullable(json['locationName']),
      label: json['label'] as String?,
      lineCount: toInt(json['lineCount']),
      total: toNumber(json['total']),
      openedAt: json['openedAt'] == null ? null : DateTime.tryParse(json['openedAt'] as String),
      lastActivityAt:
          json['lastActivityAt'] == null ? null : DateTime.tryParse(json['lastActivityAt'] as String),
      customerIds: [for (final id in json['customerIds'] as List<dynamic>? ?? const []) id as String],
    );
  }
}
