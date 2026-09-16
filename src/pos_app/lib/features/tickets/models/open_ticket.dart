import '../../../core/models/localized_text.dart';
import 'enums.dart';

/// `POST /api/tickets`: open a counter tab or a table's bill by hand. A
/// stay's bill is never opened this way — it follows the stay's events.
class OpenTicketRequest {
  final TicketType type;

  /// The Spaces place of a table bill
  final int? placeId;

  /// The id the table's printed sticker carries, for bills older tills opened
  final int? tableId;
  final LocalizedText? tableName;

  /// What to call a counter tab — a name for humans, not a customer
  final String? label;

  const OpenTicketRequest({required this.type, this.placeId, this.tableId, this.tableName, this.label});

  Map<String, dynamic> toJson() => {
        'type': type.value,
        'placeId': placeId,
        'tableId': tableId,
        'tableName': tableName?.toJson(),
        'label': label,
      };
}
