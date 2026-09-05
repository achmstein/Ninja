import '../../../core/models/localized_text.dart';
import 'enums.dart';

/// `POST /api/tickets`: open a counter tab or a table's bill by hand. Room
/// tickets are never opened this way — they follow their session events.
class OpenTicketRequest {
  final TicketType type;
  final int? tableId;
  final LocalizedText? tableName;

  /// What to call a counter tab — a name for humans, not a customer
  final String? label;

  const OpenTicketRequest({required this.type, this.tableId, this.tableName, this.label});

  Map<String, dynamic> toJson() => {
        'type': type.value,
        'tableId': tableId,
        'tableName': tableName?.toJson(),
        'label': label,
      };
}
