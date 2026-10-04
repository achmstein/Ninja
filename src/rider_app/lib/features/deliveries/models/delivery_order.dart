import '../../../core/models/localized_text.dart';

/// Where a delivery has got to, as the server says it
enum DeliveryStage { waiting, assigned, onTheWay, delivered }

DeliveryStage _stage(Object? value) => switch (value) {
      'Assigned' => DeliveryStage.assigned,
      'OnTheWay' => DeliveryStage.onTheWay,
      'Delivered' => DeliveryStage.delivered,
      _ => DeliveryStage.waiting,
    };

double _num(Object? value) => value is num ? value.toDouble() : double.tryParse('${value ?? ''}') ?? 0;

DateTime? _time(Object? value) => value is String ? DateTime.tryParse(value)?.toUtc() : null;

String? _text(Object? value) {
  final text = value is String ? value.trim() : null;
  return text == null || text.isEmpty ? null : text;
}

/// One line of the order, as the rider checks the bag against it
class DeliveryLine {
  final LocalizedText name;
  final int units;
  final LocalizedText? options;
  final String? instructions;

  const DeliveryLine({required this.name, required this.units, this.options, this.instructions});

  factory DeliveryLine.fromJson(Map<String, dynamic> json) => DeliveryLine(
        name: LocalizedText.parse(json['productName']),
        units: _num(json['units']).round(),
        options: LocalizedText.parseNullable(json['customizationsDescription']),
        instructions: _text(json['specialInstructions']),
      );
}

/// A delivery given to this rider: whom it is for, where it goes, what is in
/// the bag, what to collect at the door, and where it has got to.
class DeliveryOrder {
  final int orderNumber;
  final DateTime? confirmedAt;

  /// The kitchen finished it: it can leave
  final DateTime? readyAt;
  final String? customerName;
  final String? customerNote;

  /// Cash to collect at the door, the delivery fee in
  final double total;
  final List<DeliveryLine> lines;

  /// The pin; null for an address the till took over the phone without one,
  /// which the rider finds by its words
  final double? latitude;
  final double? longitude;
  final String address;
  final String? building;
  final String? floor;
  final String? apartment;
  final String? directions;
  final String phone;
  final DeliveryStage stage;
  final DateTime? outAt;
  final DateTime? deliveredAt;

  /// The till took this delivery's cash from the rider
  final DateTime? cashHandedInAt;

  const DeliveryOrder({
    required this.orderNumber,
    required this.total,
    required this.address,
    required this.phone,
    required this.stage,
    this.confirmedAt,
    this.readyAt,
    this.customerName,
    this.customerNote,
    this.lines = const [],
    this.latitude,
    this.longitude,
    this.building,
    this.floor,
    this.apartment,
    this.directions,
    this.outAt,
    this.deliveredAt,
    this.cashHandedInAt,
  });

  factory DeliveryOrder.fromJson(Map<String, dynamic> json) {
    final d = (json['delivery'] as Map?)?.cast<String, dynamic>() ?? const {};
    return DeliveryOrder(
      orderNumber: _num(json['orderNumber']).round(),
      confirmedAt: _time(json['confirmedAt']),
      readyAt: _time(json['readyAt']),
      customerName: _text(json['customerName']),
      customerNote: _text(json['customerNote']),
      total: _num(json['total']),
      lines: [
        for (final line in (json['items'] as List? ?? const [])) DeliveryLine.fromJson((line as Map).cast<String, dynamic>()),
      ],
      latitude: d['latitude'] == null ? null : _num(d['latitude']),
      longitude: d['longitude'] == null ? null : _num(d['longitude']),
      address: _text(d['address']) ?? '',
      building: _text(d['building']),
      floor: _text(d['floor']),
      apartment: _text(d['apartment']),
      directions: _text(d['directions']),
      phone: _text(d['phone']) ?? '',
      stage: _stage(d['stage']),
      outAt: _time(d['outAt']),
      deliveredAt: _time(d['deliveredAt']),
      cashHandedInAt: _time(d['cashHandedInAt']),
    );
  }

  bool get isDelivered => stage == DeliveryStage.delivered;

  bool get isOut => stage == DeliveryStage.onTheWay;

  /// Delivered, and its cash still in the rider's pocket
  bool get cashInHand => isDelivered && cashHandedInAt == null;

  /// The address on one line, the street first: "Tahrir St · Bldg 12, Floor 3, Apt 7"
  String addressLine({required String building, required String floor, required String apartment}) {
    final parts = [
      if (this.building != null) '$building ${this.building}',
      if (this.floor != null) '$floor ${this.floor}',
      if (this.apartment != null) '$apartment ${this.apartment}',
    ];
    return parts.isEmpty ? address : '$address · ${parts.join('، ')}';
  }

  /// Whether the customer pinned the door, or only said where it is
  bool get hasPin => latitude != null && longitude != null;

  /// Google Maps' way to the door from wherever the rider is: to the pin, or
  /// to the address as the caller said it, for Maps to find
  Uri get directionsUri => Uri.parse(
      'https://www.google.com/maps/dir/?api=1&destination=${hasPin ? '$latitude,$longitude' : Uri.encodeQueryComponent(address)}');

  Uri get phoneUri => Uri(scheme: 'tel', path: phone);
}

/// The rider's day: what is still to go (oldest first), and what was
/// delivered (latest first), with the cash still to hand in at the till.
class RiderDay {
  final List<DeliveryOrder> toGo;
  final List<DeliveryOrder> delivered;

  const RiderDay({this.toGo = const [], this.delivered = const []});

  factory RiderDay.of(Iterable<DeliveryOrder> orders) {
    final toGo = orders.where((o) => !o.isDelivered).toList()
      ..sort((a, b) => (a.confirmedAt ?? DateTime(0)).compareTo(b.confirmedAt ?? DateTime(0)));
    final delivered = orders.where((o) => o.isDelivered).toList()
      ..sort((a, b) => (b.deliveredAt ?? DateTime(0)).compareTo(a.deliveredAt ?? DateTime(0)));
    return RiderDay(toGo: toGo, delivered: delivered);
  }

  /// Cash collected at doors and not yet handed in
  double get cashInHand => delivered.where((o) => o.cashInHand).fold(0, (sum, o) => sum + o.total);

  bool get isEmpty => toGo.isEmpty && delivered.isEmpty;
}
