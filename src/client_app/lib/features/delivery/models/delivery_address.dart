import 'package:flutter/foundation.dart';

/// Where a delivery goes: the pin and the words that find the door, as the
/// customer gave them (client_web's stores/delivery-store.ts)
@immutable
class DeliveryAddress {
  /// The saved address it came from, on the customer's account
  final int? id;
  final String? label;
  final double latitude;
  final double longitude;
  final String address;
  final String? building;
  final String? floor;
  final String? apartment;
  final String? directions;
  final String? phone;

  const DeliveryAddress({
    this.id,
    this.label,
    required this.latitude,
    required this.longitude,
    required this.address,
    this.building,
    this.floor,
    this.apartment,
    this.directions,
    this.phone,
  });

  static String? _text(Object? value) {
    final text = value is String ? value.trim() : null;
    return text == null || text.isEmpty ? null : text;
  }

  static double _num(Object? value) => value is num ? value.toDouble() : double.tryParse('$value') ?? 0;

  /// A saved address as the API answers it (CustomerAddressView), or one kept on the phone
  factory DeliveryAddress.fromJson(Map<String, dynamic> json) => DeliveryAddress(
        id: (json['id'] as num?)?.toInt(),
        label: _text(json['label']),
        latitude: _num(json['latitude']),
        longitude: _num(json['longitude']),
        address: _text(json['address']) ?? '',
        building: _text(json['building']),
        floor: _text(json['floor']),
        apartment: _text(json['apartment']),
        directions: _text(json['directions']),
        phone: _text(json['phone']),
      );

  Map<String, dynamic> toJson() => {
        if (id != null) 'id': id,
        'label': label,
        ...body(),
      };

  /// The body an address is saved with, and the delivery an order is sent with (without the label)
  Map<String, dynamic> body() => {
        'latitude': latitude,
        'longitude': longitude,
        'address': address,
        'building': _text(building),
        'floor': _text(floor),
        'apartment': _text(apartment),
        'directions': _text(directions),
        'phone': _text(phone),
      };

  /// The same place: the same saved address, or the same pin and street
  bool sameAs(DeliveryAddress other) =>
      id != null ? id == other.id : latitude == other.latitude && longitude == other.longitude && address == other.address;

  /// The address on one line, the street first: "Tahrir St · Bldg 12, Floor 3, Apt 7"
  String line({required String building, required String floor, required String apartment, required String separator}) {
    final details = [
      if (this.building != null) '$building ${this.building}',
      if (this.floor != null) '$floor ${this.floor}',
      if (this.apartment != null) '$apartment ${this.apartment}',
    ];
    final street = address.trim();
    if (details.isEmpty) return street;
    return street.isEmpty ? details.join(separator) : '$street · ${details.join(separator)}';
  }
}

/// What a saved address is called. Home and Work are kept as the words
/// "home" and "work" whatever the language, so switching language never
/// loses which is which; anything else is the customer's own name for it.
/// Labels saved before (the words themselves, in either language) still read
/// as theirs (client_web's lib/address-line.ts).
enum LabelKind { home, work, other }

const _home = {'home', 'البيت', 'المنزل'};
const _work = {'work', 'الشغل', 'العمل'};

LabelKind labelKind(String? label) {
  final word = (label ?? '').trim().toLowerCase();
  if (_home.contains(word)) return LabelKind.home;
  if (_work.contains(word)) return LabelKind.work;
  return LabelKind.other;
}

/// The label as it is stored: the kind's own word, or the customer's text
String? storedLabel(LabelKind kind, String text) => switch (kind) {
      LabelKind.home => 'home',
      LabelKind.work => 'work',
      LabelKind.other => text.trim().isEmpty ? null : text.trim(),
    };

/// The label as it reads: Home or Work in the customer's language, or their own text
String? shownLabel(String? label, {required String home, required String work}) => switch (labelKind(label)) {
      LabelKind.home => home,
      LabelKind.work => work,
      LabelKind.other => (label ?? '').trim().isEmpty ? null : label!.trim(),
    };
