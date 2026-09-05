import '../../../core/models/localized_text.dart';
import '../../../core/models/money.dart';
import 'enums.dart';

/// One open bill as the floor lists it (Sales `TicketSummary`).
class TicketSummary {
  final int id;
  final TicketType? type;
  final int? sessionId;
  final int? roomId;
  final int? tableId;
  final LocalizedText? locationName;
  final String? label;
  final int lineCount;
  final double total;
  final DateTime? openedAt;
  final DateTime? lastActivityAt;

  const TicketSummary({
    required this.id,
    this.type,
    this.sessionId,
    this.roomId,
    this.tableId,
    this.locationName,
    this.label,
    this.lineCount = 0,
    this.total = 0,
    this.openedAt,
    this.lastActivityAt,
  });

  factory TicketSummary.fromJson(Map<String, dynamic> json) {
    return TicketSummary(
      id: toInt(json['id']),
      type: TicketType.fromName(json['type'] as String?),
      sessionId: json['sessionId'] == null ? null : toInt(json['sessionId']),
      roomId: json['roomId'] == null ? null : toInt(json['roomId']),
      tableId: json['tableId'] == null ? null : toInt(json['tableId']),
      locationName: LocalizedText.parseNullable(json['locationName']),
      label: json['label'] as String?,
      lineCount: toInt(json['lineCount']),
      total: toNumber(json['total']),
      openedAt: json['openedAt'] == null ? null : DateTime.tryParse(json['openedAt'] as String),
      lastActivityAt:
          json['lastActivityAt'] == null ? null : DateTime.tryParse(json['lastActivityAt'] as String),
    );
  }
}
