import '../../../core/models/localized_text.dart';

/// A café table customers sit at and order from.
/// Named CafeTable because `Table` is a Flutter widget.
class CafeTable {
  final int id;
  final LocalizedText name;
  final int branchId;
  final bool isActive;

  const CafeTable({
    required this.id,
    required this.name,
    required this.branchId,
    required this.isActive,
  });

  factory CafeTable.fromJson(Map<String, dynamic> json) {
    return CafeTable(
      id: json['id'] as int,
      name: LocalizedText.parse(json['name']),
      branchId: json['branchId'] as int? ?? 1,
      isActive: json['isActive'] as bool? ?? true,
    );
  }
}
