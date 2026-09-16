import '../../../core/models/localized_text.dart';

/// Types of service requests
enum ServiceRequestType {
  callWaiter(1, 'Call Waiter'),
  controllerChange(2, 'Controller Change'),
  receiptToPay(3, 'Receipt to Pay'),
  switchToMulti(4, 'Switch to Multi'),
  switchToSingle(5, 'Switch to Single'),

  /// Switch the stay to another rate option; the option's code travels in optionCode
  changeOption(6, 'Change rate');

  final int value;
  final String label;

  const ServiceRequestType(this.value, this.label);

  static ServiceRequestType fromValue(int value) {
    return ServiceRequestType.values.firstWhere(
      (e) => e.value == value,
      orElse: () => ServiceRequestType.callWaiter,
    );
  }
}

/// Status of a service request
enum ServiceRequestStatus {
  pending(1, 'Pending'),
  acknowledged(2, 'Acknowledged'),
  completed(3, 'Completed');

  final int value;
  final String label;

  const ServiceRequestStatus(this.value, this.label);

  static ServiceRequestStatus fromValue(int value) {
    return ServiceRequestStatus.values.firstWhere(
      (e) => e.value == value,
      orElse: () => ServiceRequestStatus.pending,
    );
  }
}

/// Service request model
class ServiceRequest {
  final int id;
  final String userName;
  final int? roomId;

  /// The place: the room, or the table's name for a table request
  final LocalizedText roomName;
  final int? tableId;
  final LocalizedText? tableName;

  /// The Spaces place; 'Room', 'Table' or 'Station'
  final int? placeId;
  final String? placeKind;

  /// The rate option a changeOption request asks for
  final String? optionCode;
  final ServiceRequestType requestType;
  final ServiceRequestStatus status;
  final DateTime createdAt;

  ServiceRequest({
    required this.id,
    required this.userName,
    this.roomId,
    required this.roomName,
    this.tableId,
    this.tableName,
    this.placeId,
    this.placeKind,
    this.optionCode,
    required this.requestType,
    required this.status,
    required this.createdAt,
  });

  factory ServiceRequest.fromJson(Map<String, dynamic> json) {
    return ServiceRequest(
      id: json['id'] as int,
      userName: json['userName'] as String,
      roomId: json['roomId'] as int?,
      roomName: LocalizedText.parse(json['roomName']),
      tableId: json['tableId'] as int?,
      tableName: json['tableName'] != null ? LocalizedText.fromJson(json['tableName'] as Map<String, dynamic>) : null,
      placeId: json['placeId'] as int?,
      placeKind: json['placeKind'] as String?,
      optionCode: json['optionCode'] as String?,
      requestType: ServiceRequestType.fromValue(json['requestType'] as int),
      status: ServiceRequestStatus.fromValue(json['status'] as int),
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}
