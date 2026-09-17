import 'package:flutter/widgets.dart';
import 'package:forui/forui.dart';
import '../../../l10n/app_localizations.dart';

import '../../../core/models/localized_text.dart';

/// What a place is, for icons and words. What it *does* comes from its
/// tariff (a timed place has one), not from its kind.
enum PlaceKind {
  room(1, 'Room', FIcons.gamepad2),
  table(2, 'Table', FIcons.armchair),
  station(3, 'Station', FIcons.trophy);

  final int value;

  /// As the services spell it in events and requests
  final String wireName;
  final IconData icon;

  const PlaceKind(this.value, this.wireName, this.icon);

  static PlaceKind fromValue(int? value) {
    return PlaceKind.values.firstWhere(
      (e) => e.value == value,
      orElse: () => PlaceKind.room,
    );
  }
}

/// Place display status (computed at query time)
enum PlaceStatus {
  available(1, 'Available'),
  occupied(2, 'Occupied'),
  reserved(3, 'Reserved'), // Held: the customer has 10 min to arrive
  maintenance(4, 'Maintenance');

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
  reserved(1, 'Held'),
  active(2, 'Running'),
  completed(3, 'Ended'),
  cancelled(4, 'Cancelled');

  final int value;
  final String label;

  const StayStatus(this.value, this.label);

  static StayStatus fromValue(int value) {
    return StayStatus.values.firstWhere(
      (e) => e.value == value,
      orElse: () => StayStatus.reserved,
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
}

List<RateOption> _parseOptions(dynamic tariff) {
  if (tariff is! Map<String, dynamic>) return const [];
  return (tariff['options'] as List<dynamic>? ?? const [])
      .map((e) => RateOption.fromJson(e as Map<String, dynamic>))
      .toList();
}

/// A timed place: a PlayStation room, a table or a station with a clock.
class Place {
  final int id;
  final PlaceKind kind;
  final LocalizedText name;
  final LocalizedText? description;
  final PlaceStatus displayStatus;
  final bool isActive;
  final List<RateOption> options;
  final bool canReserve;
  final bool takesControllerRequests;

  Place({
    required this.id,
    this.kind = PlaceKind.room,
    required this.name,
    this.description,
    required this.displayStatus,
    this.isActive = true,
    this.options = const [],
    this.canReserve = true,
    this.takesControllerRequests = true,
  });

  /// A choice to make between rates (single / multi)
  bool get hasOptions => options.length > 1;

  /// Can the user hold this place now?
  bool get canBookNow => canReserve && displayStatus == PlaceStatus.available;

  factory Place.fromJson(Map<String, dynamic> json) {
    return Place(
      id: json['id'] as int,
      kind: PlaceKind.fromValue(json['kind'] as int?),
      name: LocalizedText.parse(json['name']),
      description: json['description'] != null ? LocalizedText.parse(json['description']) : null,
      displayStatus: PlaceStatus.fromValue(json['status'] as int? ?? 1),
      isActive: json['isActive'] as bool? ?? true,
      options: _parseOptions(json['tariff']),
      canReserve: json['canReserve'] as bool? ?? true,
      takesControllerRequests: json['takesControllerRequests'] as bool? ?? true,
    );
  }
}

/// Session member model
class StayMember {
  final String customerId;
  final String? customerName;
  final DateTime joinedAt;
  final String role;

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

/// A stretch of the stay charged at one rate option
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

/// A stay: one party's timed use of a place — the hold, the running clock,
/// the ended one on the bill.
class Stay {
  final int id;
  final int placeId;
  final PlaceKind placeKind;
  final LocalizedText placeName;
  final List<RateOption> options;
  final DateTime createdAt;
  final DateTime? startedAt;
  final DateTime? endTime;
  final double? totalCost;
  final StayStatus status;
  final String? notes;
  final String? currentOptionCode;
  final LocalizedText? currentOptionName;

  /// The customer asked that the till's Confirm also start the clock
  final bool startOnConfirm;

  /// The rate they asked to start at, while held; the till confirms at it
  final String? requestedOptionCode;
  final LocalizedText? requestedOptionName;
  final String? customerId;
  final List<StayMember> members;
  final List<StaySegment> segments;

  /// The till's receipt, projected by Spaces: null while the bill is open
  final int? receiptNumber;
  final DateTime? paidAt;

  /// "Cash", "Card", "InstaPay", "Account" (the customer's tab) or "Mixed"
  final String? paidWith;

  /// The Sales ticket the time was billed on — what the receipt opens
  final int? ticketId;

  Stay({
    required this.id,
    required this.placeId,
    this.placeKind = PlaceKind.room,
    required this.placeName,
    this.options = const [],
    required this.createdAt,
    this.startedAt,
    this.endTime,
    this.totalCost,
    required this.status,
    this.notes,
    this.currentOptionCode,
    this.currentOptionName,
    this.startOnConfirm = false,
    this.requestedOptionCode,
    this.requestedOptionName,
    this.customerId,
    this.members = const [],
    this.segments = const [],
    this.receiptNumber,
    this.paidAt,
    this.paidWith,
    this.ticketId,
  });

  /// A choice of rates on this place (the option pill and switch buttons)
  bool get hasOptions => options.length > 1;

  /// The rate running right now, if the clock runs
  double? get currentHourlyRate =>
      options.where((o) => o.code == currentOptionCode).map((o) => o.hourlyRate).firstOrNull;

  /// The place takes a controller request: a console room
  bool get takesControllerRequests => placeKind == PlaceKind.room;

  /// The colour slot of an option: the first is the base rate, any other the upgrade
  int optionIndex(String code) => options.indexWhere((o) => o.code == code);

  /// When the hold was made
  DateTime get reservationTime => createdAt;

  /// Calculate duration if session is active or completed
  Duration? get duration {
    if (startedAt == null) return null;
    final end = endTime ?? DateTime.now();
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
    return Stay(
      id: json['id'] as int,
      placeId: json['placeId'] as int,
      placeKind: PlaceKind.fromValue(json['placeKind'] as int?),
      placeName: LocalizedText.parse(json['placeName'] ?? 'Place ${json['placeId']}'),
      options: _parseOptions(json['tariff']),
      receiptNumber: (json['receiptNumber'] as num?)?.toInt(),
      paidAt: json['paidAt'] != null ? DateTime.parse(json['paidAt'] as String) : null,
      paidWith: json['paidWith'] as String?,
      ticketId: (json['ticketId'] as num?)?.toInt(),
      createdAt: DateTime.parse(json['createdAt'] as String),
      startedAt: json['startedAt'] != null ? DateTime.parse(json['startedAt'] as String) : null,
      endTime: json['endedAt'] != null ? DateTime.parse(json['endedAt'] as String) : null,
      totalCost: (json['totalCost'] as num?)?.toDouble(),
      status: StayStatus.fromValue(json['status'] as int),
      notes: json['notes'] as String?,
      currentOptionCode: json['currentOptionCode'] as String?,
      currentOptionName:
          json['currentOptionName'] != null ? LocalizedText.parse(json['currentOptionName']) : null,
      startOnConfirm: json['startOnConfirm'] as bool? ?? false,
      requestedOptionCode: json['requestedOptionCode'] as String?,
      requestedOptionName:
          json['requestedOptionName'] != null ? LocalizedText.parse(json['requestedOptionName']) : null,
      customerId: json['customerId'] as String?,
      members: (json['members'] as List<dynamic>?)
              ?.map((e) => StayMember.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      segments: (json['segments'] as List<dynamic>?)
              ?.map((e) => StaySegment.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}

/// The stay on a place, as the scan shows it before joining
class StayPreview {
  final int sessionId;
  final int placeId;
  final LocalizedText placeName;
  final StayStatus status;
  final DateTime startTime;
  final int memberCount;

  StayPreview({
    required this.sessionId,
    required this.placeId,
    required this.placeName,
    required this.status,
    required this.startTime,
    required this.memberCount,
  });

  factory StayPreview.fromJson(Map<String, dynamic> json) {
    return StayPreview(
      sessionId: json['stayId'] as int,
      placeId: json['placeId'] as int,
      placeName: LocalizedText.parse(json['placeName']),
      status: StayStatus.fromValue(json['status'] as int? ?? 2),
      startTime: DateTime.parse(json['startTime'] as String),
      memberCount: json['memberCount'] as int? ?? 0,
    );
  }
}

/// What a scanned place QR resolves to for this customer
class PlaceScanResult {
  final int branchId;
  final int placeId;
  final PlaceKind kind;
  final LocalizedText placeName;
  final List<RateOption> options;
  final PlaceStatus displayStatus;
  final bool isActive;
  final bool isTimed;
  final bool canReserve;
  final bool takesControllerRequests;
  final bool hasActiveSession;
  final StayPreview? sessionPreview;
  final bool isAlreadyMember;

  PlaceScanResult({
    required this.branchId,
    required this.placeId,
    required this.kind,
    required this.placeName,
    required this.options,
    required this.displayStatus,
    required this.isActive,
    required this.isTimed,
    required this.canReserve,
    required this.takesControllerRequests,
    required this.hasActiveSession,
    this.sessionPreview,
    required this.isAlreadyMember,
  });

  bool get hasOptions => options.length > 1;

  /// The place as the hold sheet takes it
  Place toPlace() => Place(
        id: placeId,
        kind: kind,
        name: placeName,
        displayStatus: displayStatus,
        isActive: isActive,
        options: options,
        canReserve: canReserve,
        takesControllerRequests: takesControllerRequests,
      );

  factory PlaceScanResult.fromJson(Map<String, dynamic> json) {
    return PlaceScanResult(
      branchId: json['branchId'] as int,
      placeId: json['placeId'] as int,
      kind: PlaceKind.fromValue(json['kind'] as int?),
      placeName: LocalizedText.parse(json['placeName']),
      options: _parseOptions(json['tariff']),
      displayStatus: PlaceStatus.fromValue(json['status'] as int? ?? 1),
      isActive: json['isActive'] as bool? ?? true,
      isTimed: json['isTimed'] as bool? ?? false,
      canReserve: json['canReserve'] as bool? ?? false,
      takesControllerRequests: json['takesControllerRequests'] as bool? ?? false,
      hasActiveSession: json['hasRunningStay'] as bool? ?? false,
      sessionPreview:
          json['stay'] != null ? StayPreview.fromJson(json['stay'] as Map<String, dynamic>) : null,
      isAlreadyMember: json['isAlreadyMember'] as bool? ?? false,
    );
  }
}

/// Result of joining a stay
class JoinStayResult {
  final int reservationId;
  final int placeId;
  final LocalizedText placeName;
  final bool isOwner;
  final DateTime startTime;

  JoinStayResult({
    required this.reservationId,
    required this.placeId,
    required this.placeName,
    required this.isOwner,
    required this.startTime,
  });

  factory JoinStayResult.fromJson(Map<String, dynamic> json) {
    return JoinStayResult(
      reservationId: json['stayId'] as int,
      placeId: json['placeId'] as int,
      placeName: LocalizedText.parse(json['placeName']),
      isOwner: json['isOwner'] as bool,
      startTime: DateTime.parse(json['startTime'] as String),
    );
  }
}

/// What the places tab is called right now: "Book" until a clock runs for
/// the customer, then the place they are at — their room, their table.
String placesTabLabel(AppLocalizations l10n, List<Stay> stays) {
  final running = stays.where((s) => s.status == StayStatus.active).firstOrNull;
  if (running == null) return l10n.rooms;
  return switch (running.placeKind) {
    PlaceKind.table => l10n.yourTable,
    PlaceKind.station => l10n.yourStation,
    PlaceKind.room => l10n.yourRoom,
  };
}
