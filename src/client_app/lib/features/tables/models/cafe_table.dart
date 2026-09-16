import '../../../core/models/localized_text.dart';

/// LEGACY(places): the old table sticker's resolution (sticker id -> placeId)
/// — remove when the printed room/table stickers are reprinted with /p/{id}.
///
/// A café table customers sit at and order from.
/// Named CafeTable because `Table` is a Flutter widget.
class CafeTable {
  /// The id the printed sticker carries
  final int id;

  /// The Spaces place behind it: what orders and requests name
  final int placeId;
  final LocalizedText name;
  final int branchId;
  final bool isActive;

  const CafeTable({
    required this.id,
    required this.placeId,
    required this.name,
    required this.branchId,
    required this.isActive,
  });

  factory CafeTable.fromJson(Map<String, dynamic> json) {
    return CafeTable(
      id: json['id'] as int,
      placeId: json['placeId'] as int? ?? json['id'] as int,
      name: LocalizedText.parse(json['name']),
      branchId: json['branchId'] as int? ?? 1,
      isActive: json['isActive'] as bool? ?? true,
    );
  }
}
