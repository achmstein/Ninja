/// Where a sale the till took over the phone goes: the words the caller
/// said, the number the rider calls, and a pin only when they shared their
/// location (a pasted map link, read by Ordering into [latitude]/[longitude]).
class SaleDelivery {
  final String address;
  final String building;
  final String floor;
  final String apartment;
  final String directions;
  final String phone;

  /// What the cashier pasted: a Google Maps link or coordinates
  final String location;
  final double? latitude;
  final double? longitude;

  const SaleDelivery({
    required this.address,
    required this.phone,
    this.building = '',
    this.floor = '',
    this.apartment = '',
    this.directions = '',
    this.location = '',
    this.latitude,
    this.longitude,
  });

  bool get hasPin => latitude != null && longitude != null;

  static String? _orNull(String value) => value.trim().isEmpty ? null : value.trim();

  /// `PosOrderRequest.delivery` as Ordering's PosDeliveryRequest spells it
  Map<String, dynamic> toRequest() => {
        'address': address.trim(),
        'phone': phone.trim(),
        'latitude': latitude,
        'longitude': longitude,
        'building': _orNull(building),
        'floor': _orNull(floor),
        'apartment': _orNull(apartment),
        'directions': _orNull(directions),
      };

  Map<String, dynamic> toJson() => {
        'address': address,
        'building': building,
        'floor': floor,
        'apartment': apartment,
        'directions': directions,
        'phone': phone,
        'location': location,
        'latitude': latitude,
        'longitude': longitude,
      };

  factory SaleDelivery.fromJson(Map<String, dynamic> json) => SaleDelivery(
        address: json['address'] as String? ?? '',
        building: json['building'] as String? ?? '',
        floor: json['floor'] as String? ?? '',
        apartment: json['apartment'] as String? ?? '',
        directions: json['directions'] as String? ?? '',
        phone: json['phone'] as String? ?? '',
        location: json['location'] as String? ?? '',
        latitude: (json['latitude'] as num?)?.toDouble(),
        longitude: (json['longitude'] as num?)?.toDouble(),
      );
}
