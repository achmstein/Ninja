import 'package:flutter/widgets.dart';
import 'package:forui/forui.dart';
import '../../../core/models/localized_text.dart';

/// What a place is, for icons and words. What it *does* comes from its
/// tariff (a timed place has one), not from its kind.
enum PlaceKind {
  room(1, 'Room', FIcons.doorOpen),
  table(2, 'Table', FIcons.armchair),
  station(3, 'Station', FIcons.trophy);

  final int value;

  /// As the services spell it in events and requests
  final String wireName;
  final IconData icon;

  const PlaceKind(this.value, this.wireName, this.icon);

  static PlaceKind fromValue(int? value) => PlaceKind.values.firstWhere(
        (e) => e.value == value,
        orElse: () => PlaceKind.room,
      );
}

/// Place display status from the API
enum PlaceStatus {
  available(1, 'Available'),
  occupied(2, 'Occupied'),
  held(3, 'Held'), // the customer has 10 min to arrive
  outOfService(4, 'Out of service');

  final int value;
  final String label;

  const PlaceStatus(this.value, this.label);

  static PlaceStatus fromValue(int value) {
    return PlaceStatus.values.firstWhere(
      (e) => e.value == value,
      orElse: () => PlaceStatus.available,
    );
  }
}

/// Stay status (1 was Held, before the reservation became its own thing)
enum StayStatus {
  running(2, 'Running'),
  ended(3, 'Ended'),
  cancelled(4, 'Cancelled');

  final int value;
  final String label;

  const StayStatus(this.value, this.label);

  static StayStatus fromValue(int value) {
    return StayStatus.values.firstWhere(
      (e) => e.value == value,
      orElse: () => StayStatus.ended,
    );
  }
}

/// Where a reservation is in its life
enum ReservationStatus {
  requested(1, 'Requested'),
  confirmed(2, 'Confirmed'),
  seated(3, 'Seated'),
  cancelled(4, 'Cancelled'),
  expired(5, 'Expired'),
  completed(6, 'Completed');

  final int value;
  final String label;

  const ReservationStatus(this.value, this.label);

  /// Requested or confirmed: somebody is on their way, or due later
  bool get isOpen => this == requested || this == confirmed;

  static ReservationStatus fromValue(int value) {
    return ReservationStatus.values.firstWhere(
      (e) => e.value == value,
      orElse: () => ReservationStatus.expired,
    );
  }
}

/// A reservation: a party's claim on a place, for now or for later, with
/// or without a clock. Seated at a timed place, a Stay takes over.
class Reservation {
  final int id;
  final int placeId;
  final PlaceKind placeKind;
  final LocalizedText placeName;
  final bool placeIsTimed;
  final String? customerId;
  final String? customerName;
  final int? partySize;

  /// When the party is expected; null means it was made for now
  final DateTime? forTime;
  final DateTime createdAt;

  /// When it lapses unseated; null while it never will (staff-made) or once closed
  final DateTime? expiresAt;

  /// On a timed place: the customer asked that Confirm also start the clock
  final bool startOnConfirm;

  /// The rate the customer asked to start at; Confirm starts at it
  final String? requestedOptionCode;
  final LocalizedText? requestedOptionName;
  final ReservationStatus status;

  /// Open, and keeping the place right now: made for now, or its time has come
  final bool isHolding;
  final int? stayId;

  Reservation({
    required this.id,
    required this.placeId,
    this.placeKind = PlaceKind.room,
    required this.placeName,
    this.placeIsTimed = false,
    this.customerId,
    this.customerName,
    this.partySize,
    this.forTime,
    required this.createdAt,
    this.expiresAt,
    this.startOnConfirm = false,
    this.requestedOptionCode,
    this.requestedOptionName,
    required this.status,
    this.isHolding = false,
    this.stayId,
  });

  bool get isOpen => status.isOpen;

  factory Reservation.fromJson(Map<String, dynamic> json) {
    return Reservation(
      id: json['id'] as int,
      placeId: json['placeId'] as int,
      placeKind: PlaceKind.fromValue(json['placeKind'] as int?),
      placeName: LocalizedText.parse(json['placeName'] ?? 'Place ${json['placeId']}'),
      placeIsTimed: json['placeIsTimed'] as bool? ?? false,
      customerId: json['customerId'] as String?,
      customerName: json['customerName'] as String?,
      partySize: (json['partySize'] as num?)?.toInt(),
      forTime: json['for'] != null ? DateTime.parse(json['for'] as String) : null,
      createdAt: DateTime.parse(json['createdAt'] as String),
      expiresAt: json['expiresAt'] != null ? DateTime.parse(json['expiresAt'] as String) : null,
      startOnConfirm: json['startOnConfirm'] as bool? ?? false,
      requestedOptionCode: json['requestedOptionCode'] as String?,
      requestedOptionName:
          json['requestedOptionName'] != null ? LocalizedText.parse(json['requestedOptionName']) : null,
      status: ReservationStatus.fromValue(json['status'] as int),
      isHolding: json['isHolding'] as bool? ?? false,
      stayId: (json['stayId'] as num?)?.toInt(),
    );
  }
}

/// The party seated at a plain table on their reservation: theirs until
/// the till clears it (a timed place has a stay instead).
class SeatedParty {
  final int reservationId;
  final String? customerName;
  final int? partySize;
  final DateTime? seatedAt;

  const SeatedParty({required this.reservationId, this.customerName, this.partySize, this.seatedAt});

  static SeatedParty? parse(Object? json) {
    if (json is! Map<String, dynamic>) return null;
    return SeatedParty(
      reservationId: json['reservationId'] as int,
      customerName: json['customerName'] as String?,
      partySize: (json['partySize'] as num?)?.toInt(),
      seatedAt: json['seatedAt'] != null ? DateTime.parse(json['seatedAt'] as String) : null,
    );
  }
}

/// One way time at a place is charged: a room has "single" and "multi", a
/// timed table usually one.
class RateOption {
  final String code;
  final LocalizedText name;
  final double hourlyRate;

  const RateOption({required this.code, required this.name, required this.hourlyRate});

  factory RateOption.fromJson(Map<String, dynamic> json) => RateOption(
        code: json['code'] as String? ?? '',
        name: LocalizedText.parse(json['name']),
        hourlyRate: (json['hourlyRate'] as num?)?.toDouble() ?? 0,
      );

  Map<String, dynamic> toJson() => {'code': code, 'name': name.toJson(), 'hourlyRate': hourlyRate};
}

List<RateOption> _parseOptions(dynamic tariff) {
  if (tariff is! Map<String, dynamic>) return const [];
  return (tariff['options'] as List<dynamic>? ?? const [])
      .map((e) => RateOption.fromJson(e as Map<String, dynamic>))
      .toList();
}

int _parseRounding(dynamic tariff) =>
    tariff is Map<String, dynamic> ? (tariff['roundingMinutes'] as num?)?.toInt() ?? 15 : 15;

/// A place: a room, a table, a station. Timed when it has a tariff.
class Place {
  final int id;
  final PlaceKind kind;
  final LocalizedText name;
  final LocalizedText? description;
  final PlaceStatus status;
  final bool isActive;
  final List<RateOption> options;
  final int roundingMinutes;
  final bool canReserve;

  /// The party seated here on their reservation, at a plain table
  final SeatedParty? seatedReservation;

  Place({
    required this.id,
    this.kind = PlaceKind.room,
    required this.name,
    this.description,
    required this.status,
    this.isActive = true,
    this.options = const [],
    this.roundingMinutes = 15,
    this.canReserve = true,
    this.seatedReservation,
  });

  /// A place with a clock
  bool get isTimed => options.isNotEmpty;

  /// A choice of rates to make (single / multi)
  bool get hasOptions => options.length > 1;

  /// The older two-rate view of a room: the first option, and the second
  double get singleRate => options.isNotEmpty ? options.first.hourlyRate : 0;
  double get multiRate => options.length > 1 ? options[1].hourlyRate : singleRate;

  RateOption? option(String? code) => options.where((o) => o.code == code).firstOrNull;

  factory Place.fromJson(Map<String, dynamic> json) {
    return Place(
      id: json['id'] as int,
      kind: PlaceKind.fromValue(json['kind'] as int?),
      name: LocalizedText.parse(json['name']),
      description: LocalizedText.parseNullable(json['description']),
      status: PlaceStatus.fromValue(json['status'] as int? ?? 1),
      isActive: json['isActive'] as bool? ?? true,
      options: _parseOptions(json['tariff']),
      roundingMinutes: _parseRounding(json['tariff']),
      canReserve: json['canReserve'] as bool? ?? true,
      seatedReservation: SeatedParty.parse(json['seatedReservation']),
    );
  }
}

/// Session member model
class StayMember {
  final String customerId;
  final String? customerName;
  final DateTime joinedAt;
  final String role; // "Owner" or "Member"

  StayMember({
    required this.customerId,
    this.customerName,
    required this.joinedAt,
    required this.role,
  });

  bool get isOwner => role == 'Owner';

  factory StayMember.fromJson(Map<String, dynamic> json) {
    return StayMember(
      customerId: json['customerId'] as String,
      customerName: json['customerName'] as String?,
      joinedAt: DateTime.parse(json['joinedAt'] as String),
      role: json['role'] as String? ?? 'Member',
    );
  }
}

/// A stretch of a stay charged at one rate option
class StaySegment {
  final String optionCode;
  final LocalizedText optionName;
  final double hourlyRate;
  final DateTime startTime;
  final DateTime? endTime;

  StaySegment({
    required this.optionCode,
    required this.optionName,
    required this.hourlyRate,
    required this.startTime,
    this.endTime,
  });

  factory StaySegment.fromJson(Map<String, dynamic> json) {
    return StaySegment(
      optionCode: json['optionCode'] as String? ?? '',
      optionName: LocalizedText.parse(json['optionName']),
      hourlyRate: (json['hourlyRate'] as num?)?.toDouble() ?? 0,
      startTime: DateTime.parse(json['startTime'] as String),
      endTime: json['endTime'] != null ? DateTime.parse(json['endTime'] as String) : null,
    );
  }
}

/// What one rate option of a stay cost, as the server settled it
class StayCost {
  final String optionCode;
  final LocalizedText optionName;
  final double hourlyRate;
  final double hours;
  final double cost;

  const StayCost({
    required this.optionCode,
    required this.optionName,
    required this.hourlyRate,
    required this.hours,
    required this.cost,
  });

  factory StayCost.fromJson(Map<String, dynamic> json) => StayCost(
        optionCode: json['optionCode'] as String? ?? '',
        optionName: LocalizedText.parse(json['optionName']),
        hourlyRate: (json['hourlyRate'] as num?)?.toDouble() ?? 0,
        hours: (json['hours'] as num?)?.toDouble() ?? 0,
        cost: (json['cost'] as num?)?.toDouble() ?? 0,
      );
}

/// A stay: one party's timed use of a place — the running clock, the
/// ended one on the bill. The reservation before it is its own thing.
class Stay {
  final int id;
  final int placeId;
  final PlaceKind placeKind;
  final LocalizedText placeName;
  final String? customerId;
  final String? userName;
  final DateTime createdAt;
  final DateTime? startedAt;
  final DateTime? endedAt;
  final double? totalCost;
  final StayStatus status;
  final List<RateOption> options;
  final int roundingMinutes;
  final String? currentOptionCode;
  final LocalizedText? currentOptionName;
  final List<StayCost> costs;
  final List<StayMember> members;
  final List<StaySegment> segments;

  Stay({
    required this.id,
    required this.placeId,
    this.placeKind = PlaceKind.room,
    required this.placeName,
    this.customerId,
    this.userName,
    required this.createdAt,
    this.startedAt,
    this.endedAt,
    this.totalCost,
    required this.status,
    this.options = const [],
    this.roundingMinutes = 15,
    this.currentOptionCode,
    this.currentOptionName,
    this.costs = const [],
    this.members = const [],
    this.segments = const [],
  });

  /// A choice of rates on this place (the option pill and toggle)
  bool get hasOptions => options.length > 1;

  RateOption? option(String? code) => options.where((o) => o.code == code).firstOrNull;

  /// The rate running right now, if the clock runs
  double get activeRate => option(currentOptionCode)?.hourlyRate ?? 0;

  /// Calculate duration if session has started
  Duration? get duration {
    if (startedAt == null) return null;
    final end = endedAt ?? DateTime.now();
    return end.difference(startedAt!);
  }

  /// Format duration as HH:MM:SS
  String get formattedDuration {
    final d = duration;
    if (d == null) return '--:--:--';
    final hours = d.inHours.toString().padLeft(2, '0');
    final minutes = (d.inMinutes % 60).toString().padLeft(2, '0');
    final seconds = (d.inSeconds % 60).toString().padLeft(2, '0');
    return '$hours:$minutes:$seconds';
  }

  factory Stay.fromJson(Map<String, dynamic> json) {
    final statusValue = json['status'];
    StayStatus status;
    if (statusValue is int) {
      status = StayStatus.fromValue(statusValue);
    } else if (statusValue is String) {
      status = StayStatus.values.firstWhere(
        (e) => e.name.toLowerCase() == statusValue.toLowerCase(),
        orElse: () => StayStatus.ended,
      );
    } else {
      status = StayStatus.ended;
    }

    final members = (json['members'] as List<dynamic>?)
            ?.map((e) => StayMember.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];
    final segments = (json['segments'] as List<dynamic>?)
            ?.map((e) => StaySegment.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];
    final costs = (json['costs'] as List<dynamic>?)
            ?.map((e) => StayCost.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];

    return Stay(
      id: json['id'] as int,
      placeId: json['placeId'] as int,
      placeKind: PlaceKind.fromValue(json['placeKind'] as int?),
      placeName: LocalizedText.parse(json['placeName'] ?? 'Place ${json['placeId']}'),
      customerId: json['customerId'] as String?,
      userName: json['customerName'] as String?,
      createdAt: DateTime.parse(json['createdAt'] as String),
      startedAt: json['startedAt'] != null ? DateTime.parse(json['startedAt'] as String) : null,
      endedAt: json['endedAt'] != null ? DateTime.parse(json['endedAt'] as String) : null,
      totalCost: (json['totalCost'] as num?)?.toDouble(),
      status: status,
      options: _parseOptions(json['tariff']),
      roundingMinutes: _parseRounding(json['tariff']),
      currentOptionCode: json['currentOptionCode'] as String?,
      currentOptionName:
          json['currentOptionName'] != null ? LocalizedText.parse(json['currentOptionName']) : null,
      costs: costs,
      members: members,
      segments: segments,
    );
  }
}
