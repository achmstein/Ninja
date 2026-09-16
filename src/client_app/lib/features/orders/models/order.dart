import '../../../core/models/localized_text.dart';
import 'rating.dart';

/// Order status - values must match backend OrderStatus enum
/// Note: Backend returns status as string, not int
enum OrderStatus {
  awaitingValidation(1, 'AwaitingValidation'),
  submitted(2, 'Submitted'),
  confirmed(3, 'Confirmed'),
  cancelled(4, 'Cancelled');

  final int value;
  final String label;

  const OrderStatus(this.value, this.label);

  static OrderStatus fromValue(int value) {
    return OrderStatus.values.firstWhere(
      (e) => e.value == value,
      orElse: () => OrderStatus.submitted,
    );
  }

  /// Parse from string (backend returns status as string like "Submitted")
  static OrderStatus fromString(String status) {
    return OrderStatus.values.firstWhere(
      (e) => e.label.toLowerCase() == status.toLowerCase(),
      orElse: () => OrderStatus.submitted,
    );
  }
}

/// Order item
class OrderItem {
  final int? productId;
  final LocalizedText productName;
  final double unitPrice;
  final int units;
  final String? pictureUrl;
  final LocalizedText? customizationsDescription;
  final String? specialInstructions;

  OrderItem({
    this.productId,
    required this.productName,
    required this.unitPrice,
    required this.units,
    this.pictureUrl,
    this.customizationsDescription,
    this.specialInstructions,
  });

  double get totalPrice => unitPrice * units;

  factory OrderItem.fromJson(Map<String, dynamic> json) {
    return OrderItem(
      productId: json['productId'] as int?,
      productName: _parseLocalizedText(json['productName']),
      unitPrice: (json['unitPrice'] as num).toDouble(),
      units: json['units'] as int,
      pictureUrl: json['pictureUrl'] as String?,
      customizationsDescription: json['customizationsDescription'] != null
          ? _parseLocalizedText(json['customizationsDescription'])
          : null,
      specialInstructions: json['specialInstructions'] as String?,
    );
  }

  /// Parse LocalizedText from JSON - handles both object and string
  static LocalizedText _parseLocalizedText(dynamic value) {
    if (value is Map<String, dynamic>) {
      return LocalizedText.fromJson(value);
    } else if (value is String) {
      return LocalizedText(en: value);
    }
    return LocalizedText(en: value?.toString() ?? '');
  }
}

/// Order model
class Order {
  final int id;
  final DateTime date;
  final OrderStatus status;
  final String? description;
  final LocalizedText? roomName;
  final LocalizedText? tableName;
  final String? customerNote;
  final double total;
  final int pointsToRedeem;
  final double loyaltyDiscount;
  final List<OrderItem> items;
  final OrderRating? rating;

  /// The till's receipt, projected by Ordering: null while the bill is open
  final DateTime? paidAt;
  final int? receiptNumber;

  /// "Cash", "Card", "InstaPay", "Account" (the customer's tab) or "Mixed"
  final String? paidWith;
  final double refundedAmount;

  /// The open bill was voided; it will never be paid
  final DateTime? voidedAt;

  /// The Sales ticket the order landed on — what the receipt opens
  final int? ticketId;

  bool get isPaid => paidAt != null;

  Order({
    required this.id,
    required this.date,
    required this.status,
    this.description,
    this.roomName,
    this.tableName,
    this.customerNote,
    required this.total,
    this.pointsToRedeem = 0,
    this.loyaltyDiscount = 0,
    this.items = const [],
    this.rating,
    this.paidAt,
    this.receiptNumber,
    this.paidWith,
    this.refundedAmount = 0,
    this.voidedAt,
    this.ticketId,
  });

  /// Check if order can be rated (must be confirmed and not already rated)
  bool get canBeRated => status == OrderStatus.confirmed && rating == null;

  /// Check if order has a rating
  bool get hasRating => rating != null;

  factory Order.fromJson(Map<String, dynamic> json) {
    // Handle status as either int or string (backend returns string)
    final statusValue = json['status'];
    final status = statusValue is int
        ? OrderStatus.fromValue(statusValue)
        : OrderStatus.fromString(statusValue as String);

    return Order(
      // Backend returns 'orderNumber', fallback to 'orderId' or 'id'
      id: json['orderNumber'] as int? ?? json['orderId'] as int? ?? json['id'] as int,
      date: DateTime.parse(json['date'] as String),
      status: status,
      description: json['description'] as String?,
      roomName: json['roomName'] != null ? OrderItem._parseLocalizedText(json['roomName']) : null,
      tableName: json['tableName'] != null ? OrderItem._parseLocalizedText(json['tableName']) : null,
      customerNote: json['customerNote'] as String?,
      total: (json['total'] as num).toDouble(),
      pointsToRedeem: (json['pointsToRedeem'] ?? 0) as int,
      loyaltyDiscount: ((json['loyaltyDiscount'] ?? 0) as num).toDouble(),
      items: (json['orderItems'] as List<dynamic>?)
              ?.map((e) => OrderItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      rating: json['rating'] != null
          ? OrderRating.fromJson(json['rating'] as Map<String, dynamic>)
          : null,
      paidAt: json['paidAt'] != null ? DateTime.parse(json['paidAt'] as String) : null,
      receiptNumber: (json['receiptNumber'] as num?)?.toInt(),
      paidWith: json['paidWith'] as String?,
      refundedAmount: ((json['refundedAmount'] ?? 0) as num).toDouble(),
      voidedAt: json['voidedAt'] != null ? DateTime.parse(json['voidedAt'] as String) : null,
      ticketId: (json['ticketId'] as num?)?.toInt(),
    );
  }
}

/// Paginated orders response
class PaginatedOrders {
  final List<Order> items;
  final int pageIndex;
  final int pageSize;
  final int totalCount;
  final int totalPages;
  final bool hasNextPage;
  final bool hasPreviousPage;

  PaginatedOrders({
    required this.items,
    required this.pageIndex,
    required this.pageSize,
    required this.totalCount,
    required this.totalPages,
    required this.hasNextPage,
    required this.hasPreviousPage,
  });

  factory PaginatedOrders.fromJson(Map<String, dynamic> json) {
    return PaginatedOrders(
      items: (json['items'] as List<dynamic>)
          .map((e) => Order.fromJson(e as Map<String, dynamic>))
          .toList(),
      pageIndex: json['pageIndex'] as int,
      pageSize: json['pageSize'] as int,
      totalCount: json['totalCount'] as int,
      totalPages: json['totalPages'] as int,
      hasNextPage: json['hasNextPage'] as bool,
      hasPreviousPage: json['hasPreviousPage'] as bool,
    );
  }
}

/// Create order request
class CreateOrderRequest {
  final Map<String, dynamic>? roomName;
  final int? tableId;
  final Map<String, dynamic>? tableName;
  final String? customerNote;

  CreateOrderRequest({
    this.roomName,
    this.tableId,
    this.tableName,
    this.customerNote,
  });

  Map<String, dynamic> toJson() {
    return {
      if (roomName != null) 'roomName': roomName,
      if (tableId != null) 'tableId': tableId,
      if (tableName != null) 'tableName': tableName,
      if (customerNote != null) 'customerNote': customerNote,
    };
  }
}
