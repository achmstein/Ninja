import '../../../core/models/localized_text.dart';

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

/// Order rating from customer
class OrderRating {
  final int ratingValue;
  final String? comment;
  final DateTime createdAt;

  OrderRating({
    required this.ratingValue,
    this.comment,
    required this.createdAt,
  });

  factory OrderRating.fromJson(Map<String, dynamic> json) {
    return OrderRating(
      ratingValue: (json['ratingValue'] ?? json['RatingValue']) as int,
      comment: json['comment'] ?? json['Comment'] as String?,
      createdAt: DateTime.parse((json['createdAt'] ?? json['CreatedAt']) as String),
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
    // Handle both camelCase and PascalCase property names
    // ProductName can be either a string or LocalizedText object
    final productNameValue = json['productName'] ?? json['ProductName'];
    final customizationsValue = json['customizationsDescription'] ?? json['CustomizationsDescription'];

    return OrderItem(
      productId: json['productId'] ?? json['ProductId'] as int?,
      productName: LocalizedText.parse(productNameValue),
      unitPrice: ((json['unitPrice'] ?? json['UnitPrice']) as num).toDouble(),
      units: (json['units'] ?? json['Units']) as int,
      pictureUrl: json['pictureUrl'] ?? json['PictureUrl'] as String?,
      customizationsDescription: LocalizedText.parseNullable(customizationsValue),
      specialInstructions: json['specialInstructions'] ?? json['SpecialInstructions'] as String?,
    );
  }
}

/// Order model
class Order {
  final int id;
  final String? userId;
  final String? userName;
  final DateTime date;
  final OrderStatus status;
  final String? description;
  final String? customerNote;
  final double total;
  final int pointsToRedeem;
  final double loyaltyDiscount;
  final List<OrderItem> items;
  final int? ratingValue;
  final OrderRating? rating;

  /// The stay whose bill the order joins, when a clock is running for the customer
  final int? sessionId;

  /// The Spaces place the order is for (a counter order has none); kind 'Room', 'Table' or 'Station'
  final int? placeId;
  final String? placeKind;
  final LocalizedText? placeName;
  final String? guestName;
  final String? guestPhone;
  final String? source;

  /// On the pending queue, for a guest order: how many of this device's
  /// orders the till has confirmed at this branch before. Zero is a
  /// first-timer; null is an account holder.
  final int? guestOrdersBefore;

  Order({
    required this.id,
    this.userId,
    this.userName,
    required this.date,
    required this.status,
    this.description,
    this.customerNote,
    required this.total,
    this.pointsToRedeem = 0,
    this.loyaltyDiscount = 0,
    this.items = const [],
    this.ratingValue,
    this.rating,
    this.sessionId,
    this.placeId,
    this.placeKind,
    this.placeName,
    this.guestName,
    this.guestPhone,
    this.source,
    this.guestOrdersBefore,
  });

  factory Order.fromJson(Map<String, dynamic> json) {
    // Handle status as either int or string (backend returns string)
    final statusValue = json['status'] ?? json['Status'];
    final status = statusValue is int
        ? OrderStatus.fromValue(statusValue)
        : OrderStatus.fromString(statusValue as String);

    // Handle both camelCase and PascalCase property names
    final orderItems = json['orderItems'] ?? json['OrderItems'];
    final ratingJson = json['rating'] ?? json['Rating'];
    final ratingValueRaw = json['ratingValue'] ?? json['RatingValue'];

    return Order(
      id: json['orderNumber'] ?? json['OrderNumber'] ?? json['orderId'] ?? json['id'] as int,
      userId: json['userId'] ?? json['UserId'] as String?,
      userName: json['userName'] ?? json['UserName'] ?? json['userDisplayName'] ?? json['UserDisplayName'] as String?,
      date: DateTime.parse((json['date'] ?? json['Date']) as String),
      status: status,
      description: json['description'] ?? json['Description'] as String?,
      customerNote: json['customerNote'] ?? json['CustomerNote'] as String?,
      total: ((json['total'] ?? json['Total']) as num).toDouble(),
      pointsToRedeem: (json['pointsToRedeem'] ?? json['PointsToRedeem'] ?? 0) as int,
      loyaltyDiscount: ((json['loyaltyDiscount'] ?? json['LoyaltyDiscount'] ?? 0) as num).toDouble(),
      items: (orderItems as List<dynamic>?)
              ?.map((e) => OrderItem.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
      ratingValue: ratingValueRaw as int?,
      rating: ratingJson != null ? OrderRating.fromJson(ratingJson as Map<String, dynamic>) : null,
      sessionId: (json['sessionId'] ?? json['SessionId']) as int?,
      placeId: (json['placeId'] ?? json['PlaceId']) as int?,
      placeKind: (json['placeKind'] ?? json['PlaceKind']) as String?,
      placeName: LocalizedText.parseNullable(json['placeName'] ?? json['PlaceName']),
      guestName: (json['guestName'] ?? json['GuestName']) as String?,
      guestPhone: (json['guestPhone'] ?? json['GuestPhone']) as String?,
      source: (json['source'] ?? json['Source']) as String?,
      guestOrdersBefore: (json['guestOrdersBefore'] ?? json['GuestOrdersBefore']) as int?,
    );
  }
}
