import 'package:flutter/widgets.dart';
import 'package:forui/forui.dart';

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
enum RoomDisplayStatus {
  available(1, 'Available'),
  occupied(2, 'Occupied'),
  reserved(3, 'Reserved'), // Held: the customer has 10 min to arrive
  maintenance(4, 'Maintenance');

  final int value;
  final String label;

  const RoomDisplayStatus(this.value, this.label);

  static RoomDisplayStatus fromValue(int value) {
    return RoomDisplayStatus.values.firstWhere(
      (e) => e.value == value,
      orElse: () => RoomDisplayStatus.available,
    );
  }
}

/// Stay status
enum SessionStatus {
  reserved(1, 'Held'),
  active(2, 'Running'),
  completed(3, 'Ended'),
  cancelled(4, 'Cancelled');

  final int value;
  final String label;

  const SessionStatus(this.value, this.label);

  static SessionStatus fromValue(int value) {
    return SessionStatus.values.firstWhere(
      (e) => e.value == value,
      orElse: () => SessionStatus.reserved,
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
class Room {
  final int id;
  final PlaceKind kind;
  final LocalizedText name;
  final LocalizedText? description;
  final RoomDisplayStatus displayStatus;
  final bool isActive;
  final List<RateOption> options;
  final bool canReserve;
  final bool takesControllerRequests;

  Room({
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
  bool get canBookNow => canReserve && displayStatus == RoomDisplayStatus.available;

  factory Room.fromJson(Map<String, dynamic> json) {
    return Room(
      id: json['id'] as int,
      kind: PlaceKind.fromValue(json['kind'] as int?),
      name: LocalizedText.parse(json['name']),
      description: json['description'] != null ? LocalizedText.parse(json['description']) : null,
      displayStatus: RoomDisplayStatus.fromValue(json['status'] as int? ?? 1),
      isActive: json['isActive'] as bool? ?? true,
      options: _parseOptions(json['tariff']),
      canReserve: json['canReserve'] as bool? ?? true,
      takesControllerRequests: json['takesControllerRequests'] as bool? ?? true,
    );
  }
}

/// Session member model
class SessionMember {
  final String customerId;
  final String? customerName;
  final DateTime joinedAt;
  final String role;

  SessionMember({
    required this.customerId,
    this.customerName,
    required this.joinedAt,
    required this.role,
  });

  bool get isOwner => role == 'Owner';

  factory SessionMember.fromJson(Map<String, dynamic> json) {
    return SessionMember(
      customerId: json['customerId'] as String,
      customerName: json['customerName'] as String?,
      joinedAt: DateTime.parse(json['joinedAt'] as String),
      role: json['role'] as String? ?? 'Member',
    );
  }
}

/// A stretch of the stay charged at one rate option
class SessionSegment {
  final String optionCode;
  final LocalizedText optionName;
  final double hourlyRate;
  final DateTime startTime;
  final DateTime? endTime;

  SessionSegment({
    required this.optionCode,
    required this.optionName,
    required this.hourlyRate,
    required this.startTime,
    this.endTime,
  });

  factory SessionSegment.fromJson(Map<String, dynamic> json) {
    return SessionSegment(
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
class RoomSession {
  final int id;
  final int roomId;
  final PlaceKind placeKind;
  final LocalizedText roomName;
  final List<RateOption> options;
  final DateTime createdAt;
  final DateTime? actualStartTime;
  final DateTime? endTime;
  final double? totalCost;
  final SessionStatus status;
  final String? notes;
  final String? currentOptionCode;
  final LocalizedText? currentOptionName;

  /// The customer asked that the till's Confirm also start the clock
  final bool startOnConfirm;
  final String? customerId;
  final List<SessionMember> members;
  final List<SessionSegment> segments;

  /// The till's receipt, projected by Spaces: null while the bill is open
  final int? receiptNumber;
  final DateTime? paidAt;

  /// "Cash", "Card", "InstaPay", "Account" (the customer's tab) or "Mixed"
  final String? paidWith;

  /// The Sales ticket the time was billed on — what the receipt opens
  final int? ticketId;

  RoomSession({
    required this.id,
    required this.roomId,
    this.placeKind = PlaceKind.room,
    required this.roomName,
    this.options = const [],
    required this.createdAt,
    this.actualStartTime,
    this.endTime,
    this.totalCost,
    required this.status,
    this.notes,
    this.currentOptionCode,
    this.currentOptionName,
    this.startOnConfirm = false,
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
    if (actualStartTime == null) return null;
    final end = endTime ?? DateTime.now();
    return end.difference(actualStartTime!);
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

  factory RoomSession.fromJson(Map<String, dynamic> json) {
    return RoomSession(
      id: json['id'] as int,
      roomId: json['placeId'] as int,
      placeKind: PlaceKind.fromValue(json['placeKind'] as int?),
      roomName: LocalizedText.parse(json['placeName'] ?? 'Place ${json['placeId']}'),
      options: _parseOptions(json['tariff']),
      receiptNumber: (json['receiptNumber'] as num?)?.toInt(),
      paidAt: json['paidAt'] != null ? DateTime.parse(json['paidAt'] as String) : null,
      paidWith: json['paidWith'] as String?,
      ticketId: (json['ticketId'] as num?)?.toInt(),
      createdAt: DateTime.parse(json['createdAt'] as String),
      actualStartTime: json['startedAt'] != null ? DateTime.parse(json['startedAt'] as String) : null,
      endTime: json['endedAt'] != null ? DateTime.parse(json['endedAt'] as String) : null,
      totalCost: (json['totalCost'] as num?)?.toDouble(),
      status: SessionStatus.fromValue(json['status'] as int),
      notes: json['notes'] as String?,
      currentOptionCode: json['currentOptionCode'] as String?,
      currentOptionName:
          json['currentOptionName'] != null ? LocalizedText.parse(json['currentOptionName']) : null,
      startOnConfirm: json['startOnConfirm'] as bool? ?? false,
      customerId: json['customerId'] as String?,
      members: (json['members'] as List<dynamic>?)
              ?.map((e) => SessionMember.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      segments: (json['segments'] as List<dynamic>?)
              ?.map((e) => SessionSegment.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}

/// The stay on a place, as the scan shows it before joining
class SessionPreview {
  final int sessionId;
  final int roomId;
  final LocalizedText roomName;
  final SessionStatus status;
  final DateTime startTime;
  final int memberCount;

  SessionPreview({
    required this.sessionId,
    required this.roomId,
    required this.roomName,
    required this.status,
    required this.startTime,
    required this.memberCount,
  });

  factory SessionPreview.fromJson(Map<String, dynamic> json) {
    return SessionPreview(
      sessionId: json['stayId'] as int,
      roomId: json['placeId'] as int,
      roomName: LocalizedText.parse(json['placeName']),
      status: SessionStatus.fromValue(json['status'] as int? ?? 2),
      startTime: DateTime.parse(json['startTime'] as String),
      memberCount: json['memberCount'] as int? ?? 0,
    );
  }
}

/// What a scanned place QR resolves to for this customer
class RoomScanResult {
  final int branchId;
  final int roomId;
  final PlaceKind kind;
  final LocalizedText roomName;
  final List<RateOption> options;
  final RoomDisplayStatus displayStatus;
  final bool isActive;
  final bool isTimed;
  final bool canReserve;
  final bool takesControllerRequests;
  final bool hasActiveSession;
  final SessionPreview? sessionPreview;
  final bool isAlreadyMember;

  RoomScanResult({
    required this.branchId,
    required this.roomId,
    required this.kind,
    required this.roomName,
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
  Room toRoom() => Room(
        id: roomId,
        kind: kind,
        name: roomName,
        displayStatus: displayStatus,
        isActive: isActive,
        options: options,
        canReserve: canReserve,
        takesControllerRequests: takesControllerRequests,
      );

  factory RoomScanResult.fromJson(Map<String, dynamic> json) {
    return RoomScanResult(
      branchId: json['branchId'] as int,
      roomId: json['placeId'] as int,
      kind: PlaceKind.fromValue(json['kind'] as int?),
      roomName: LocalizedText.parse(json['placeName']),
      options: _parseOptions(json['tariff']),
      displayStatus: RoomDisplayStatus.fromValue(json['status'] as int? ?? 1),
      isActive: json['isActive'] as bool? ?? true,
      isTimed: json['isTimed'] as bool? ?? false,
      canReserve: json['canReserve'] as bool? ?? false,
      takesControllerRequests: json['takesControllerRequests'] as bool? ?? false,
      hasActiveSession: json['hasRunningStay'] as bool? ?? false,
      sessionPreview:
          json['stay'] != null ? SessionPreview.fromJson(json['stay'] as Map<String, dynamic>) : null,
      isAlreadyMember: json['isAlreadyMember'] as bool? ?? false,
    );
  }
}

/// Result of joining a stay
class JoinSessionResult {
  final int reservationId;
  final int roomId;
  final LocalizedText roomName;
  final bool isOwner;
  final DateTime startTime;

  JoinSessionResult({
    required this.reservationId,
    required this.roomId,
    required this.roomName,
    required this.isOwner,
    required this.startTime,
  });

  factory JoinSessionResult.fromJson(Map<String, dynamic> json) {
    return JoinSessionResult(
      reservationId: json['stayId'] as int,
      roomId: json['placeId'] as int,
      roomName: LocalizedText.parse(json['placeName']),
      isOwner: json['isOwner'] as bool,
      startTime: DateTime.parse(json['startTime'] as String),
    );
  }
}
