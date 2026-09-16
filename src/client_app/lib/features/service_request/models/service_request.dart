import 'package:flutter/material.dart';
import 'package:forui/forui.dart';

import '../../../core/models/localized_text.dart';

/// Types of service requests users can make
enum ServiceRequestType {
  callWaiter(1, 'Call Waiter', FIcons.user),
  controllerChange(2, 'Controller', FIcons.gamepad2),
  receiptToPay(3, 'Pay Bill', FIcons.receipt),
  switchToMulti(4, 'Switch to Multi', FIcons.users),
  switchToSingle(5, 'Switch to Single', FIcons.user);

  final int value;
  final String label;
  final IconData icon;

  const ServiceRequestType(this.value, this.label, this.icon);

  static ServiceRequestType? fromValue(int value) {
    return ServiceRequestType.values.firstWhere(
      (e) => e.value == value,
      orElse: () => ServiceRequestType.callWaiter,
    );
  }
}

/// Status of a service request
enum ServiceRequestStatus {
  pending(1),
  acknowledged(2),
  completed(3);

  final int value;

  const ServiceRequestStatus(this.value);
}

/// Request payload for creating a service request
/// From a room session, or from a table (waiter or bill only)
class CreateServiceRequest {
  final int? sessionId;
  final int? roomId;
  final LocalizedText? roomName;
  final int? tableId;
  final LocalizedText? tableName;
  final ServiceRequestType requestType;

  CreateServiceRequest({
    this.sessionId,
    this.roomId,
    this.roomName,
    this.tableId,
    this.tableName,
    required this.requestType,
  });

  CreateServiceRequest.forTable({required int this.tableId, required LocalizedText this.tableName, required this.requestType})
      : sessionId = null,
        roomId = null,
        roomName = null;

  Map<String, dynamic> toJson() {
    return {
      'requestType': requestType.value,
      if (sessionId != null) 'sessionId': sessionId,
      if (roomId != null) 'roomId': roomId,
      if (roomName != null) 'roomName': roomName!.toJson(),
      if (tableId != null) 'tableId': tableId,
      if (tableName != null) 'tableName': tableName!.toJson(),
    };
  }
}

/// Service request response from API
class ServiceRequestResponse {
  final int id;
  final String userName;
  final int roomId;
  final LocalizedText roomName;
  final ServiceRequestType requestType;
  final ServiceRequestStatus status;
  final DateTime createdAt;

  ServiceRequestResponse({
    required this.id,
    required this.userName,
    required this.roomId,
    required this.roomName,
    required this.requestType,
    required this.status,
    required this.createdAt,
  });

  factory ServiceRequestResponse.fromJson(Map<String, dynamic> json) {
    return ServiceRequestResponse(
      id: json['id'] as int,
      userName: json['userName'] as String,
      roomId: json['roomId'] as int,
      roomName: LocalizedText.fromJson(json['roomName'] as Map<String, dynamic>),
      requestType: ServiceRequestType.fromValue(json['requestType'] as int)!,
      status: ServiceRequestStatus.values.firstWhere(
        (e) => e.value == json['status'],
        orElse: () => ServiceRequestStatus.pending,
      ),
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}
