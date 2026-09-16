import '../../../core/models/localized_text.dart';

/// Room display status from API
enum RoomStatus {
  available(1, 'Available'),
  occupied(2, 'Occupied'),
  reserved(3, 'Reserved'),  // Customer has 15 min to arrive
  maintenance(4, 'Maintenance');

  final int value;
  final String label;

  const RoomStatus(this.value, this.label);

  static RoomStatus fromValue(int value) {
    return RoomStatus.values.firstWhere(
      (e) => e.value == value,
      orElse: () => RoomStatus.available,
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
  final RoomStatus status;
  final double singleRate;
  final double multiRate;
  final String? pictureUri;

  Room({
    required this.id,
    required this.name,
    this.description,
    required this.status,
    required this.singleRate,
    required this.multiRate,
    this.pictureUri,
  });

  Room copyWith({
    int? id,
    LocalizedText? name,
    LocalizedText? description,
    RoomStatus? status,
    double? singleRate,
    double? multiRate,
    String? pictureUri,
  }) {
    return Room(
      id: id ?? this.id,
      name: name ?? this.name,
      description: description ?? this.description,
      status: status ?? this.status,
      singleRate: singleRate ?? this.singleRate,
      multiRate: multiRate ?? this.multiRate,
      pictureUri: pictureUri ?? this.pictureUri,
    );
  }

  factory Room.fromJson(Map<String, dynamic> json) {
    // API returns 'displayStatus', fallback to 'status' for backwards compatibility
    final statusValue = json['displayStatus'] ?? json['status'];
    return Room(
      id: json['id'] as int,
      name: LocalizedText.parse(json['name']),
      description: LocalizedText.parseNullable(json['description']),
      status: statusValue != null
          ? RoomStatus.fromValue(statusValue as int)
          : RoomStatus.available,
      singleRate: (json['singleRate'] as num?)?.toDouble() ?? 0.0,
      multiRate: (json['multiRate'] as num?)?.toDouble() ?? 0.0,
      pictureUri: json['pictureUri'] as String?,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'name': name.toJson(),
      'description': description?.toJson(),
      'singleRate': singleRate,
      'multiRate': multiRate,
      'pictureFileName': pictureUri,
    };
  }
}

/// Session member model
class SessionMember {
  final String customerId;
  final String? customerName;
  final DateTime joinedAt;
  final String role; // "Owner" or "Member"

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

/// Player mode for dual pricing
enum PlayerMode {
  single,
  multi;

  static PlayerMode? fromString(String? value) {
    if (value == null) return null;
    switch (value.toLowerCase()) {
      case 'single':
        return PlayerMode.single;
      case 'multi':
        return PlayerMode.multi;
      default:
        return null;
    }
  }
}

/// Session segment tracking time in each player mode
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
      playerMode: json['playerMode'] as String,
      hourlyRate: (json['hourlyRate'] as num?)?.toDouble() ?? 0,
      startTime: DateTime.parse(json['startTime'] as String),
      endTime: json['endTime'] != null
          ? DateTime.parse(json['endTime'] as String)
          : null,
    );
  }
}

/// Room session model
class RoomSession {
  final int id;
  final int roomId;
  final LocalizedText roomName;
  final String? customerId;
  final String? userName;
  final DateTime reservationTime;
  final DateTime? startTime;
  final DateTime? endTime;
  final double? totalCost;
  final SessionStatus status;
  final double singleRate;
  final double multiRate;
  final String? currentPlayerMode;
  final double? singleRoundedHours;
  final double? multiRoundedHours;
  final double? singleCost;
  final double? multiCost;
  final DateTime? expiresAt;
  final List<SessionMember> members;
  final List<SessionSegment> segments;

  RoomSession({
    required this.id,
    required this.roomId,
    required this.roomName,
    this.customerId,
    this.userName,
    required this.reservationTime,
    this.startTime,
    this.endTime,
    this.totalCost,
    required this.status,
    this.singleRate = 0,
    this.multiRate = 0,
    this.currentPlayerMode,
    this.singleRoundedHours,
    this.multiRoundedHours,
    this.singleCost,
    this.multiCost,
    this.expiresAt,
    this.members = const [],
    this.segments = const [],
  });

  /// The active hourly rate based on current player mode
  double get activeRate {
    if (currentPlayerMode == 'Multi') return multiRate;
    return singleRate;
  }

  /// Calculate duration if session has started
  Duration? get duration {
    if (startTime == null) return null;
    final end = endTime ?? DateTime.now();
    return end.difference(startTime!);
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

  /// Calculate live cost based on duration and current mode rate
  double get liveCost {
    final d = duration;
    if (d == null || activeRate == 0) return totalCost ?? 0;
    return (d.inSeconds / 3600) * activeRate;
  }

  /// Check if this reservation is about to expire
  bool get isExpiring {
    if (status != SessionStatus.reserved || expiresAt == null) return false;
    return DateTime.now().isAfter(expiresAt!);
  }

  /// Get remaining time until expiration
  Duration? get timeUntilExpiration {
    if (status != SessionStatus.reserved || expiresAt == null) return null;
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

  factory RoomSession.fromJson(Map<String, dynamic> json) {
    // Handle status - API may return 'status' as int or enum value
    final statusValue = json['status'];
    SessionStatus status;
    if (statusValue is int) {
      status = SessionStatus.fromValue(statusValue);
    } else if (statusValue is String) {
      // Handle string enum names
      status = SessionStatus.values.firstWhere(
        (e) => e.name.toLowerCase() == statusValue.toLowerCase(),
        orElse: () => SessionStatus.reserved,
      );
    } else {
      status = SessionStatus.reserved;
    }

    // Handle date fields - API uses different field names
    final createdAt = json['createdAt'];
    final startTime = json['startTime'] ?? json['actualStartTime'];

    final membersJson = json['members'] as List<dynamic>?;
    final members = membersJson
        ?.map((e) => SessionMember.fromJson(e as Map<String, dynamic>))
        .toList() ?? [];

    final segmentsJson = json['segments'] as List<dynamic>?;
    final segments = segmentsJson
        ?.map((e) => SessionSegment.fromJson(e as Map<String, dynamic>))
        .toList() ?? [];

    return RoomSession(
      id: json['id'] as int,
      roomId: json['roomId'] as int,
      roomName: LocalizedText.parse(json['roomName'] ?? 'Room ${json['roomId']}'),
      customerId: json['customerId'] as String?,
      userName: json['customerName'] as String?,
      reservationTime: DateTime.parse(createdAt as String),
      startTime: startTime != null
          ? DateTime.parse(startTime as String)
          : null,
      endTime: json['endTime'] != null
          ? DateTime.parse(json['endTime'] as String)
          : null,
      totalCost: (json['totalCost'] as num?)?.toDouble(),
      status: status,
      singleRate: (json['singleRate'] as num?)?.toDouble() ?? 0,
      multiRate: (json['multiRate'] as num?)?.toDouble() ?? 0,
      currentPlayerMode: json['currentPlayerMode'] as String?,
      singleRoundedHours: (json['singleRoundedHours'] as num?)?.toDouble(),
      multiRoundedHours: (json['multiRoundedHours'] as num?)?.toDouble(),
      singleCost: (json['singleCost'] as num?)?.toDouble(),
      multiCost: (json['multiCost'] as num?)?.toDouble(),
      expiresAt: json['expiresAt'] != null
          ? DateTime.parse(json['expiresAt'] as String)
          : null,
      members: members,
      segments: segments,
    );
  }
}
