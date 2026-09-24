import 'dart:ui' show Brightness, Color, Locale;
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

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TenantFeatures &&
          other.reservations == reservations &&
          other.timeBilling == timeBilling &&
          other.loyalty == loyalty &&
          other.tabs == tabs &&
          other.inventory == inventory &&
          other.finance == finance &&
          other.payroll == payroll &&
          other.kds == kds;

  @override
  int get hashCode => Object.hash(reservations, timeBilling, loyalty, tabs, inventory, finance, payroll, kds);
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

  /// `standard` or `egyptian`: which Arabic the app speaks
  final String arabicStyle;

  const TenantLocale({
    this.country = 'EG',
    this.currency = 'EGP',
    this.timeZone = 'Africa/Cairo',
    this.language = 'ar',
    this.arabicStyle = 'egyptian',
  });

  /// The app's Arabic: Modern Standard is the `ar_001` locale, Egyptian the plain `ar`
  bool get speaksStandardArabic => arabicStyle == 'standard';

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
      // Older stacks do not say: Egyptian for Egypt, Standard anywhere else
      arabicStyle: read('arabicStyle', read('country', egypt.country).toUpperCase() == 'EG' ? 'egyptian' : 'standard')
          .toLowerCase(),
    );
  }

  Map<String, dynamic> toJson() => {
        'country': country,
        'currency': currency,
        'timeZone': timeZone,
        'language': language,
        'arabicStyle': arabicStyle,
      };

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TenantLocale &&
          other.country == country &&
          other.currency == currency &&
          other.timeZone == timeZone &&
          other.language == language &&
          other.arabicStyle == arabicStyle;

  @override
  int get hashCode => Object.hash(country, currency, timeZone, language, arabicStyle);
}

/// The dark scheme's own seeds, for a brand whose lifted colours do not
/// suit it; null derives everything from the light seeds.
class TenantThemeDark {
  final String? primaryHex;
  final String? accentHex;
  final String? surfaceHex;

  const TenantThemeDark({this.primaryHex, this.accentHex, this.surfaceHex});

  static TenantThemeDark? parse(Object? json) {
    if (json is! Map<String, dynamic>) return null;
    final dark = TenantThemeDark(
      primaryHex: _hex(json['primary'] as String?),
      accentHex: _hex(json['accent'] as String?),
      surfaceHex: _hex(json['surface'] as String?),
    );
    return dark.primaryHex == null && dark.accentHex == null && dark.surfaceHex == null ? null : dark;
  }

  Map<String, dynamic> toJson() => {'primary': primaryHex, 'accent': accentHex, 'surface': surfaceHex};

  Color? get primary => _color(primaryHex);
  Color? get accent => _color(accentHex);
  Color? get surface => _color(surfaceHex);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TenantThemeDark && other.primaryHex == primaryHex && other.accentHex == accentHex && other.surfaceHex == surfaceHex;

  @override
  int get hashCode => Object.hash(primaryHex, accentHex, surfaceHex);
}

/// The seeds of the tenant's design on top of the neutral palette: every
/// field is optional; null keeps the platform default. The colours are
/// derived for both schemes by [brandedColors], the same way the web apps do.
class TenantTheme {
  static const radii = {'none', 'sm', 'md', 'lg', 'xl'};

  /// `#rrggbb`: chips, badges and secondary buttons
  final String? accentHex;

  /// `#rrggbb`: the page, light scheme; its hue tints the neutrals of both schemes
  final String? surfaceHex;

  /// One of [radii]
  final String? radius;

  /// "sm", "md" or "lg": the room the web app's header gives the wordmark. The
  /// app shows its wordmark hero-sized (login, profile) rather than in a
  /// header, so it only carries the seed through the cached document.
  final String? headerSize;

  /// Google Fonts family names, one per script
  final String? fontLatin;
  final String? fontArabic;

  /// The dark scheme's own seeds, when derived ones do not suit the brand
  final TenantThemeDark? dark;

  const TenantTheme({this.accentHex, this.surfaceHex, this.radius, this.headerSize, this.fontLatin, this.fontArabic, this.dark});

  static const headerSizes = ['sm', 'md', 'lg'];

  static const neutral = TenantTheme();

  factory TenantTheme.fromJson(Map<String, dynamic> json) {
    final radius = (json['radius'] as String?)?.trim().toLowerCase();
    final headerSize = (json['headerSize'] as String?)?.trim().toLowerCase();
    String? font(String key) {
      final value = (json[key] as String?)?.trim();
      return value == null || value.isEmpty ? null : value;
    }

    return TenantTheme(
      accentHex: _hex(json['accent'] as String?),
      surfaceHex: _hex(json['surface'] as String?),
      radius: radius != null && radii.contains(radius) ? radius : null,
      headerSize: headerSize != null && headerSizes.contains(headerSize) ? headerSize : null,
      fontLatin: font('fontLatin'),
      fontArabic: font('fontArabic'),
      dark: TenantThemeDark.parse(json['dark']),
    );
  }

  static TenantTheme parse(Object? json) => json is Map<String, dynamic> ? TenantTheme.fromJson(json) : neutral;

  Map<String, dynamic> toJson() => {
        'accent': accentHex,
        'surface': surfaceHex,
        'radius': radius,
        'headerSize': headerSize,
        'fontLatin': fontLatin,
        'fontArabic': fontArabic,
        'dark': dark?.toJson(),
      };

  Color? get accent => _color(accentHex);
  Color? get surface => _color(surfaceHex);

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is TenantTheme &&
          other.accentHex == accentHex &&
          other.surfaceHex == surfaceHex &&
          other.radius == radius &&
          other.fontLatin == fontLatin &&
          other.fontArabic == fontArabic &&
          other.dark == dark;

  @override
  int get hashCode => Object.hash(accentHex, surfaceHex, radius, fontLatin, fontArabic, dark);
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

  /// `light` or `dark` for someone who has not chosen; null follows the device
  final String? defaultThemeMode;
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
    this.defaultThemeMode,
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
      defaultThemeMode: _mode(json['theme'] is Map ? (json['theme'] as Map)['mode'] : null),
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
        'logoDarkUrl': logoDarkUrl,
        'wordmarks': wordmarks.toJson(),
        'theme': theme.toJson(),
        'locale': locale.toJson(),
        'defaultThemeMode': defaultThemeMode,
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

/// `light` or `dark`, anything else follows the device
String? _mode(Object? value) => value == 'light' || value == 'dark' ? value as String : null;
