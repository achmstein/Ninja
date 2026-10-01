import 'package:flutter/material.dart';
import '../../../core/ui/ui.dart';

import '../../../core/models/localized_text.dart';
import '../../places/models/place.dart';

/// Types of service requests users can make
enum ServiceRequestType {
  callWaiter(1, 'Call Waiter', LucideIcons.user),
  controllerChange(2, 'Controller', LucideIcons.gamepad2),
  receiptToPay(3, 'Pay Bill', LucideIcons.receipt),
  switchToMulti(4, 'Switch to Multi', LucideIcons.users),
  switchToSingle(5, 'Switch to Single', LucideIcons.user),

  /// Switch the stay to another rate option; the option travels in optionCode
  changeOption(6, 'Change rate', LucideIcons.refreshCw);

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
  completed(3),
  cancelled(4);

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

  /// The place the request came from, as the server resolved it
  final int? placeId;
  final PlaceKind? placeKind;
  final LocalizedText? placeName;
  final ServiceRequestType requestType;
  final ServiceRequestStatus status;
  final DateTime createdAt;

  /// Who picked it up, once someone has
  final String? acknowledgedBy;

  /// Still with the staff: sent, or picked up and on the way
  bool get isOpen => status == ServiceRequestStatus.pending || status == ServiceRequestStatus.acknowledged;

  ServiceRequestResponse({
    required this.id,
    required this.userName,
    this.placeId,
    this.placeKind,
    this.placeName,
    required this.requestType,
    required this.status,
    required this.createdAt,
    this.acknowledgedBy,
  });

  factory ServiceRequestResponse.fromJson(Map<String, dynamic> json) {
    return ServiceRequestResponse(
      id: json['id'] as int,
      userName: json['userName'] as String,
      placeId: json['placeId'] as int?,
      placeKind: PlaceKind.fromWireName(json['placeKind'] as String?),
      placeName: LocalizedText.parseNullable(json['placeName']),
      requestType: ServiceRequestType.fromValue(json['requestType'] as int)!,
      status: ServiceRequestStatus.values.firstWhere(
        (e) => e.value == json['status'],
        orElse: () => ServiceRequestStatus.pending,
      ),
      createdAt: DateTime.parse(json['createdAt'] as String),
      acknowledgedBy: json['acknowledgedBy'] as String?,
    );
  }
}
