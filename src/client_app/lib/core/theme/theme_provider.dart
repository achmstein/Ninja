import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../brand/brand_provider.dart';
import '../brand/brand_theme.dart';
import '../brand/tenant_brand.dart';

enum AppThemeMode { light, dark, system }

/// The bundled family for [locale]: Arabic sets in NotoSansArabic and Latin
/// in Inter, unless the tenant chose a font for that script (see [localeTextStyle])
String getFontFamily(Locale locale) {
  return locale.languageCode == 'ar' ? 'NotoSansArabic' : 'Inter';
}

/// [style] in the app's face for [locale]: the tenant's family for the
/// locale's script when it chose one, weight resolved by google_fonts;
/// otherwise the bundled family
TextStyle localeTextStyle(Locale locale, TextStyle style, {String? brandFont}) {
  if (brandFont != null) return GoogleFonts.getFont(brandFont, textStyle: style);
  return style.copyWith(fontFamily: getFontFamily(locale));
}

/// Extension on BuildContext for easy access to locale-aware font
extension LocaleFontExtension on BuildContext {
  /// Get the bundled family for the current locale
  String get fontFamily {
    final locale = Localizations.localeOf(this);
    return getFontFamily(locale);
  }

  /// [style] in the face this text should set in: the tenant's font above
  /// this context, when there is one, else the bundled family
  TextStyle localeText(TextStyle style) =>
      localeTextStyle(Localizations.localeOf(this), style, brandFont: BrandFont.of(this));
}

class ThemeState {
  final AppThemeMode themeMode;
  final bool isLoading;

  const ThemeState({
    this.themeMode = AppThemeMode.system,
    this.isLoading = true,
  });

  ThemeState copyWith({
    AppThemeMode? themeMode,
    bool? isLoading,
  }) {
    return ThemeState(
      themeMode: themeMode ?? this.themeMode,
      isLoading: isLoading ?? this.isLoading,
    );
  }

  /// The zinc theme with the tenant's seeds on top: its colours derived for
  /// this brightness, its corner radius and its font for the locale's script.
  /// Whatever [brand] leaves unset stays zinc.
  FThemeData getForuiTheme(BuildContext context, {Locale? locale, TenantBrand brand = TenantBrand.neutral}) {
    final Brightness brightness;
    switch (themeMode) {
      case AppThemeMode.light:
        brightness = Brightness.light;
        break;
      case AppThemeMode.dark:
        brightness = Brightness.dark;
        break;
      case AppThemeMode.system:
        brightness = MediaQuery.platformBrightnessOf(context);
        break;
    }

    // Base colors from the zinc theme, the brand's on top
    final colors = brandedColors(
      brightness == Brightness.dark ? FThemes.zinc.dark.colors : FThemes.zinc.light.colors,
      brand,
    );

    // Typography in the locale's bundled family, then the tenant's family
    // for that script when it chose one google_fonts knows
    final brandFont = brandFontFor(brand.theme, locale ?? const Locale('en'));
    var typography = FTypography.inherit(
      colors: colors,
      defaultFontFamily: locale != null ? getFontFamily(locale) : 'Inter',
    );
    if (brandFont != null) {
      typography = brandedTypography(typography, brandFont);
    }

    // Style inherits from colors and typography; the tenant's corners on top
    final style = brandedStyle(
      FStyle.inherit(colors: colors, typography: typography),
      brand.theme.radius,
    );

    // Build complete theme - widget styles will inherit from typography
    return FThemeData(
      colors: colors,
      typography: typography,
      style: style,
    );
  }

  String get displayName {
    switch (themeMode) {
      case AppThemeMode.light:
        return 'Light';
      case AppThemeMode.dark:
        return 'Dark';
      case AppThemeMode.system:
        return 'System';
    }
  }
}

class ThemeNotifier extends Notifier<ThemeState> {
  static const _themeKey = 'app_theme_mode';

  /// The person picked light or dark themselves; the café's default no longer applies
  bool _chosen = false;

  @override
  ThemeState build() {
    // Until someone chooses, the app follows the café's starting theme
    ref.listen(brandProvider.select((b) => b.defaultThemeMode), (_, mode) {
      if (!_chosen) state = state.copyWith(themeMode: _cafeDefault(mode));
    });
    _loadTheme();
    return const ThemeState();
  }

  AppThemeMode _cafeDefault(String? mode) => switch (mode) {
        'light' => AppThemeMode.light,
        'dark' => AppThemeMode.dark,
        _ => AppThemeMode.system,
      };

  Future<void> _loadTheme() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedTheme = prefs.getString(_themeKey);

      _chosen = savedTheme != null;
      AppThemeMode mode = _cafeDefault(ref.read(brandProvider).defaultThemeMode);
      if (savedTheme != null) {
        mode = AppThemeMode.values.firstWhere(
          (e) => e.name == savedTheme,
          orElse: () => AppThemeMode.system,
        );
      }

      state = state.copyWith(themeMode: mode, isLoading: false);
    } catch (e) {
      state = state.copyWith(isLoading: false);
    }
  }

  Future<void> setThemeMode(AppThemeMode mode) async {
    _chosen = true;
    state = state.copyWith(themeMode: mode);

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_themeKey, mode.name);
    } catch (e) {
      // Ignore save errors
    }
  }
}

final themeProvider = NotifierProvider<ThemeNotifier, ThemeState>(
  ThemeNotifier.new,
);
