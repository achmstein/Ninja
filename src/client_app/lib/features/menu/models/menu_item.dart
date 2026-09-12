import '../../../core/models/localized_text.dart';

/// Menu item model
class MenuItem {
  final int id;
  final LocalizedText name;
  final LocalizedText description;
  final double price;
  final String? pictureUri;
  final int catalogTypeId;
  final LocalizedText catalogTypeName;
  final bool isAvailable;
  final bool isOnOffer;
  final double? offerPrice;
  final bool isPopular;
  final int? preparationTimeMinutes;
  final int displayOrder;
  final List<ItemCustomization> customizations;

  MenuItem({
    required this.id,
    required this.name,
    required this.description,
    required this.price,
    this.pictureUri,
    required this.catalogTypeId,
    required this.catalogTypeName,
    this.isAvailable = true,
    this.isOnOffer = false,
    this.offerPrice,
    this.isPopular = false,
    this.preparationTimeMinutes,
    this.displayOrder = 0,
    this.customizations = const [],
  });

  /// Returns the effective price: offerPrice when on offer, otherwise regular price
  double get effectivePrice => isOnOffer && offerPrice != null ? offerPrice! : price;

  factory MenuItem.fromJson(Map<String, dynamic> json) {
    return MenuItem(
      id: json['id'] as int,
      name: _parseLocalizedText(json['name'], json['nameAr']),
      description: _parseLocalizedText(json['description'] ?? '', json['descriptionAr']),
      price: (json['price'] as num).toDouble(),
      pictureUri: json['pictureUri'] as String?,
      catalogTypeId: json['catalogTypeId'] as int,
      catalogTypeName: _parseLocalizedText(json['catalogTypeName'] ?? '', json['catalogTypeNameAr']),
      isAvailable: json['isAvailable'] as bool? ?? true,
      isOnOffer: json['isOnOffer'] as bool? ?? false,
      offerPrice: (json['offerPrice'] as num?)?.toDouble(),
      isPopular: json['isPopular'] as bool? ?? false,
      preparationTimeMinutes: json['preparationTimeMinutes'] as int?,
      displayOrder: json['displayOrder'] as int? ?? 0,
      customizations: (json['customizations'] as List<dynamic>?)
              ?.map((e) => ItemCustomization.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }

  /// Parse LocalizedText from JSON - handles both object and separate fields
  static LocalizedText _parseLocalizedText(dynamic value, [String? arValue]) {
    if (value is Map<String, dynamic>) {
      return LocalizedText.fromJson(value);
    } else if (value is String) {
      return LocalizedText(en: value, ar: arValue);
    }
    return LocalizedText(en: value?.toString() ?? '', ar: arValue);
  }
}

/// Customization group (e.g., "Roasting", "Sugar Level")
class ItemCustomization {
  final int id;
  final LocalizedText name;
  final bool isRequired;
  final bool allowMultiple;
  final List<CustomizationOption> options;

  ItemCustomization({
    required this.id,
    required this.name,
    this.isRequired = false,
    this.allowMultiple = false,
    this.options = const [],
  });

  factory ItemCustomization.fromJson(Map<String, dynamic> json) {
    return ItemCustomization(
      id: json['id'] as int,
      name: MenuItem._parseLocalizedText(json['name'], json['nameAr']),
      isRequired: json['isRequired'] as bool? ?? false,
      allowMultiple: json['allowMultiple'] as bool? ?? false,
      options: (json['options'] as List<dynamic>?)
              ?.map((e) => CustomizationOption.fromJson(e as Map<String, dynamic>))
              .toList() ??
          [],
    );
  }
}

/// Customization option (e.g., "Light Roast", "No Sugar")
class CustomizationOption {
  final int id;
  final LocalizedText name;
  final double priceAdjustment;
  final bool isDefault;

  /// Inventory marked this option sold out at the branch the menu was
  /// fetched for; it is shown but cannot be picked.
  final bool isOutOfStock;

  CustomizationOption({
    required this.id,
    required this.name,
    this.priceAdjustment = 0,
    this.isDefault = false,
    this.isOutOfStock = false,
  });

  factory CustomizationOption.fromJson(Map<String, dynamic> json) {
    return CustomizationOption(
      id: json['id'] as int,
      name: MenuItem._parseLocalizedText(json['name'], json['nameAr']),
      priceAdjustment: (json['priceAdjustment'] as num?)?.toDouble() ?? 0,
      isDefault: json['isDefault'] as bool? ?? false,
      isOutOfStock: json['isOutOfStock'] as bool? ?? false,
    );
  }
}

/// Category model
class MenuCategory {
  final int id;
  final LocalizedText name;
  final int displayOrder;

  MenuCategory({
    required this.id,
    required this.name,
    this.displayOrder = 0,
  });

  factory MenuCategory.fromJson(Map<String, dynamic> json) {
    return MenuCategory(
      id: json['id'] as int,
      // New format: { "name": { "en": "...", "ar": "..." } }
      // Old format: { "type": "...", "typeAr": "..." }
      name: MenuItem._parseLocalizedText(
        json['name'] ?? json['type'] ?? '',
        json['typeAr'] ?? json['nameAr'],
      ),
      displayOrder: json['displayOrder'] as int? ?? 0,
    );
  }
}
