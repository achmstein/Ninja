import '../../../core/models/localized_text.dart';
import '../../../core/models/money.dart';

/// A place with no clock (Spaces place, kind Table, no tariff): a named
/// place that gets a bill when someone sits down. Inactive tables stay in
/// the API for history but never show on the floor.
class DiningTable {
  /// The Spaces place id — what the bill names
  final int id;

  final LocalizedText name;
  final bool isActive;

  const DiningTable({required this.id, required this.name, this.isActive = true});

  factory DiningTable.fromJson(Map<String, dynamic> json) => DiningTable(
        id: toInt(json['id']),
        name: LocalizedText.parse(json['name']),
        isActive: json['isActive'] as bool? ?? true,
      );
}
