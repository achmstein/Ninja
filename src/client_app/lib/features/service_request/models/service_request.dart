import 'package:flutter/material.dart';
import 'package:forui/forui.dart';

import '../../../core/models/localized_text.dart';
import '../../places/models/place.dart';

/// Types of service requests users can make
enum ServiceRequestType {
  callWaiter(1, 'Call Waiter', FIcons.user),
  controllerChange(2, 'Controller', FIcons.gamepad2),
  receiptToPay(3, 'Pay Bill', FIcons.receipt),
  switchToMulti(4, 'Switch to Multi', FIcons.users),
  switchToSingle(5, 'Switch to Single', FIcons.user),

  /// Switch the stay to another rate option; the option travels in optionCode
  changeOption(6, 'Change rate', FIcons.refreshCw);

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

/// Request payload for creating a service request: from the customer's
/// running stay, or from a place they scanned. The server allows the
/// request by what the place can do.
class CreateServiceRequest {
  final int placeId;
  final PlaceKind placeKind;
  final LocalizedText placeName;

  /// The running stay, when the request comes from one
  final int? sessionId;

  /// The rate option wanted, for a changeOption request
  final String? optionCode;
  final ServiceRequestType requestType;

  CreateServiceRequest({
    required this.placeId,
    required this.placeKind,
    required this.placeName,
    this.sessionId,
    this.optionCode,
    required this.requestType,
  });

  Map<String, dynamic> toJson() {
    return {
      'requestType': requestType.value,
      'placeId': placeId,
      'placeKind': placeKind.wireName,
      'placeName': placeName.toJson(),
      if (sessionId != null) 'sessionId': sessionId,
      if (optionCode != null) 'optionCode': optionCode,
    };
  }
}

/// Service request response from API
class ServiceRequestResponse {
  final int id;
  final String userName;
  /// LEGACY(places): reads the older roomId/roomName fields of the response
  /// — remove when Ordering and Notification stop reading the old room/table
  /// fields.
  final int? roomId;
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
      // LEGACY(places): parses the older roomId/roomName fields — remove when Ordering and Notification stop reading the old room/table fields.
      roomId: json['roomId'] as int?,
      roomName: LocalizedText.parse(json['roomName']),
      requestType: ServiceRequestType.fromValue(json['requestType'] as int)!,
      status: ServiceRequestStatus.values.firstWhere(
        (e) => e.value == json['status'],
        orElse: () => ServiceRequestStatus.pending,
      ),
      createdAt: DateTime.parse(json['createdAt'] as String),
    );
  }
}
