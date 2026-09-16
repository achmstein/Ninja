import '../../../core/models/localized_text.dart';
import '../../../core/models/money.dart';

/// A place with no clock (Spaces place, kind Table, no tariff): a named
/// place that gets a bill when someone sits down. Inactive tables stay in
/// the API for history but never show on the floor.
class CafeTable {
  /// The Spaces place id — what the bill names
  final int id;

  /// LEGACY(places): the id a printed sticker carries, for bills opened before the remodel — remove when every till and customer app is on /api/places and /api/stays and the printed room/table stickers are reprinted with /p/{id}.
  final int? legacyTableId;
  final LocalizedText name;
  final bool isActive;

  const CafeTable({required this.id, this.legacyTableId, required this.name, this.isActive = true});

  factory CafeTable.fromJson(Map<String, dynamic> json) => CafeTable(
        id: toInt(json['id']),
        // LEGACY(places): legacy sticker id read off the place — remove when every till and customer app is on /api/places and /api/stays and the printed room/table stickers are reprinted with /p/{id}.
        legacyTableId: json['legacyTableId'] != null ? toInt(json['legacyTableId']) : null,
        name: LocalizedText.parse(json['name']),
        isActive: json['isActive'] as bool? ?? true,
      );
}
