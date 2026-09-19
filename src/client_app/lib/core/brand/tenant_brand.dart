import 'dart:ui' show Brightness, Color, Locale;
import '../models/localized_text.dart';

/// The switches a tenant can turn off. Every one is on until the brand is
/// known, so nothing flashes off and back at startup.
class TenantFeatures {
  final bool rooms;
  final bool loyalty;
  final bool tabs;
  final bool inventory;
  final bool finance;
  final bool payroll;
  final bool kds;

  const TenantFeatures({
    this.rooms = true,
    this.loyalty = true,
    this.tabs = true,
    this.inventory = true,
    this.finance = true,
    this.payroll = true,
    this.kds = true,
  });

  static const all = TenantFeatures();

  factory TenantFeatures.fromJson(Map<String, dynamic> json) => TenantFeatures(
        rooms: json['rooms'] as bool? ?? true,
        loyalty: json['loyalty'] as bool? ?? true,
        tabs: json['tabs'] as bool? ?? true,
        inventory: json['inventory'] as bool? ?? true,
        finance: json['finance'] as bool? ?? true,
        payroll: json['payroll'] as bool? ?? true,
        kds: json['kds'] as bool? ?? true,
      );

  Map<String, dynamic> toJson() => {
        'rooms': rooms,
        'loyalty': loyalty,
        'tabs': tabs,
        'inventory': inventory,
        'finance': finance,
        'payroll': payroll,
        'kds': kds,
      };

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TenantFeatures &&
          other.rooms == rooms &&
          other.loyalty == loyalty &&
          other.tabs == tabs &&
          other.inventory == inventory &&
          other.finance == finance &&
          other.payroll == payroll &&
          other.kds == kds;

  @override
  int get hashCode => Object.hash(rooms, loyalty, tabs, inventory, finance, payroll, kds);
}

/// The wide logo for headers and sign-in. [width] and [height] are the
/// trimmed PNG's pixels, so a box can be reserved before it loads.
class TenantWordmark {
  /// Absolute, versioned, immutable
  final String url;
  final int width;
  final int height;

  const TenantWordmark({required this.url, required this.width, required this.height});

  double get aspectRatio => width / height;

  /// A relative `url` is resolved against [baseUrl]; anything short of a
  /// URL and two positive sides is no wordmark
  static TenantWordmark? parse(Object? json, {String? baseUrl}) {
    if (json is! Map<String, dynamic>) return null;
    final url = json['url'] as String?;
    final width = (json['width'] as num?)?.toInt() ?? 0;
    final height = (json['height'] as num?)?.toInt() ?? 0;
    if (url == null || url.isEmpty || width <= 0 || height <= 0) return null;
    return TenantWordmark(url: _absolute(url, baseUrl), width: width, height: height);
  }

  Map<String, dynamic> toJson() => {'url': url, 'width': width, 'height': height};

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TenantWordmark && other.url == url && other.width == width && other.height == height;

  @override
  int get hashCode => Object.hash(url, width, height);
}

/// The wide lockups by language and scheme. A missing one falls back: the
/// dark to the light, Arabic to English, and to the mark and the name when
/// the tenant has none at all.
class TenantWordmarks {
  final TenantWordmark? en;
  final TenantWordmark? enDark;
  final TenantWordmark? ar;
  final TenantWordmark? arDark;

  const TenantWordmarks({this.en, this.enDark, this.ar, this.arDark});

  static const none = TenantWordmarks();

  static TenantWordmarks parse(Object? json, {String? baseUrl}) {
    if (json is! Map<String, dynamic>) return none;
    return TenantWordmarks(
      en: TenantWordmark.parse(json['en'], baseUrl: baseUrl),
      enDark: TenantWordmark.parse(json['enDark'], baseUrl: baseUrl),
      ar: TenantWordmark.parse(json['ar'], baseUrl: baseUrl),
      arDark: TenantWordmark.parse(json['arDark'], baseUrl: baseUrl),
    );
  }

  Map<String, dynamic> toJson() => {
        'en': en?.toJson(),
        'enDark': enDark?.toJson(),
        'ar': ar?.toJson(),
        'arDark': arDark?.toJson(),
      };

  /// The one to show for [locale] on a page of [brightness]
  TenantWordmark? resolve(Locale locale, Brightness brightness) {
    final arabic = locale.languageCode == 'ar';
    final dark = brightness == Brightness.dark;
    final order = arabic
        ? (dark ? [arDark, ar, enDark, en] : [ar, en])
        : (dark ? [enDark, en] : [en]);
    for (final candidate in order) {
      if (candidate != null) return candidate;
    }
    return null;
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TenantWordmarks && other.en == en && other.enDark == enDark && other.ar == ar && other.arDark == arDark;

  @override
  int get hashCode => Object.hash(en, enDark, ar, arDark);
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

/// The tenant's theme tokens on top of the neutral palette. Every field is
/// optional; null keeps the platform default.
class TenantTheme {
  static const radii = {'none', 'sm', 'md', 'lg', 'xl'};

  /// `#rrggbb`: the secondary pair
  final String? accentHex;

  /// `#rrggbb`: the light scheme's page
  final String? backgroundHex;

  /// `#rrggbb`: the light scheme's text
  final String? foregroundHex;

  /// One of [radii]
  final String? radius;

  /// A Google Fonts family name, for Latin text
  final String? font;

  const TenantTheme({this.accentHex, this.backgroundHex, this.foregroundHex, this.radius, this.font});

  static const neutral = TenantTheme();

  factory TenantTheme.fromJson(Map<String, dynamic> json) {
    final radius = (json['radius'] as String?)?.trim().toLowerCase();
    final font = (json['font'] as String?)?.trim();
    return TenantTheme(
      accentHex: _hex(json['accent'] as String?),
      backgroundHex: _hex(json['background'] as String?),
      foregroundHex: _hex(json['foreground'] as String?),
      radius: radius != null && radii.contains(radius) ? radius : null,
      font: font == null || font.isEmpty ? null : font,
    );
  }

  static TenantTheme parse(Object? json) => json is Map<String, dynamic> ? TenantTheme.fromJson(json) : neutral;

  Map<String, dynamic> toJson() => {
        'accent': accentHex,
        'background': backgroundHex,
        'foreground': foregroundHex,
        'radius': radius,
        'font': font,
      };

  Color? get accent => _color(accentHex);
  Color? get background => _color(backgroundHex);
  Color? get foreground => _color(foregroundHex);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TenantTheme &&
          other.accentHex == accentHex &&
          other.backgroundHex == backgroundHex &&
          other.foregroundHex == foregroundHex &&
          other.radius == radius &&
          other.font == font;

  @override
  int get hashCode => Object.hash(accentHex, backgroundHex, foregroundHex, radius, font);
}

/// The tenant this build runs for: name, brand color, logo, wordmark, theme
/// tokens, locale and the feature switches (`GET /api/tenant`). Cached
/// between runs, so the app paints the right brand before the network answers.
class TenantBrand {
  final LocalizedText name;

  /// `#rrggbb`, or null when the tenant keeps the neutral palette
  final String? primaryColorHex;

  /// Absolute URL of the uploaded mark, or null when there is none
  final String? logoUrl;

  /// The mark for dark pages, or null to use [logoUrl]
  final String? logoDarkUrl;

  /// The wide logos; the mark and the name stand in for a missing one
  final TenantWordmarks wordmarks;
  final TenantTheme theme;
  final TenantLocale locale;
  final TenantFeatures features;
  final int version;

  const TenantBrand({
    required this.name,
    this.primaryColorHex,
    this.logoUrl,
    this.logoDarkUrl,
    this.wordmarks = TenantWordmarks.none,
    this.theme = TenantTheme.neutral,
    this.locale = TenantLocale.egypt,
    this.features = TenantFeatures.all,
    this.version = 0,
  });

  /// What shows until anything is known: a neutral name, no color, no logo,
  /// every feature on
  static const neutral = TenantBrand(name: LocalizedText(en: 'Ninja'));

  /// The API's shape; relative URLs are relative to [baseUrl]
  factory TenantBrand.fromApi(Map<String, dynamic> json, {required String baseUrl}) {
    final logo = json['logoUrl'] as String?;
    final logoDark = json['logoDarkUrl'] as String?;
    return TenantBrand(
      name: LocalizedText.parse(json['name']),
      primaryColorHex: _hex(json['primaryColor'] as String?),
      logoUrl: logo == null ? null : _absolute(logo, baseUrl),
      logoDarkUrl: logoDark == null ? null : _absolute(logoDark, baseUrl),
      wordmarks: TenantWordmarks.parse(json['wordmarks'], baseUrl: baseUrl),
      theme: TenantTheme.parse(json['theme']),
      locale: TenantLocale.parse(json['locale']),
      features: json['features'] is Map<String, dynamic>
          ? TenantFeatures.fromJson(json['features'] as Map<String, dynamic>)
          : TenantFeatures.all,
      version: (json['version'] as num?)?.toInt() ?? 0,
    );
  }

  /// The cached shape (what [toJson] wrote); a cache from an older build
  /// simply lacks the newer keys
  factory TenantBrand.fromJson(Map<String, dynamic> json) => TenantBrand(
        name: LocalizedText.parse(json['name']),
        primaryColorHex: _hex(json['primaryColor'] as String?),
        logoUrl: json['logoUrl'] as String?,
        logoDarkUrl: json['logoDarkUrl'] as String?,
        wordmarks: TenantWordmarks.parse(json['wordmarks']),
        theme: TenantTheme.parse(json['theme']),
        locale: TenantLocale.parse(json['locale']),
        features: json['features'] is Map<String, dynamic>
            ? TenantFeatures.fromJson(json['features'] as Map<String, dynamic>)
            : TenantFeatures.all,
        version: (json['version'] as num?)?.toInt() ?? 0,
      );

  Map<String, dynamic> toJson() => {
        'name': name.toJson(),
        'primaryColor': primaryColorHex,
        'logoUrl': logoUrl,
        'logoDarkUrl': logoDarkUrl,
        'wordmarks': wordmarks.toJson(),
        'theme': theme.toJson(),
        'locale': locale.toJson(),
        'features': features.toJson(),
        'version': version,
      };

  Color? get primaryColor => _color(primaryColorHex);

  /// The mark for a page of [brightness]; the dark one falls back to the light one
  String? logoFor(Brightness brightness) => (brightness == Brightness.dark ? logoDarkUrl : null) ?? logoUrl;

  /// The wide logo for [locale] on a page of [brightness], or null
  TenantWordmark? wordmarkFor(Locale locale, Brightness brightness) => wordmarks.resolve(locale, brightness);

  String displayName(Locale locale) => name.getText(locale);

  /// The first letter of the name, for the tile that stands in for a logo
  String initial(Locale locale) {
    final text = displayName(locale).trim();
    return text.isEmpty ? '' : text.substring(0, 1).toUpperCase();
  }

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TenantBrand &&
          other.name == name &&
          other.primaryColorHex == primaryColorHex &&
          other.logoUrl == logoUrl &&
          other.logoDarkUrl == logoDarkUrl &&
          other.wordmarks == wordmarks &&
          other.theme == theme &&
          other.locale == locale &&
          other.features == features &&
          other.version == version;

  @override
  int get hashCode => Object.hash(name, primaryColorHex, logoUrl, logoDarkUrl, wordmarks, theme, locale, features, version);
}

String _absolute(String url, String? baseUrl) => url.startsWith('http') || baseUrl == null ? url : '$baseUrl$url';

String? _hex(String? value) {
  if (value == null) return null;
  final v = value.trim().toLowerCase();
  return RegExp(r'^#[0-9a-f]{6}$').hasMatch(v) ? v : null;
}

Color? _color(String? hex) => hex == null ? null : Color(0xFF000000 | int.parse(hex.substring(1), radix: 16));
