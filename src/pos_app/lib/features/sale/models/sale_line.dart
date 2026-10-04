import 'package:flutter/widgets.dart';

import 'package:ninja_app_core/models/localized_text.dart';
import '../../../core/models/money.dart';

/// A snapshot of a chosen customization option at add-to-cart time
class SaleCustomization {
  final int customizationId;
  final String? customizationNameEn;
  final String? customizationNameAr;
  final int optionId;
  final String? optionNameEn;
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

  /// Either language may be the only one the business writes
  LocalizedText get customizationName => LocalizedText(en: customizationNameEn, ar: customizationNameAr);

  LocalizedText get optionName => LocalizedText(en: optionNameEn, ar: optionNameAr);

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
        customizationNameEn: _text(json['customizationNameEn']),
        customizationNameAr: _text(json['customizationNameAr']),
        optionId: toInt(json['optionId']),
        optionNameEn: _text(json['optionNameEn']),
        optionNameAr: _text(json['optionNameAr']),
        priceAdjustment: toNumber(json['priceAdjustment']),
      );
}

/// A snapshot of the item at add time; the backend re-validates everything
/// when the order is created. Ported from pos_web's `cart.ts`.
class SaleLine {
  final int productId;
  final String? nameEn;
  final String? nameAr;

  /// Unit price including customization adjustments
  final double price;
  final String? pictureUrl;
  final int quantity;
  final String? specialInstructions;
  final List<SaleCustomization> customizations;

  /// Rung up from what the last dish goes well with ('Till'). Not part of
  /// the key: added again by hand it is the same line, and keeps saying so.
  final String? suggestion;

  const SaleLine({
    required this.productId,
    required this.nameEn,
    required this.nameAr,
    required this.price,
    this.pictureUrl,
    this.quantity = 1,
    this.specialInstructions,
    this.customizations = const [],
    this.suggestion,
  });

  /// Same product, same options, same note: the line it merges into
  String get key {
    final options = customizations.map((c) => c.optionId).toList()..sort();
    return '$productId:${options.join(',')}:${specialInstructions ?? ''}';
  }

  double get total => price * quantity;

  /// The unit price before the options: Ordering adds them back on, so this
  /// is what an order sends, never [price]
  double get basePrice =>
      price - customizations.fold(0.0, (sum, c) => sum + c.priceAdjustment);

  /// The item's name as the business writes it: English, Arabic or both
  LocalizedText get name => LocalizedText(en: nameEn, ar: nameAr);

  /// The chosen options and the note, as Sales stores a line's details: a
  /// language any option is written in gets the whole list (an option not
  /// written in it read in the other); the note goes to both as typed
  LocalizedText? get details {
    String? join(Iterable<String?> parts) {
      final text = parts.whereType<String>().where((s) => s.trim().isNotEmpty).join(', ');
      return text.isEmpty ? null : text;
    }

    final options = [for (final c in customizations) c.optionName];
    final note = specialInstructions;
    final en = options.any((o) => o.en != null) || options.isEmpty
        ? join([for (final o in options) o.getText(const Locale('en')), note])
        : null;
    final ar = options.any((o) => o.ar != null) || options.isEmpty
        ? join([for (final o in options) o.getText(const Locale('ar')), note])
        : null;
    final text = LocalizedText(en: en, ar: ar);
    return text.isEmpty ? null : text;
  }

  SaleLine withQuantity(int quantity) => SaleLine(
        productId: productId,
        nameEn: nameEn,
        nameAr: nameAr,
        price: price,
        pictureUrl: pictureUrl,
        quantity: quantity,
        specialInstructions: specialInstructions,
        customizations: customizations,
        suggestion: suggestion,
      );

  /// The same line, rung up from a suggestion
  SaleLine suggested() => SaleLine(
        productId: productId,
        nameEn: nameEn,
        nameAr: nameAr,
        price: price,
        pictureUrl: pictureUrl,
        quantity: quantity,
        specialInstructions: specialInstructions,
        customizations: customizations,
        suggestion: 'Till',
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
        'suggestion': suggestion,
      };

  factory SaleLine.fromJson(Map<String, dynamic> json) => SaleLine(
        productId: toInt(json['productId']),
        nameEn: _text(json['nameEn']),
        nameAr: _text(json['nameAr']),
        price: toNumber(json['price']),
        pictureUrl: json['pictureUrl'] as String?,
        quantity: toInt(json['quantity']),
        specialInstructions: json['specialInstructions'] as String?,
        customizations: ((json['customizations'] as List<dynamic>?) ?? [])
            .map((e) => SaleCustomization.fromJson(e as Map<String, dynamic>))
            .toList(),
        suggestion: json['suggestion'] as String?,
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

/// A stored name: a blank side is no side
String? _text(Object? value) => value is String && value.trim().isNotEmpty ? value : null;

double saleTotal(List<SaleLine> lines) => lines.fold(0, (sum, l) => sum + l.total);

int saleCount(List<SaleLine> lines) => lines.fold(0, (sum, l) => sum + l.quantity);
