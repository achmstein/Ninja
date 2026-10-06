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

  /// Whether the branch is open to customers at all (a closed one is still listed, said so)
  final bool isActive;

  /// The branch's point, when the owner put it on the map
  final double? latitude;
  final double? longitude;

  /// The branch's delivery terms: whether it delivers, how far, its fee and minimum, and whether only signed-in customers may order one
  final bool isDeliveryEnabled;
  final double? deliveryRadiusKm;
  final double deliveryFee;
  final double deliveryMinimumOrder;
  final bool requireSignInForDelivery;

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
    this.isActive = true,
    this.latitude,
    this.longitude,
    this.isDeliveryEnabled = false,
    this.deliveryRadiusKm,
    this.deliveryFee = 0,
    this.deliveryMinimumOrder = 0,
    this.requireSignInForDelivery = false,
  });

  /// Where the branch is, for the distance to it and the way there; null when the owner gave it no point
  ({double lat, double lng})? get point => latitude != null && longitude != null ? (lat: latitude!, lng: longitude!) : null;

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
      isActive: json['isActive'] as bool? ?? true,
      latitude: _numOrNull(json['latitude']),
      longitude: _numOrNull(json['longitude']),
      isDeliveryEnabled: json['isDeliveryEnabled'] as bool? ?? false,
      deliveryRadiusKm: _numOrNull(json['deliveryRadiusKm']),
      deliveryFee: _numOrNull(json['deliveryFee']) ?? 0,
      deliveryMinimumOrder: _numOrNull(json['deliveryMinimumOrder']) ?? 0,
      requireSignInForDelivery: json['requireSignInForDelivery'] as bool? ?? false,
    );
  }
}

/// A number from the API, which may come as a number or a string; null when absent or not one
double? _numOrNull(Object? value) => value is num ? value.toDouble() : value is String ? double.tryParse(value) : null;
