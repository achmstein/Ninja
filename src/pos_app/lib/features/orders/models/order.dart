import 'package:ninja_app_core/models/localized_text.dart';

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

/// How a delivery platform's order leaves the business
enum PlatformExpedition {
  /// The platform's rider collects it at the counter
  platformDelivery,

  /// The business's own rider takes it to the address
  vendorDelivery,

  /// The customer collects it
  pickup;

  static PlatformExpedition parse(String? value) => switch (value) {
        'VendorDelivery' => PlatformExpedition.vendorDelivery,
        'Pickup' => PlatformExpedition.pickup,
        _ => PlatformExpedition.platformDelivery,
      };
}

/// What a delivery platform (Talabat) said about its order, as the counter
/// reads it: the code the rider asks for, how it leaves, and (only when the
/// business's own rider takes it) where to
class PlatformOrder {
  /// "Talabat"
  final String name;
  final String code;
  final String? shortCode;
  final PlatformExpedition expedition;
  final DateTime? riderPickupAt;
  final DateTime? dueAt;
  final String? deliveryAddress;
  final bool paidOnline;
  final double? collectFromCustomer;

  /// The platform cancelled it
  final DateTime? cancelledAt;

  const PlatformOrder({
    required this.name,
    required this.code,
    this.shortCode,
    required this.expedition,
    this.riderPickupAt,
    this.dueAt,
    this.deliveryAddress,
    this.paidOnline = false,
    this.collectFromCustomer,
    this.cancelledAt,
  });

  /// The code the rider asks for at the counter
  String get displayCode => shortCode ?? code;

  static DateTime? _time(Object? value) => value is String ? DateTime.tryParse(value)?.toLocal() : null;

  static PlatformOrder? parse(Object? json) {
    if (json is! Map<String, dynamic>) return null;
    final collect = json['collectFromCustomer'];
    return PlatformOrder(
      name: (json['name'] as String?) ?? '',
      code: (json['code'] as String?) ?? '',
      shortCode: json['shortCode'] as String?,
      expedition: PlatformExpedition.parse(json['expedition'] as String?),
      riderPickupAt: _time(json['riderPickupAt']),
      dueAt: _time(json['dueAt']),
      deliveryAddress: json['deliveryAddress'] as String?,
      paidOnline: json['paidOnline'] == true,
      collectFromCustomer: collect is num ? collect.toDouble() : double.tryParse('${collect ?? ''}'),
      cancelledAt: _time(json['cancelledAt']),
    );
  }
}

/// Where a delivery has got to, as the server says it
enum DeliveryStage {
  waiting,
  assigned,
  onTheWay,
  delivered,

  /// The rider could not hand it over: the bag is on its way back to the branch
  failed,

  /// The bag is back at the branch
  returned;

  /// The server's spelling of a stage; anything unknown is one still waiting
  static DeliveryStage parse(Object? value) => switch (value) {
        'Assigned' => assigned,
        'OnTheWay' => onTheWay,
        'Delivered' => delivered,
        'Failed' => failed,
        'Returned' => returned,
        _ => waiting,
      };
}

/// The business's own delivery of an order, as the counter reads it: where
/// it goes, the number to call at the door, the fee, and who has it
class OrderDelivery {
  /// The pin; null for an address the till took over the phone without one,
  /// which the rider finds by its words
  final double? latitude;
  final double? longitude;
  final String address;
  final String? building;
  final String? floor;
  final String? apartment;
  final String? directions;
  final String phone;
  final double fee;

  /// Straight-line from the branch; null without a pin
  final int? distanceMeters;

  final DeliveryStage stage;
  final String? riderUserId;
  final String? riderName;
  final DateTime? outAt;
  final DateTime? deliveredAt;

  /// Why the rider could not hand it over (a code: NoAnswer, Refused, WrongAddress, Other)
  final String? failureReason;

  /// The till took the rider's cash, which settled the bill
  final DateTime? cashHandedInAt;

  /// What the till counted in from the rider for it
  final double? cashCollected;

  const OrderDelivery({
    this.latitude,
    this.longitude,
    required this.address,
    this.building,
    this.floor,
    this.apartment,
    this.directions,
    required this.phone,
    this.fee = 0,
    this.distanceMeters,
    this.stage = DeliveryStage.waiting,
    this.riderUserId,
    this.riderName,
    this.outAt,
    this.deliveredAt,
    this.failureReason,
    this.cashHandedInAt,
    this.cashCollected,
  });

  static double _num(Object? v) => v is num ? v.toDouble() : double.tryParse('${v ?? ''}') ?? 0;
  static double? _maybe(Object? v) => v == null ? null : _num(v);

  /// Kept in UTC, the server's own; shown in the till's local time where it is drawn
  static DateTime? _time(Object? value) => value is String ? DateTime.tryParse(value)?.toUtc() : null;

  static String? _text(Object? value) {
    final text = value is String ? value.trim() : null;
    return text == null || text.isEmpty ? null : text;
  }

  static OrderDelivery? parse(Object? json) {
    if (json is! Map<String, dynamic>) return null;
    return OrderDelivery(
      latitude: _maybe(json['latitude']),
      longitude: _maybe(json['longitude']),
      address: _text(json['address']) ?? '',
      building: _text(json['building']),
      floor: _text(json['floor']),
      apartment: _text(json['apartment']),
      directions: _text(json['directions']),
      phone: _text(json['phone']) ?? '',
      fee: _num(json['fee']),
      distanceMeters: _maybe(json['distanceMeters'])?.round(),
      stage: DeliveryStage.parse(json['stage']),
      riderUserId: _text(json['riderUserId']),
      riderName: _text(json['riderName']),
      outAt: _time(json['outAt']),
      deliveredAt: _time(json['deliveredAt']),
      failureReason: _text(json['failureReason']),
      cashHandedInAt: _time(json['cashHandedInAt']),
      cashCollected: _maybe(json['cashCollected']),
    );
  }

  /// The customer's number to dial: only what a dialler reads (digits, a leading +)
  Uri get phoneUri => Uri(scheme: 'tel', path: phone.replaceAll(RegExp(r'[^0-9+]'), ''));

  bool get hasPin => latitude != null && longitude != null;

  /// Google Maps' way to the door from wherever the rider is: to the pin,
  /// or to the address as the caller said it, for Maps to find
  Uri get directionsUri => Uri.parse(
      'https://www.google.com/maps/dir/?api=1&destination=${hasPin ? '$latitude,$longitude' : Uri.encodeQueryComponent(address)}');

  /// The address on one line, the street first. [separator] is the
  /// language's list comma (", " or "، "), from the app's strings.
  String line({required String building, required String floor, required String apartment, required String separator}) {
    final parts = [
      if ((this.building ?? '').isNotEmpty) '$building ${this.building}',
      if ((this.floor ?? '').isNotEmpty) '$floor ${this.floor}',
      if ((this.apartment ?? '').isNotEmpty) '$apartment ${this.apartment}',
    ];
    return parts.isEmpty ? address : '$address · ${parts.join(separator)}';
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

  /// A delivery platform's details; null on every other order
  final PlatformOrder? platform;

  /// The business's own delivery; null on every order eaten in or collected
  final OrderDelivery? delivery;

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
    this.platform,
    this.delivery,
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
      platform: PlatformOrder.parse(json['platform'] ?? json['Platform']),
      delivery: OrderDelivery.parse(json['delivery'] ?? json['Delivery']),
    );
  }
}
