import 'localized_text.dart';

class Branch {
  final int id;
  final LocalizedText name;
  final LocalizedText? address;
  final String? phone;
  final int displayOrder;
  final String dayStartTime;
  final String dayEndTime;
  final bool isOrderingEnabled;
  final bool isReservationsEnabled;
  final String? taxNumber;
  final LocalizedText? receiptFooter;

  const Branch({
    required this.id,
    required this.name,
    this.address,
    this.phone,
    required this.displayOrder,
    this.dayStartTime = '17:00',
    this.dayEndTime = '05:00',
    this.isOrderingEnabled = true,
    this.isReservationsEnabled = true,
    this.taxNumber,
    this.receiptFooter,
  });

  int get dayStartHour => int.tryParse(dayStartTime.split(':').first) ?? 17;
  int get dayEndHour => int.tryParse(dayEndTime.split(':').first) ?? 5;

  /// Whether the business day crosses midnight (e.g., 17:00→05:00).
  bool get isOvernightShift => dayEndHour < dayStartHour;

  factory Branch.fromJson(Map<String, dynamic> json) {
    return Branch(
      id: json['id'] as int,
      name: LocalizedText.parse(json['name']),
      address: LocalizedText.parseNullable(json['address']),
      phone: json['phone'] as String?,
      displayOrder: json['displayOrder'] as int? ?? 0,
      dayStartTime: json['dayStartTime'] as String? ?? '17:00',
      dayEndTime: json['dayEndTime'] as String? ?? '05:00',
      isOrderingEnabled: json['isOrderingEnabled'] as bool? ?? true,
      isReservationsEnabled: json['isReservationsEnabled'] as bool? ?? true,
      taxNumber: json['taxNumber'] as String?,
      receiptFooter: LocalizedText.parseNullable(json['receiptFooter']),
    );
  }
}
