import 'dart:ui' show Color, Locale;
import '../models/localized_text.dart';

/// The switches a tenant can turn off. Every one is on until the brand is
/// known, so nothing flashes off and back at startup.
class TenantFeatures {
  final bool reservations;
  final bool timeBilling;
  final bool loyalty;
  final bool tabs;
  final bool inventory;
  final bool finance;
  final bool payroll;
  final bool kds;

  /// Guests pay or split the bill online. An add-on the café buys and turns
  /// on, so off until the brand says otherwise (and when a stack older than
  /// it says nothing).
  final bool payAtTable;

  const TenantFeatures({
    this.reservations = true,
    this.timeBilling = true,
    this.loyalty = true,
    this.tabs = true,
    this.inventory = true,
    this.finance = true,
    this.payroll = true,
    this.kds = true,
    this.payAtTable = false,
  });

  static const all = TenantFeatures();

  factory TenantFeatures.fromJson(Map<String, dynamic> json) => TenantFeatures(
        // A cache from before the split says "spaces" for both
        reservations: json['reservations'] as bool? ?? json['spaces'] as bool? ?? true,
        timeBilling: json['timeBilling'] as bool? ?? json['spaces'] as bool? ?? true,
        loyalty: json['loyalty'] as bool? ?? true,
        tabs: json['tabs'] as bool? ?? true,
        inventory: json['inventory'] as bool? ?? true,
        finance: json['finance'] as bool? ?? true,
        payroll: json['payroll'] as bool? ?? true,
        kds: json['kds'] as bool? ?? true,
        payAtTable: json['payAtTable'] as bool? ?? false,
      );

  Map<String, dynamic> toJson() => {
        'reservations': reservations,
        'timeBilling': timeBilling,
        'loyalty': loyalty,
        'tabs': tabs,
        'inventory': inventory,
        'finance': finance,
        'payroll': payroll,
        'kds': kds,
        'payAtTable': payAtTable,
      };
}

/// The tenant this build runs for: name, one brand color, a logo and the
/// feature switches (`GET /api/tenant`). Cached between runs, so the app
/// paints the right brand before the network answers.
class TenantBrand {
  final LocalizedText name;

  /// `#rrggbb`, or null when the tenant keeps the neutral palette
  final String? primaryColorHex;

  /// Absolute URL of the uploaded logo, or null when there is none
  final String? logoUrl;
  final TenantFeatures features;
  final int version;

  /// `light` or `dark` for a display nobody has set; null keeps the kitchen's own default
  final String? defaultThemeMode;

  const TenantBrand({
    required this.name,
    this.primaryColorHex,
    this.logoUrl,
    this.features = TenantFeatures.all,
    this.version = 0,
    this.defaultThemeMode,
  });

  /// What shows until anything is known: a neutral name, no color, no logo,
  /// every feature on
  static const neutral = TenantBrand(name: LocalizedText(en: ''));

  /// The API's shape; relative URLs are relative to [baseUrl]
  factory TenantBrand.fromApi(Map<String, dynamic> json, {required String baseUrl}) {
    final logo = json['logoUrl'] as String?;
    return TenantBrand(
      name: LocalizedText.parse(json['name']),
      primaryColorHex: _hex(json['primaryColor'] as String?),
      logoUrl: logo == null ? null : (logo.startsWith('http') ? logo : '$baseUrl$logo'),
      features: json['features'] is Map<String, dynamic>
          ? TenantFeatures.fromJson(json['features'] as Map<String, dynamic>)
          : TenantFeatures.all,
      version: (json['version'] as num?)?.toInt() ?? 0,
      defaultThemeMode: _mode(json['theme'] is Map ? (json['theme'] as Map)['mode'] : null),
    );
  }

  /// The cached shape (what [toJson] wrote)
  factory TenantBrand.fromJson(Map<String, dynamic> json) => TenantBrand(
        name: LocalizedText.parse(json['name']),
        primaryColorHex: _hex(json['primaryColor'] as String?),
        logoUrl: json['logoUrl'] as String?,
        features: json['features'] is Map<String, dynamic>
            ? TenantFeatures.fromJson(json['features'] as Map<String, dynamic>)
            : TenantFeatures.all,
        version: (json['version'] as num?)?.toInt() ?? 0,
        defaultThemeMode: _mode(json['defaultThemeMode']),
      );

  Map<String, dynamic> toJson() => {
        'name': name.toJson(),
        'primaryColor': primaryColorHex,
        'logoUrl': logoUrl,
        'features': features.toJson(),
        'version': version,
        'defaultThemeMode': defaultThemeMode,
      };

  Color? get primaryColor {
    final hex = primaryColorHex;
    if (hex == null) return null;
    return Color(0xFF000000 | int.parse(hex.substring(1), radix: 16));
  }

  String displayName(Locale locale) => name.getText(locale);

  /// The first letter of the name, for the tile that stands in for a logo
  String initial(Locale locale) {
    final text = displayName(locale).trim();
    return text.isEmpty ? '' : text.substring(0, 1).toUpperCase();
  }

  static String? _hex(String? value) {
    if (value == null) return null;
    final v = value.trim().toLowerCase();
    return RegExp(r'^#[0-9a-f]{6}$').hasMatch(v) ? v : null;
  }
}

/// `light` or `dark`, anything else leaves the default
String? _mode(Object? value) => value == 'light' || value == 'dark' ? value as String : null;
