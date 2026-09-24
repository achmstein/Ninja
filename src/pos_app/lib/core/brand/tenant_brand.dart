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

  const TenantFeatures({
    this.reservations = true,
    this.timeBilling = true,
    this.loyalty = true,
    this.tabs = true,
    this.inventory = true,
    this.finance = true,
    this.payroll = true,
    this.kds = true,
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
      };
}

/// Where the tenant trades: what its prices are counted in, what its
/// clock says and which language its customers read first. Tenant one's
/// values stand in until the brand is known.
class TenantLocale {
  /// ISO 3166-1 alpha-2
  final String country;

  /// ISO 4217
  final String currency;

  /// IANA
  final String timeZone;

  /// `ar` or `en`
  final String language;

  const TenantLocale({
    this.country = 'EG',
    this.currency = 'EGP',
    this.timeZone = 'Africa/Cairo',
    this.language = 'ar',
  });

  static const egypt = TenantLocale();

  static TenantLocale parse(Object? json) {
    if (json is! Map<String, dynamic>) return egypt;
    String read(String key, String fallback) {
      final value = (json[key] as String?)?.trim();
      return value == null || value.isEmpty ? fallback : value;
    }

    return TenantLocale(
      country: read('country', egypt.country).toUpperCase(),
      currency: read('currency', egypt.currency).toUpperCase(),
      timeZone: read('timeZone', egypt.timeZone),
      language: read('language', egypt.language).toLowerCase(),
    );
  }

  Map<String, dynamic> toJson() => {
        'country': country,
        'currency': currency,
        'timeZone': timeZone,
        'language': language,
      };

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TenantLocale &&
          other.country == country &&
          other.currency == currency &&
          other.timeZone == timeZone &&
          other.language == language;

  @override
  int get hashCode => Object.hash(country, currency, timeZone, language);
}

/// The tenant this build runs for: name, one brand color, a logo, its locale
/// and the feature switches (`GET /api/tenant`). Cached between runs, so the
/// app paints the right brand before the network answers.
class TenantBrand {
  final LocalizedText name;

  /// `#rrggbb`, or null when the tenant keeps the neutral palette
  final String? primaryColorHex;

  /// Absolute URL of the uploaded mark, or null when there is none
  final String? logoUrl;

  /// Absolute URL of the English wide logo, the one paper prints
  final String? wordmarkUrl;
  final TenantLocale locale;

  /// `light` or `dark` for someone who has not chosen; null follows the device
  final String? defaultThemeMode;
  final TenantFeatures features;
  final int version;

  const TenantBrand({
    required this.name,
    this.primaryColorHex,
    this.logoUrl,
    this.wordmarkUrl,
    this.locale = TenantLocale.egypt,
    this.defaultThemeMode,
    this.features = TenantFeatures.all,
    this.version = 0,
  });

  /// What a receipt prints at the top: the wide logo, else the mark, else nothing (the name stands in)
  String? get receiptImageUrl => wordmarkUrl ?? logoUrl;

  /// What shows until anything is known: a neutral name, no color, no logo,
  /// every feature on
  static const neutral = TenantBrand(name: LocalizedText(en: ''));

  /// The API's shape; relative URLs are relative to [baseUrl]
  factory TenantBrand.fromApi(Map<String, dynamic> json, {required String baseUrl}) {
    final logo = json['logoUrl'] as String?;
    final wordmarks = json['wordmarks'];
    final wordmark = wordmarks is Map<String, dynamic> && wordmarks['en'] is Map<String, dynamic>
        ? (wordmarks['en'] as Map<String, dynamic>)['url'] as String?
        : null;
    String? absolute(String? url) => url == null ? null : (url.startsWith('http') ? url : '$baseUrl$url');
    return TenantBrand(
      name: LocalizedText.parse(json['name']),
      primaryColorHex: _hex(json['primaryColor'] as String?),
      logoUrl: absolute(logo),
      wordmarkUrl: absolute(wordmark),
      locale: TenantLocale.parse(json['locale']),
      defaultThemeMode: _mode(json['theme'] is Map ? (json['theme'] as Map)['mode'] : null),
      features: json['features'] is Map<String, dynamic>
          ? TenantFeatures.fromJson(json['features'] as Map<String, dynamic>)
          : TenantFeatures.all,
      version: (json['version'] as num?)?.toInt() ?? 0,
    );
  }

  /// The cached shape (what [toJson] wrote)
  factory TenantBrand.fromJson(Map<String, dynamic> json) => TenantBrand(
        name: LocalizedText.parse(json['name']),
        primaryColorHex: _hex(json['primaryColor'] as String?),
        logoUrl: json['logoUrl'] as String?,
        wordmarkUrl: json['wordmarkUrl'] as String?,
        locale: TenantLocale.parse(json['locale']),
        defaultThemeMode: _mode(json['theme'] is Map ? (json['theme'] as Map)['mode'] : json['defaultThemeMode']),
        features: json['features'] is Map<String, dynamic>
            ? TenantFeatures.fromJson(json['features'] as Map<String, dynamic>)
            : TenantFeatures.all,
        version: (json['version'] as num?)?.toInt() ?? 0,
      );

  Map<String, dynamic> toJson() => {
        'name': name.toJson(),
        'primaryColor': primaryColorHex,
        'logoUrl': logoUrl,
        'wordmarkUrl': wordmarkUrl,
        'locale': locale.toJson(),
        'defaultThemeMode': defaultThemeMode,
        'features': features.toJson(),
        'version': version,
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

/// `light` or `dark`, anything else follows the device
String? _mode(Object? value) => value == 'light' || value == 'dark' ? value as String : null;
