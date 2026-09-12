import '../../../core/config/app_config.dart';
import '../../../core/models/localized_text.dart';
import '../../../core/models/money.dart';

/// A sellable item as the catalog lists it (`CatalogItemDto`). The pad shows
/// the effective price; the server re-prices every line when the order is
/// created, so nothing here is trusted for money.
class CatalogItem {
  final int id;
  final LocalizedText name;
  final LocalizedText? description;
  final double price;
  final double? effectivePrice;
  final String? pictureUri;
  final int catalogTypeId;
  final bool isAvailable;
  final int displayOrder;
  final List<ItemCustomization> customizations;

  const CatalogItem({
    required this.id,
    required this.name,
    this.description,
    required this.price,
    this.effectivePrice,
    this.pictureUri,
    required this.catalogTypeId,
    this.isAvailable = true,
    this.displayOrder = 0,
    this.customizations = const [],
  });

  /// What the customer pays per unit before customizations
  double get unitPrice => effectivePrice ?? price;

  /// Item pictures are served straight off the BFF route (anonymous
  /// endpoint), the same URL shape the web till uses
  String? get pictureUrl =>
      pictureUri == null || pictureUri!.isEmpty ? null : '${AppConfig.bffBaseUrl}/api/catalog/items/$id/pic';

  factory CatalogItem.fromJson(Map<String, dynamic> json) => CatalogItem(
        id: toInt(json['id']),
        name: LocalizedText.parse(json['name']),
        description: LocalizedText.parseNullable(json['description']),
        price: toNumber(json['price']),
        effectivePrice: json['effectivePrice'] == null ? null : toNumber(json['effectivePrice']),
        pictureUri: json['pictureUri'] as String?,
        catalogTypeId: toInt(json['catalogTypeId']),
        isAvailable: json['isAvailable'] as bool? ?? true,
        displayOrder: toInt(json['displayOrder']),
        customizations: ((json['customizations'] as List<dynamic>?) ?? [])
            .map((e) => ItemCustomization.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

/// A customization group on an item ("Size", "Milk")
class ItemCustomization {
  final int id;
  final LocalizedText name;
  final bool isRequired;
  final bool allowMultiple;
  final int displayOrder;
  final List<CustomizationOption> options;

  const ItemCustomization({
    required this.id,
    required this.name,
    this.isRequired = false,
    this.allowMultiple = false,
    this.displayOrder = 0,
    this.options = const [],
  });

  factory ItemCustomization.fromJson(Map<String, dynamic> json) => ItemCustomization(
        id: toInt(json['id']),
        name: LocalizedText.parse(json['name']),
        isRequired: json['isRequired'] as bool? ?? false,
        allowMultiple: json['allowMultiple'] as bool? ?? false,
        displayOrder: toInt(json['displayOrder']),
        options: ((json['options'] as List<dynamic>?) ?? [])
            .map((e) => CustomizationOption.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

class CustomizationOption {
  final int id;
  final LocalizedText name;
  final double priceAdjustment;
  final bool isDefault;
  final int displayOrder;

  /// Inventory marked this option sold out at the till's branch; it is shown
  /// but cannot be picked.
  final bool isOutOfStock;

  const CustomizationOption({
    required this.id,
    required this.name,
    this.priceAdjustment = 0,
    this.isDefault = false,
    this.displayOrder = 0,
    this.isOutOfStock = false,
  });

  factory CustomizationOption.fromJson(Map<String, dynamic> json) => CustomizationOption(
        id: toInt(json['id']),
        name: LocalizedText.parse(json['name']),
        priceAdjustment: toNumber(json['priceAdjustment']),
        isDefault: json['isDefault'] as bool? ?? false,
        displayOrder: toInt(json['displayOrder']),
        isOutOfStock: json['isOutOfStock'] as bool? ?? false,
      );
}

class CatalogCategory {
  final int id;
  final LocalizedText name;
  final int displayOrder;

  const CatalogCategory({required this.id, required this.name, this.displayOrder = 0});

  factory CatalogCategory.fromJson(Map<String, dynamic> json) => CatalogCategory(
        id: toInt(json['id']),
        name: LocalizedText.parse(json['name'] ?? json['type']),
        displayOrder: toInt(json['displayOrder']),
      );
}
