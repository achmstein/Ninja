import '../../../core/models/localized_text.dart';
import '../../../core/models/money.dart';
import '../../orders/models/order.dart';

/// Where a delivery stands for the till: nobody has it, a rider has it, its
/// cash is still out, or settled
enum DeliveryLane { waiting, withRider, cashDue, done }

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
  final int orderNumber;
  final DateTime date;
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
    required this.date,
    this.confirmedAt,
    this.readyAt,
    this.paidAt,
    this.customerName,
    this.customerNote,
    required this.total,
    this.items = const [],
    required this.delivery,
  });

  static DateTime? _time(Object? value) => value is String ? DateTime.tryParse(value)?.toLocal() : null;

  factory DeliveryOrder.fromJson(Map<String, dynamic> json) => DeliveryOrder(
        orderNumber: toInt(json['orderNumber']),
        date: _time(json['date']) ?? DateTime.now(),
        confirmedAt: _time(json['confirmedAt']),
        readyAt: _time(json['readyAt']),
        paidAt: _time(json['paidAt']),
        customerName: json['customerName'] as String?,
        customerNote: json['customerNote'] as String?,
        total: toNumber(json['total']),
        items: [
          for (final line in (json['items'] as List<dynamic>? ?? const []))
            DeliveryLine.fromJson((line as Map).cast<String, dynamic>()),
        ],
        delivery: OrderDelivery.parse((json['delivery'] as Map?)?.cast<String, dynamic>()) ??
            const OrderDelivery(address: '', phone: ''),
      );

  DeliveryLane get lane {
    if (delivery.cashHandedInAt != null || paidAt != null) return DeliveryLane.done;
    if (delivery.deliveredAt != null) return DeliveryLane.cashDue;
    if ((delivery.riderUserId ?? '').isNotEmpty) return DeliveryLane.withRider;
    return DeliveryLane.waiting;
  }

  /// When the board started counting: confirmed, else placed
  DateTime get since => confirmedAt ?? date;
}

/// The board's order: waiting first, then with a rider, then cash due;
/// settled ones are not on it
List<DeliveryOrder> boardOrder(Iterable<DeliveryOrder> deliveries) => [
      for (final lane in const [DeliveryLane.waiting, DeliveryLane.withRider, DeliveryLane.cashDue])
        ...deliveries.where((d) => d.lane == lane),
    ];

/// A rider as the till's picker shows them; [signedIn] is false until their
/// app first opens at the branch
class TillRider {
  final String userId;
  final String name;
  final bool onDuty;
  final int out;
  final bool signedIn;

  const TillRider({required this.userId, required this.name, this.onDuty = false, this.out = 0, this.signedIn = true});

  factory TillRider.fromJson(Map<String, dynamic> json) => TillRider(
        userId: json['userId'] as String? ?? '',
        name: json['name'] as String? ?? '',
        onDuty: json['onDuty'] == true,
        out: toInt(json['out']),
      );
}

/// A rider account Identity knows, with the branches it was given
class RiderAccount {
  final String id;
  final String name;
  final List<int> branches;

  const RiderAccount({required this.id, required this.name, this.branches = const []});

  factory RiderAccount.fromJson(Map<String, dynamic> json) {
    final name = [json['firstName'], json['lastName']].whereType<String>().where((s) => s.trim().isNotEmpty).join(' ');
    return RiderAccount(
      id: json['id'] as String? ?? '',
      name: name.isNotEmpty ? name : (json['username'] as String? ?? ''),
      branches: [for (final b in (json['branches'] as List<dynamic>? ?? const [])) toInt(b)],
    );
  }
}

/// Every rider given this branch: those whose app has checked in, in
/// Ordering's order (on duty first), then those added in Staff who have not
/// opened the app here yet, by name. A delivery can go to either; the
/// second sees it when they sign in.
List<TillRider> mergeRiders(List<TillRider> heard, List<RiderAccount> accounts, int? branchId) {
  final known = {for (final r in heard) r.userId};
  final notYet = [
    for (final a in accounts)
      if (branchId != null && !known.contains(a.id) && a.branches.contains(branchId))
        TillRider(userId: a.id, name: a.name, signedIn: false),
  ]..sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
  return [...heard, ...notYet];
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

  factory KnownAddress.fromJson(Map<String, dynamic> json) => KnownAddress(
        label: json['label'] as String?,
        latitude: json['latitude'] == null ? null : toNumber(json['latitude']),
        longitude: json['longitude'] == null ? null : toNumber(json['longitude']),
        address: json['address'] as String? ?? '',
        building: json['building'] as String?,
        floor: json['floor'] as String?,
        apartment: json['apartment'] as String?,
        directions: json['directions'] as String?,
        phone: json['phone'] as String?,
      );
}

/// How far, said briefly: 800 m, 2.4 km
String distanceText(int meters, {required String Function(int) metres, required String Function(String) kilometres}) =>
    meters < 950 ? metres((meters / 10).round().clamp(1, 95) * 10) : kilometres(((meters / 100).round() / 10).toString());
