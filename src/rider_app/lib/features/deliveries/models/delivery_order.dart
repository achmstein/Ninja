import 'package:ninja_app_core/models/localized_text.dart';

/// Where a delivery has got to, as the server says it
enum DeliveryStage {
  waiting,
  assigned,
  onTheWay,
  delivered,

  /// The rider could not hand it over (nobody at the door, refused): the bag goes back to the branch
  failed,

  /// The bag is back at the branch; nothing left for the rider
  returned;

  /// The server's spelling of a stage; anything unknown is one still waiting
  static DeliveryStage parse(Object? value) => switch (value) {
        'Assigned' => assigned,
        'OnTheWay' => onTheWay,
        'Delivered' => delivered,
        'Failed' => failed,
        'Returned' => returned,
        _ => waiting,
      };
}

double _num(Object? value) => value is num ? value.toDouble() : double.tryParse('${value ?? ''}') ?? 0;

double? _numOrNull(Object? value) => value == null ? null : _num(value);

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
  /// The order's id, which is also the number the till and the customer see
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

  /// Why it could not be handed over, as the rider said it
  final String? failureReason;

  /// The till took this delivery's cash from the rider
  final DateTime? cashHandedInAt;

  /// What the till counted in from the rider for it
  final double? cashCollected;

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
    this.failureReason,
    this.cashHandedInAt,
    this.cashCollected,
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
      latitude: _numOrNull(d['latitude']),
      longitude: _numOrNull(d['longitude']),
      address: _text(d['address']) ?? '',
      building: _text(d['building']),
      floor: _text(d['floor']),
      apartment: _text(d['apartment']),
      directions: _text(d['directions']),
      phone: _text(d['phone']) ?? '',
      stage: DeliveryStage.parse(d['stage']),
      outAt: _time(d['outAt']),
      deliveredAt: _time(d['deliveredAt']),
      failureReason: _text(d['failureReason']),
      cashHandedInAt: _time(d['cashHandedInAt']),
      cashCollected: _numOrNull(d['cashCollected']),
    );
  }

  bool get isDelivered => stage == DeliveryStage.delivered;

  bool get isOut => stage == DeliveryStage.onTheWay;

  bool get isFailed => stage == DeliveryStage.failed;

  /// Nothing left for the rider: handed over, or the bag is back at the branch
  bool get isDone => stage == DeliveryStage.delivered || stage == DeliveryStage.returned;

  /// Delivered, and its cash still in the rider's pocket
  bool get cashInHand => isDelivered && cashHandedInAt == null;

  /// The address on one line, the street first: "Tahrir St · Bldg 12, Floor 3, Apt 7".
  /// [separator] is the language's list comma (", " or "، "), from the app's strings.
  String addressLine({required String building, required String floor, required String apartment, required String separator}) {
    final parts = [
      if (this.building != null) '$building ${this.building}',
      if (this.floor != null) '$floor ${this.floor}',
      if (this.apartment != null) '$apartment ${this.apartment}',
    ];
    return parts.isEmpty ? address : '$address · ${parts.join(separator)}';
  }

  /// Whether the customer pinned the door, or only said where it is
  bool get hasPin => latitude != null && longitude != null;

  /// Google Maps' way to the door from wherever the rider is: to the pin, or
  /// to the address as the caller said it, for Maps to find
  Uri get directionsUri => Uri.parse(
      'https://www.google.com/maps/dir/?api=1&destination=${hasPin ? '$latitude,$longitude' : Uri.encodeQueryComponent(address)}');

  /// The customer's number to dial: only what a dialler reads (digits, a leading +)
  Uri get phoneUri => Uri(scheme: 'tel', path: phone.replaceAll(RegExp(r'[^0-9+]'), ''));
}

/// The rider's day: what is still theirs to do (oldest first: to deliver, or
/// a bag to bring back), and what is done (latest first), with the cash still
/// to hand in at the till.
class RiderDay {
  final List<DeliveryOrder> toGo;
  final List<DeliveryOrder> delivered;

  const RiderDay({this.toGo = const [], this.delivered = const []});

  factory RiderDay.of(Iterable<DeliveryOrder> orders) {
    final toGo = orders.where((o) => !o.isDone).toList()
      ..sort((a, b) => (a.confirmedAt ?? DateTime(0)).compareTo(b.confirmedAt ?? DateTime(0)));
    final delivered = orders.where((o) => o.isDone).toList()
      ..sort((a, b) => (b.deliveredAt ?? b.outAt ?? DateTime(0)).compareTo(a.deliveredAt ?? a.outAt ?? DateTime(0)));
    return RiderDay(toGo: toGo, delivered: delivered);
  }

  /// Cash collected at doors and not yet handed in
  double get cashInHand => delivered.where((o) => o.cashInHand).fold(0, (sum, o) => sum + o.total);

  /// A delivery is on the road: an update must not interrupt the rider
  bool get anyOut => toGo.any((o) => o.isOut);

  bool get isEmpty => toGo.isEmpty && delivered.isEmpty;
}
