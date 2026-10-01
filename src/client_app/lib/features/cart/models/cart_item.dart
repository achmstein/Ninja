import '../../../core/models/localized_text.dart';
import '../../menu/models/menu_item.dart';

/// Selected customization in cart
class SelectedCustomization {
  final int customizationId;
  final LocalizedText customizationName;
  final int optionId;
  final LocalizedText optionName;
  final double priceAdjustment;

  SelectedCustomization({
    required this.customizationId,
    required this.customizationName,
    required this.optionId,
    required this.optionName,
    this.priceAdjustment = 0,
  });

  Map<String, dynamic> toJson() {
    return {
      'customizationId': customizationId,
      'customizationName': customizationName.toJson(),
      'optionId': optionId,
      'optionName': optionName.toJson(),
      'priceAdjustment': priceAdjustment,
    };
  }

  factory SelectedCustomization.fromJson(Map<String, dynamic> json) => SelectedCustomization(
        customizationId: (json['customizationId'] as num).toInt(),
        customizationName: LocalizedText.parse(json['customizationName']),
        optionId: (json['optionId'] as num).toInt(),
        optionName: LocalizedText.parse(json['optionName']),
        priceAdjustment: (json['priceAdjustment'] as num?)?.toDouble() ?? 0,
      );
}

/// Cart item with customizations
class CartItem {
  final int productId;
  final LocalizedText productName;
  final double unitPrice;
  final double? originalUnitPrice;
  final String? pictureUri;
  final int quantity;
  final String? specialInstructions;
  final List<SelectedCustomization> selectedCustomizations;

  /// Added from a suggestion ("goes well with"): 'Pairing' on an item's
  /// sheet, 'CartNudge' from the cart. Not part of how lines merge: added
  /// again by hand it is the same line, and keeps saying how it first came.
  final String? suggestion;

  const CartItem({
    required this.productId,
    required this.productName,
    required this.unitPrice,
    this.originalUnitPrice,
    this.pictureUri,
    this.quantity = 1,
    this.specialInstructions,
    this.selectedCustomizations = const [],
    this.suggestion,
  });

  bool get isOnOffer => originalUnitPrice != null && originalUnitPrice! > unitPrice;

  CartItem copyWith({
    int? quantity,
    String? specialInstructions,
    List<SelectedCustomization>? selectedCustomizations,
    String? suggestion,
  }) {
    return CartItem(
      productId: productId,
      productName: productName,
      unitPrice: unitPrice,
      originalUnitPrice: originalUnitPrice,
      pictureUri: pictureUri,
      quantity: quantity ?? this.quantity,
      specialInstructions: specialInstructions ?? this.specialInstructions,
      selectedCustomizations: selectedCustomizations ?? this.selectedCustomizations,
      suggestion: suggestion ?? this.suggestion,
    );
  }

  /// Calculate total price including customizations
  double get totalPrice {
    final customizationsTotal =
        selectedCustomizations.fold(0.0, (sum, c) => sum + c.priceAdjustment);
    return (unitPrice + customizationsTotal) * quantity;
  }

  /// Original total price (before offer) including customizations
  double get originalTotalPrice {
    final customizationsTotal =
        selectedCustomizations.fold(0.0, (sum, c) => sum + c.priceAdjustment);
    return ((originalUnitPrice ?? unitPrice) + customizationsTotal) * quantity;
  }

  /// Create cart item from menu item with selected options
  factory CartItem.fromMenuItem(
    MenuItem item, {
    List<SelectedCustomization>? customizations,
    String? instructions,
  }) {
    return CartItem(
      productId: item.id,
      productName: item.name,
      unitPrice: item.effectivePrice,
      originalUnitPrice: item.isOnOffer ? item.price : null,
      pictureUri: item.pictureUri,
      selectedCustomizations: customizations ?? [],
      specialInstructions: instructions,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'productId': productId,
      'productName': productName.toJson(),
      'unitPrice': unitPrice,
      'pictureUrl': pictureUri,
      'quantity': quantity,
      'specialInstructions': specialInstructions,
      'selectedCustomizations':
          selectedCustomizations.map((c) => c.toJson()).toList(),
      'suggestion': suggestion ?? 'None',
    };
  }

  /// The line as the phone keeps it between visits: every field, read back by [CartItem.fromStorage]
  Map<String, dynamic> toStorage() => {
        'productId': productId,
        'productName': productName.toJson(),
        'unitPrice': unitPrice,
        'originalUnitPrice': originalUnitPrice,
        'pictureUri': pictureUri,
        'quantity': quantity,
        'specialInstructions': specialInstructions,
        'selectedCustomizations': selectedCustomizations.map((c) => c.toJson()).toList(),
        'suggestion': suggestion,
      };

  factory CartItem.fromStorage(Map<String, dynamic> json) => CartItem(
        productId: (json['productId'] as num).toInt(),
        productName: LocalizedText.parse(json['productName']),
        unitPrice: (json['unitPrice'] as num).toDouble(),
        originalUnitPrice: (json['originalUnitPrice'] as num?)?.toDouble(),
        pictureUri: json['pictureUri'] as String?,
        quantity: (json['quantity'] as num?)?.toInt() ?? 1,
        specialInstructions: json['specialInstructions'] as String?,
        selectedCustomizations: [
          for (final c in (json['selectedCustomizations'] as List? ?? const [])) SelectedCustomization.fromJson(c as Map<String, dynamic>),
        ],
        suggestion: json['suggestion'] as String?,
      );
}

/// Shopping cart state
class Cart {
  final List<CartItem> items;

  Cart({this.items = const []});

  /// Total number of items
  int get itemCount => items.fold(0, (sum, item) => sum + item.quantity);

  /// Total price of all items
  double get totalPrice =>
      items.fold(0.0, (sum, item) => sum + item.totalPrice);

  /// Check if cart is empty
  bool get isEmpty => items.isEmpty;

  /// Add or update item in cart
  Cart addItem(CartItem newItem) {
    final existingIndex = items.indexWhere((i) =>
        i.productId == newItem.productId &&
        _customizationsMatch(i.selectedCustomizations, newItem.selectedCustomizations));

    if (existingIndex >= 0) {
      // Update quantity of existing item
      final updatedItems = List<CartItem>.from(items);
      updatedItems[existingIndex] = updatedItems[existingIndex].copyWith(
        quantity: updatedItems[existingIndex].quantity + newItem.quantity,
      );
      return Cart(items: updatedItems);
    } else {
      // Add new item
      return Cart(items: [...items, newItem]);
    }
  }

  /// Update item quantity
  Cart updateQuantity(int index, int quantity) {
    if (index < 0 || index >= items.length) return this;

    final updatedItems = List<CartItem>.from(items);
    if (quantity <= 0) {
      updatedItems.removeAt(index);
    } else {
      updatedItems[index] = updatedItems[index].copyWith(quantity: quantity);
    }
    return Cart(items: updatedItems);
  }

  /// Remove item from cart
  Cart removeItem(int index) {
    if (index < 0 || index >= items.length) return this;

    final updatedItems = List<CartItem>.from(items);
    updatedItems.removeAt(index);
    return Cart(items: updatedItems);
  }

  /// Clear cart
  Cart clear() => Cart(items: []);

  /// Check if two customization lists match
  bool _customizationsMatch(
      List<SelectedCustomization> a, List<SelectedCustomization> b) {
    if (a.length != b.length) return false;
    for (var i = 0; i < a.length; i++) {
      if (a[i].optionId != b[i].optionId) return false;
    }
    return true;
  }
}
