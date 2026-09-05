import '../../../core/models/localized_text.dart';
import '../../../core/models/money.dart';

/// A café table (Spaces `TableViewModel`): a named place that gets a bill
/// when someone sits down. Inactive tables stay in the API for history but
/// never show on the floor.
class CafeTable {
  final int id;
  final LocalizedText name;
  final bool isActive;

  const CafeTable({required this.id, required this.name, this.isActive = true});

  factory CafeTable.fromJson(Map<String, dynamic> json) => CafeTable(
        id: toInt(json['id']),
        name: LocalizedText.parse(json['name']),
        isActive: json['isActive'] as bool? ?? true,
      );
}
