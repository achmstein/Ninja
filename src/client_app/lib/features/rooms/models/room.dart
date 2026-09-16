import '../../../core/models/localized_text.dart';

/// Room display status (computed at query time)
enum RoomDisplayStatus {
  available(1, 'Available'),
  occupied(2, 'Occupied'),
  reserved(3, 'Reserved'),  // Customer has 15 min to arrive
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

/// Session status
enum SessionStatus {
  reserved(1, 'Reserved'),
  active(2, 'Active'),
  completed(3, 'Completed'),
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

/// Room model
class Room {
  final int id;
  final LocalizedText name;
  final LocalizedText? description;
  final RoomDisplayStatus displayStatus;
  final double singleRate;
  final double multiRate;

  Room({
    required this.id,
    required this.name,
    this.description,
    required this.displayStatus,
    required this.singleRate,
    required this.multiRate,
  });

  /// Can the user book this room now?
  bool get canBookNow => displayStatus == RoomDisplayStatus.available;

  factory Room.fromJson(Map<String, dynamic> json) {
    return Room(
      id: json['id'] as int,
      name: _parseLocalizedText(json['name']),
      description: json['description'] != null ? _parseLocalizedText(json['description']) : null,
      displayStatus: RoomDisplayStatus.fromValue(json['displayStatus'] as int),
      singleRate: (json['singleRate'] as num?)?.toDouble() ?? 0.0,
      multiRate: (json['multiRate'] as num?)?.toDouble() ?? 0.0,
    );
  }

  /// Parse LocalizedText from JSON - handles both object and string formats
  static LocalizedText _parseLocalizedText(dynamic value) {
    if (value is String) {
      return LocalizedText.fromString(value);
    } else if (value is Map<String, dynamic>) {
      return LocalizedText.fromJson(value);
    }
    return LocalizedText(en: value?.toString() ?? '');
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

/// Session segment model (single/multi billing periods)
class SessionSegment {
  final String playerMode;
  final double hourlyRate;
  final DateTime startTime;
  final DateTime? endTime;

  SessionSegment({
    required this.playerMode,
    required this.hourlyRate,
    required this.startTime,
    this.endTime,
  });

  factory SessionSegment.fromJson(Map<String, dynamic> json) {
    return SessionSegment(
      playerMode: json['playerMode'] as String? ?? 'Single',
      hourlyRate: (json['hourlyRate'] as num?)?.toDouble() ?? 0,
      startTime: DateTime.parse(json['startTime'] as String),
      endTime: json['endTime'] != null
          ? DateTime.parse(json['endTime'] as String)
          : null,
    );
  }
}

/// Room session/reservation model
class RoomSession {
  final int id;
  final int roomId;
  final LocalizedText roomName;
  final double singleRate;
  final double multiRate;
  final DateTime createdAt;
  final DateTime? actualStartTime;
  final DateTime? endTime;
  final double? totalCost;
  final SessionStatus status;
  final String? notes;
  final String? currentPlayerMode;
  final String? customerId;
  final List<SessionMember> members;
  final List<SessionSegment> segments;

  /// The till's receipt, projected by Spaces: null while the bill is open
  final int? receiptNumber;
  final DateTime? paidAt;

  /// "Cash", "Card", "InstaPay", "Account" (the customer's tab) or "Mixed"
  final String? paidWith;

  RoomSession({
    required this.id,
    required this.roomId,
    required this.roomName,
    required this.singleRate,
    this.multiRate = 0,
    required this.createdAt,
    this.actualStartTime,
    this.endTime,
    this.totalCost,
    required this.status,
    this.notes,
    this.currentPlayerMode,
    this.customerId,
    this.members = const [],
    this.segments = const [],
    this.receiptNumber,
    this.paidAt,
    this.paidWith,
  });

  /// When the reservation was created
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
      roomId: json['roomId'] as int,
      roomName: Room._parseLocalizedText(json['roomName'] ?? 'Room ${json['roomId']}'),
      receiptNumber: (json['receiptNumber'] as num?)?.toInt(),
      paidAt: json['paidAt'] != null ? DateTime.parse(json['paidAt'] as String) : null,
      paidWith: json['paidWith'] as String?,
      singleRate: (json['singleRate'] as num?)?.toDouble() ?? 0,
      multiRate: (json['multiRate'] as num?)?.toDouble() ?? 0,
      createdAt: DateTime.parse(json['createdAt'] as String),
      actualStartTime: json['actualStartTime'] != null
          ? DateTime.parse(json['actualStartTime'] as String)
          : null,
      endTime: json['endTime'] != null
          ? DateTime.parse(json['endTime'] as String)
          : null,
      totalCost: (json['totalCost'] as num?)?.toDouble(),
      status: SessionStatus.fromValue(json['status'] as int),
      notes: json['notes'] as String?,
      currentPlayerMode: json['currentPlayerMode'] as String?,
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

/// Session preview (before joining)
class SessionPreview {
  final int sessionId;
  final int roomId;
  final LocalizedText roomName;
  final DateTime startTime;
  final int memberCount;

  SessionPreview({
    required this.sessionId,
    required this.roomId,
    required this.roomName,
    required this.startTime,
    required this.memberCount,
  });

  factory SessionPreview.fromJson(Map<String, dynamic> json) {
    return SessionPreview(
      sessionId: json['sessionId'] as int,
      roomId: json['roomId'] as int,
      roomName: Room._parseLocalizedText(json['roomName']),
      startTime: DateTime.parse(json['startTime'] as String),
      memberCount: json['memberCount'] as int,
    );
  }
}

/// Room scan result (from QR code scan)
class RoomScanResult {
  final int branchId;
  final int roomId;
  final LocalizedText roomName;
  final double singleRate;
  final double multiRate;
  final RoomDisplayStatus displayStatus;
  final bool hasActiveSession;
  final SessionPreview? sessionPreview;
  final bool isAlreadyMember;

  RoomScanResult({
    required this.branchId,
    required this.roomId,
    required this.roomName,
    required this.singleRate,
    required this.multiRate,
    required this.displayStatus,
    required this.hasActiveSession,
    this.sessionPreview,
    required this.isAlreadyMember,
  });

  factory RoomScanResult.fromJson(Map<String, dynamic> json) {
    return RoomScanResult(
      branchId: json['branchId'] as int,
      roomId: json['roomId'] as int,
      roomName: Room._parseLocalizedText(json['roomName']),
      singleRate: (json['singleRate'] as num?)?.toDouble() ?? 0.0,
      multiRate: (json['multiRate'] as num?)?.toDouble() ?? 0.0,
      displayStatus: RoomDisplayStatus.fromValue(json['displayStatus'] as int),
      hasActiveSession: json['hasActiveSession'] as bool,
      sessionPreview: json['sessionPreview'] != null
          ? SessionPreview.fromJson(json['sessionPreview'] as Map<String, dynamic>)
          : null,
      isAlreadyMember: json['isAlreadyMember'] as bool,
    );
  }
}

/// Result of joining a session
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
      reservationId: json['reservationId'] as int,
      roomId: json['roomId'] as int,
      roomName: Room._parseLocalizedText(json['roomName']),
      isOwner: json['isOwner'] as bool,
      startTime: DateTime.parse(json['startTime'] as String),
    );
  }
}
