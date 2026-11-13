import 'package:ninja_app_core/models/localized_text.dart';
import '../../deliveries/models/delivery_order.dart';

/// The branch's named area a delivery on the sale goes to, as it stood when
/// the cashier picked it: the sale pad asks the branch again for what it
/// charges there now, and this is what shows until it answers
class SaleDeliveryZone {
  final int id;
  final LocalizedText name;
  final double fee;
  final double minimumOrder;
  final int? etaMinutes;

  const SaleDeliveryZone({required this.id, required this.name, this.fee = 0, this.minimumOrder = 0, this.etaMinutes});

  factory SaleDeliveryZone.of(DeliveryZone zone) => SaleDeliveryZone(
        id: zone.zoneId,
        name: zone.name,
        fee: zone.fee,
        minimumOrder: zone.minimumOrder,
        etaMinutes: zone.etaMinutes,
      );

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name.toJson(),
        'fee': fee,
        'minimumOrder': minimumOrder,
        'etaMinutes': etaMinutes,
      };

  factory SaleDeliveryZone.fromJson(Map<String, dynamic> json) => SaleDeliveryZone(
        id: (json['id'] as num?)?.toInt() ?? 0,
        name: DeliveryZone.nameOf(json['name']) ?? const LocalizedText(),
        fee: (json['fee'] as num?)?.toDouble() ?? 0,
        minimumOrder: (json['minimumOrder'] as num?)?.toDouble() ?? 0,
        etaMinutes: (json['etaMinutes'] as num?)?.toInt(),
      );
}

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

  /// Another branch, nearer the caller, makes and delivers it; null keeps it here
  final DeliveryAlternative? sendTo;

  /// The branch's named area the cashier picked (or the pin fell in): its fee
  /// is what the delivery adds. Never with [sendTo]: an area is one branch's own.
  final SaleDeliveryZone? zone;

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
    this.sendTo,
    this.zone,
  });

  bool get hasPin => latitude != null && longitude != null;

  /// The area's id as the order carries it: none on an order sent to another branch
  int? get zoneId => sendTo == null ? zone?.id : null;

  SaleDelivery copyWith({
    DeliveryAlternative? sendTo,
    bool clearSendTo = false,
    SaleDeliveryZone? zone,
    bool clearZone = false,
  }) =>
      SaleDelivery(
        address: address,
        phone: phone,
        building: building,
        floor: floor,
        apartment: apartment,
        directions: directions,
        location: location,
        latitude: latitude,
        longitude: longitude,
        sendTo: clearSendTo ? null : sendTo ?? this.sendTo,
        zone: clearZone ? null : zone ?? this.zone,
      );

  /// The same delivery, made here after all
  SaleDelivery keptHere() => copyWith(clearSendTo: true);

  /// The same delivery with no named area: the branch's own fee holds again
  SaleDelivery withoutZone() => copyWith(clearZone: true);

  /// What it adds to the bill: the fee of the branch that delivers it, or of
  /// the named area it goes to here. [zoneFee] is what the branch says that
  /// area costs now; until it has answered, what it cost when it was picked.
  double feeWith(double hereFee, {double? zoneFee}) => sendTo?.fee ?? (zone == null ? hereFee : zoneFee ?? zone!.fee);

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
        if (zoneId != null) 'zoneId': zoneId,
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
        'sendTo': sendTo?.toJson(),
        if (zone != null) 'zone': zone!.toJson(),
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
        sendTo: json['sendTo'] is Map ? DeliveryAlternative.fromJson((json['sendTo'] as Map).cast<String, dynamic>()) : null,
        zone: json['zone'] is Map ? SaleDeliveryZone.fromJson((json['zone'] as Map).cast<String, dynamic>()) : null,
      );
}

/// The branch the delivery goes to, as the quote for the pin now in the form
/// offers it: kept only while the pin stands and that branch is still offered
/// (its fee and pause as they are now), dropped otherwise
DeliveryAlternative? keptSendTo(DeliveryAlternative? sendTo, List<DeliveryAlternative> alternatives, {required bool pinned}) {
  if (sendTo == null || !pinned) return null;
  for (final a in alternatives) {
    if (a.branchId == sendTo.branchId) return a;
  }
  return null;
}

/// Whether a sale holding a delivery can be charged as one. A delivery on the
/// sale is never quietly dropped: while the branch's terms are unknown, could
/// not be read, or no longer offer delivery, Charge waits and says why.
enum DeliveryCharge {
  /// No delivery on the sale (or a round on an open bill): an ordinary charge
  none,

  /// The branch delivers: it goes out with a rider
  ready,

  /// The branch's terms are still being read
  checking,

  /// The terms could not be read: retry, or remove the delivery
  failed,

  /// The business or the branch does not deliver now: remove the delivery to charge
  notOffered,
}

DeliveryCharge deliveryCharge({
  required bool hasDelivery,
  required bool addingToTicket,
  required bool featureOn,
  required bool termsKnown,
  required bool termsFailed,
  required bool delivers,
}) {
  if (!hasDelivery || addingToTicket) return DeliveryCharge.none;
  if (!featureOn) return DeliveryCharge.notOffered;
  if (termsKnown) return delivers ? DeliveryCharge.ready : DeliveryCharge.notOffered;
  return termsFailed ? DeliveryCharge.failed : DeliveryCharge.checking;
}

/// Charge waits for these
bool deliveryBlocksCharge(DeliveryCharge charge) =>
    charge == DeliveryCharge.checking || charge == DeliveryCharge.failed || charge == DeliveryCharge.notOffered;
