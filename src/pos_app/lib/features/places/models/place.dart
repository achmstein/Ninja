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

/// Stay status
enum StayStatus {
  held(1, 'Held'),
  running(2, 'Running'),
  ended(3, 'Ended'),
  cancelled(4, 'Cancelled');

  final int value;
  final String label;

  const StayStatus(this.value, this.label);

  static StayStatus fromValue(int value) {
    return StayStatus.values.firstWhere(
      (e) => e.value == value,
      orElse: () => StayStatus.held,
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

  /// The id a printed table sticker carries; what an older bill names
  final int? legacyTableId;

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
    this.legacyTableId,
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
      legacyTableId: (json['legacyTableId'] as num?)?.toInt(),
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

/// A stay: one party's timed use of a place — the hold, the running clock,
/// the ended one on the bill.
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

  /// The customer asked that the till's Confirm also start the clock
  final bool startOnConfirm;
  final List<StayCost> costs;
  final DateTime? expiresAt;
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
    this.startOnConfirm = false,
    this.costs = const [],
    this.expiresAt,
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

  /// Check if this hold is about to expire
  bool get isExpiring {
    if (status != StayStatus.held || expiresAt == null) return false;
    return DateTime.now().isAfter(expiresAt!);
  }

  /// Get remaining time until expiration
  Duration? get timeUntilExpiration {
    if (status != StayStatus.held || expiresAt == null) return null;
    final remaining = expiresAt!.difference(DateTime.now());
    return remaining.isNegative ? Duration.zero : remaining;
  }

  /// Format remaining time as MM:SS countdown
  String get formattedCountdown {
    final remaining = timeUntilExpiration;
    if (remaining == null) return '--:--';
    final minutes = remaining.inMinutes.toString().padLeft(2, '0');
    final seconds = (remaining.inSeconds % 60).toString().padLeft(2, '0');
    return '$minutes:$seconds';
  }

  factory Stay.fromJson(Map<String, dynamic> json) {
    final statusValue = json['status'];
    StayStatus status;
    if (statusValue is int) {
      status = StayStatus.fromValue(statusValue);
    } else if (statusValue is String) {
      status = StayStatus.values.firstWhere(
        (e) => e.name.toLowerCase() == statusValue.toLowerCase(),
        orElse: () => StayStatus.held,
      );
    } else {
      status = StayStatus.held;
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
      startOnConfirm: json['startOnConfirm'] as bool? ?? false,
      costs: costs,
      expiresAt: json['expiresAt'] != null ? DateTime.parse(json['expiresAt'] as String) : null,
      members: members,
      segments: segments,
    );
  }
}
