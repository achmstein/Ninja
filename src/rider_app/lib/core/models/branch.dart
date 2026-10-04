import 'localized_text.dart';

class Branch {
  final int id;
  final LocalizedText name;
  final LocalizedText? address;
  final String? phone;
  final bool isActive;
  final int displayOrder;
  final String dayStartTime;
  final String dayEndTime;
  final bool isOrderingEnabled;
  final bool isReservationsEnabled;

  const Branch({
    required this.id,
    required this.name,
    this.address,
    this.phone,
    required this.isActive,
    required this.displayOrder,
    this.dayStartTime = '17:00',
    this.dayEndTime = '05:00',
    this.isOrderingEnabled = true,
    this.isReservationsEnabled = true,
  });

  factory Branch.fromJson(Map<String, dynamic> json) {
    return Branch(
      id: json['id'] as int,
      name: LocalizedText.parse(json['name']),
      address: LocalizedText.parseNullable(json['address']),
      phone: json['phone'] as String?,
      isActive: json['isActive'] as bool? ?? true,
      displayOrder: json['displayOrder'] as int? ?? 0,
      dayStartTime: json['dayStartTime'] as String? ?? '17:00',
      dayEndTime: json['dayEndTime'] as String? ?? '05:00',
      isOrderingEnabled: json['isOrderingEnabled'] as bool? ?? true,
      isReservationsEnabled: json['isReservationsEnabled'] as bool? ?? true,
    );
  }
}
