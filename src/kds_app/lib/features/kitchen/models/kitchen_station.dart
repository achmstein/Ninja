import '../../../core/models/localized_text.dart';
import 'kitchen_order.dart';

/// A kitchen station, as `GET /api/kitchen/stations` gives it: a place in
/// the kitchen that makes some of the menu, heard of on a screen, a printer,
/// or both.
class KitchenStation {
  final int id;
  final LocalizedText name;
  final bool showsOnScreen;
  final bool printsTickets;
  final bool isDefault;

  const KitchenStation({
    required this.id,
    required this.name,
    this.showsOnScreen = true,
    this.printsTickets = false,
    this.isDefault = false,
  });

  factory KitchenStation.fromJson(Map<String, dynamic> json) => KitchenStation(
        id: readInt(json['id']),
        name: LocalizedText.parse(json['name']),
        showsOnScreen: json['showsOnScreen'] == true,
        printsTickets: json['printsTickets'] == true,
        isDefault: json['isDefault'] == true,
      );
}
