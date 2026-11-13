import 'enums.dart';

/// `POST /api/tickets`: open a counter tab or a table's bill by hand. A
/// stay's bill is never opened this way — it follows the stay's events.
class OpenTicketRequest {
  final TicketType type;

  /// The Spaces place of a table bill. Its id is all the till says: what the
  /// table is called on the bill is the server's to say
  final int? placeId;

  /// What to call a counter tab — a name for humans, not a customer
  final String? label;

  const OpenTicketRequest({required this.type, this.placeId, this.label});

  Map<String, dynamic> toJson() => {
        'type': type.value,
        'placeId': placeId,
        'label': label,
      };
}
