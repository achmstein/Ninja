import '../../../core/config/app_config.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/models/money.dart';
import '../../orders/models/order.dart';

/// Where a delivery stands for the till, from the server's stage: nobody has
/// it, a rider has it, the rider is bringing it back, it is back (the order
/// to cancel), its cash is still out, or settled
enum DeliveryLane { waiting, withRider, failed, returned, cashDue, done }

/// One line of the bag, as the till reads it back to the rider
class DeliveryLine {
  final LocalizedText name;
  final int units;
  final LocalizedText? options;

  const DeliveryLine({required this.name, required this.units, this.options});

  factory DeliveryLine.fromJson(Map<String, dynamic> json) => DeliveryLine(
        name: LocalizedText.parse(json['productName']),
        units: toInt(json['units']),
        options: LocalizedText.parseNullable(json['customizationsDescription']),
      );
}

/// A delivery on the till's board (`GET /api/orders/deliveries`): the
/// order, what to collect at the door, and where it goes
class DeliveryOrder {
  /// The order's id, which is also the number the till and the customer see
  final int orderNumber;
  final DateTime? date;
  final DateTime? confirmedAt;
  final DateTime? readyAt;
  final DateTime? paidAt;
  final String? customerName;
  final String? customerNote;

  /// Cash to collect at the door, the delivery fee in
  final double total;
  final List<DeliveryLine> items;
  final OrderDelivery delivery;

  const DeliveryOrder({
    required this.orderNumber,
    this.date,
    this.confirmedAt,
    this.readyAt,
    this.paidAt,
    this.customerName,
    this.customerNote,
    required this.total,
    this.items = const [],
    required this.delivery,
  });

  /// Kept in UTC, the server's own; drawn in the till's local time
  static DateTime? _time(Object? value) => value is String ? DateTime.tryParse(value)?.toUtc() : null;

  static String? _text(Object? value) {
    final text = value is String ? value.trim() : null;
    return text == null || text.isEmpty ? null : text;
  }

  factory DeliveryOrder.fromJson(Map<String, dynamic> json) => DeliveryOrder(
        orderNumber: toInt(json['orderNumber']),
        date: _time(json['date']),
        confirmedAt: _time(json['confirmedAt']),
        readyAt: _time(json['readyAt']),
        paidAt: _time(json['paidAt']),
        customerName: _text(json['customerName']),
        customerNote: _text(json['customerNote']),
        total: toNumber(json['total']),
        items: [
          for (final line in (json['items'] as List<dynamic>? ?? const <dynamic>[]))
            DeliveryLine.fromJson((line as Map).cast<String, dynamic>()),
        ],
        delivery: OrderDelivery.parse((json['delivery'] as Map?)?.cast<String, dynamic>()) ??
            const OrderDelivery(address: '', phone: ''),
      );

  /// The server's stage is the one authority; the till only adds "settled"
  DeliveryLane get lane {
    if (delivery.cashHandedInAt != null || paidAt != null) return DeliveryLane.done;
    return switch (delivery.stage) {
      DeliveryStage.waiting => DeliveryLane.waiting,
      DeliveryStage.assigned || DeliveryStage.onTheWay => DeliveryLane.withRider,
      DeliveryStage.failed => DeliveryLane.failed,
      DeliveryStage.returned => DeliveryLane.returned,
      DeliveryStage.delivered => DeliveryLane.cashDue,
    };
  }

  bool get isOut => delivery.stage == DeliveryStage.onTheWay;

  /// When the board started counting: confirmed, else placed; null when the server said neither
  DateTime? get since => confirmedAt ?? date;
}

/// The board's order: waiting first, then with a rider, then coming back and
/// back (both need the till), then cash due; settled ones are not on it
List<DeliveryOrder> boardOrder(Iterable<DeliveryOrder> deliveries) => [
      for (final lane in const [DeliveryLane.waiting, DeliveryLane.withRider, DeliveryLane.failed, DeliveryLane.returned, DeliveryLane.cashDue])
        ...deliveries.where((d) => d.lane == lane),
    ];

/// A rider as the till's picker shows them (`GET /api/orders/riders`):
/// Ordering lists every rider of the branch, [signedIn] false until their
/// app first opens there
class TillRider {
  final String userId;
  final String name;
  final bool onDuty;
  final int out;
  final bool signedIn;

  const TillRider({required this.userId, required this.name, this.onDuty = false, this.out = 0, this.signedIn = true});

  factory TillRider.fromJson(Map<String, dynamic> json) => TillRider(
        userId: (json['userId'] as String? ?? '').trim(),
        name: (json['name'] as String? ?? '').trim(),
        onDuty: json['onDuty'] == true,
        out: toInt(json['out']),
        signedIn: json['signedIn'] != false,
      );
}

/// The branch's answer for a delivery the till takes over the phone
/// (`GET /api/orders/delivery/till-quote`)
class TillDeliveryQuote {
  final bool delivers;

  /// Within the radius; true without a pin, where the cashier knows the streets
  final bool inRange;
  final int? distanceMeters;
  final double fee;
  final double minimumOrder;
  final double radiusKm;

  /// The pin read from the pasted location
  final double? latitude;
  final double? longitude;

  /// False when a location was pasted but no point could be read from it
  final bool locationRead;

  const TillDeliveryQuote({
    this.delivers = false,
    this.inRange = true,
    this.distanceMeters,
    this.fee = 0,
    this.minimumOrder = 0,
    this.radiusKm = 0,
    this.latitude,
    this.longitude,
    this.locationRead = true,
  });

  bool get pinned => latitude != null && longitude != null;

  factory TillDeliveryQuote.fromJson(Map<String, dynamic> json) => TillDeliveryQuote(
        delivers: json['delivers'] == true,
        inRange: json['inRange'] != false,
        distanceMeters: json['distanceMeters'] == null ? null : toInt(json['distanceMeters']),
        fee: toNumber(json['fee']),
        minimumOrder: toNumber(json['minimumOrder']),
        radiusKm: toNumber(json['radiusKm']),
        latitude: json['latitude'] == null ? null : toNumber(json['latitude']),
        longitude: json['longitude'] == null ? null : toNumber(json['longitude']),
        locationRead: json['locationRead'] != false,
      );
}

/// An address a caller had before: one they saved, or one an earlier
/// delivery went to (`GET /api/orders/delivery/known-addresses`)
class KnownAddress {
  final String? label;
  final double? latitude;
  final double? longitude;
  final String address;
  final String? building;
  final String? floor;
  final String? apartment;
  final String? directions;
  final String? phone;

  const KnownAddress({
    this.label,
    this.latitude,
    this.longitude,
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

  factory KnownAddress.fromJson(Map<String, dynamic> json) => KnownAddress(
        label: _text(json['label']),
        latitude: json['latitude'] == null ? null : toNumber(json['latitude']),
        longitude: json['longitude'] == null ? null : toNumber(json['longitude']),
        address: _text(json['address']) ?? '',
        building: _text(json['building']),
        floor: _text(json['floor']),
        apartment: _text(json['apartment']),
        directions: _text(json['directions']),
        phone: _text(json['phone']),
      );

  /// The same door, whichever list it came from
  String get identity => [address, building, floor, apartment].map((s) => (s ?? '').toLowerCase()).join('|');
}

/// How far, said briefly: 800 m, 2.4 km
String distanceText(int meters, {required String Function(int) metres, required String Function(String) kilometres}) =>
    meters < AppConfig.metresUntilKm
        ? metres((meters / 10).round().clamp(1, AppConfig.metresUntilKm ~/ 10) * 10)
        : kilometres(((meters / 100).round() / 10).toString());
