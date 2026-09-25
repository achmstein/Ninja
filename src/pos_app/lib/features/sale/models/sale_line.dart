import '../../../core/models/money.dart';

/// A snapshot of a chosen customization option at add-to-cart time
class SaleCustomization {
  final int customizationId;
  final String customizationNameEn;
  final String? customizationNameAr;
  final int optionId;
  final String optionNameEn;
  final String? optionNameAr;
  final double priceAdjustment;

  const SaleCustomization({
    required this.customizationId,
    required this.customizationNameEn,
    this.customizationNameAr,
    required this.optionId,
    required this.optionNameEn,
    this.optionNameAr,
    this.priceAdjustment = 0,
  });

  Map<String, dynamic> toJson() => {
        'customizationId': customizationId,
        'customizationNameEn': customizationNameEn,
        'customizationNameAr': customizationNameAr,
        'optionId': optionId,
        'optionNameEn': optionNameEn,
        'optionNameAr': optionNameAr,
        'priceAdjustment': priceAdjustment,
      };

  factory SaleCustomization.fromJson(Map<String, dynamic> json) => SaleCustomization(
        customizationId: toInt(json['customizationId']),
        customizationNameEn: json['customizationNameEn'] as String? ?? '',
        customizationNameAr: json['customizationNameAr'] as String?,
        optionId: toInt(json['optionId']),
        optionNameEn: json['optionNameEn'] as String? ?? '',
        optionNameAr: json['optionNameAr'] as String?,
        priceAdjustment: toNumber(json['priceAdjustment']),
      );
}

/// A snapshot of the item at add time; the backend re-validates everything
/// when the order is created. Ported from pos_web's `cart.ts`.
class SaleLine {
  final int productId;
  final String nameEn;
  final String nameAr;

  /// Unit price including customization adjustments
  final double price;
  final String? pictureUrl;
  final int quantity;
  final String? specialInstructions;
  final List<SaleCustomization> customizations;

  const SaleLine({
    required this.productId,
    required this.nameEn,
    required this.nameAr,
    required this.price,
    this.pictureUrl,
    this.quantity = 1,
    this.specialInstructions,
    this.customizations = const [],
  });

  /// Same product, same options, same note: the line it merges into
  String get key {
    final options = customizations.map((c) => c.optionId).toList()..sort();
    return '$productId:${options.join(',')}:${specialInstructions ?? ''}';
  }

  double get total => price * quantity;

  SaleLine withQuantity(int quantity) => SaleLine(
        productId: productId,
        nameEn: nameEn,
        nameAr: nameAr,
        price: price,
        pictureUrl: pictureUrl,
        quantity: quantity,
        specialInstructions: specialInstructions,
        customizations: customizations,
      );

  Map<String, dynamic> toJson() => {
        'productId': productId,
        'nameEn': nameEn,
        'nameAr': nameAr,
        'price': price,
        'pictureUrl': pictureUrl,
        'quantity': quantity,
        'specialInstructions': specialInstructions,
        'customizations': customizations.map((c) => c.toJson()).toList(),
      };

  factory SaleLine.fromJson(Map<String, dynamic> json) => SaleLine(
        productId: toInt(json['productId']),
        nameEn: json['nameEn'] as String? ?? '',
        nameAr: json['nameAr'] as String? ?? '',
        price: toNumber(json['price']),
        pictureUrl: json['pictureUrl'] as String?,
        quantity: toInt(json['quantity']),
        specialInstructions: json['specialInstructions'] as String?,
        customizations: ((json['customizations'] as List<dynamic>?) ?? [])
            .map((e) => SaleCustomization.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

/// Who the sale is for. `id` is an identity account — needed to accrue
/// loyalty or settle on a tab. A walk-in the waiters know by name has none:
/// the name still rides along to the kitchen card and the bill line.
class SaleCustomer {
  final String? id;
  final String name;

  /// As the search knew it; shown on the customer card
  final String? phone;

  /// Added at the counter and not yet claimed: their card offers the app link
  final bool addedAtCounter;

  const SaleCustomer({this.id, required this.name, this.phone, this.addedAtCounter = false});

  Map<String, dynamic> toJson() => {'id': id, 'name': name, 'phone': phone, if (addedAtCounter) 'addedAtCounter': true};

  factory SaleCustomer.fromJson(Map<String, dynamic> json) => SaleCustomer(
        id: json['id'] as String?,
        name: json['name'] as String? ?? '',
        phone: json['phone'] as String?,
        addedAtCounter: json['addedAtCounter'] as bool? ?? false,
      );
}

double saleTotal(List<SaleLine> lines) => lines.fold(0, (sum, l) => sum + l.total);

int saleCount(List<SaleLine> lines) => lines.fold(0, (sum, l) => sum + l.quantity);
