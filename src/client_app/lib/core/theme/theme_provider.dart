import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../brand/brand_theme.dart';
import '../brand/tenant_brand.dart';

enum AppThemeMode { light, dark, system }

/// The bundled family for [locale]: Arabic always sets in NotoSansArabic;
/// Latin in Inter unless the tenant chose a font (see [localeTextStyle])
String getFontFamily(Locale locale) {
  return locale.languageCode == 'ar' ? 'NotoSansArabic' : 'Inter';
}

/// Whether the tenant's Latin font applies to text in [locale]
bool usesBrandFont(Locale locale, String? brandFont) => brandFont != null && locale.languageCode != 'ar';

/// [style] in the app's face for [locale]: the tenant's family when it set
/// one and the text is Latin, weight resolved by google_fonts; otherwise the
/// bundled family
TextStyle localeTextStyle(Locale locale, TextStyle style, {String? brandFont}) {
  if (usesBrandFont(locale, brandFont)) return GoogleFonts.getFont(brandFont!, textStyle: style);
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

  /// The zinc theme with the tenant's tokens on top: its primary and accent,
  /// its light background and foreground, its corner radius and, for Latin
  /// text, its font. Whatever [brand] leaves unset stays zinc.
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

    // Typography in the locale's bundled family, then the tenant's font over
    // the Latin one when it chose a family google_fonts knows
    final brandFont = brandFontFamily(brand.theme.font);
    var typography = FTypography.inherit(
      colors: colors,
      defaultFontFamily: locale != null ? getFontFamily(locale) : 'Inter',
    );
    if (usesBrandFont(locale ?? const Locale('en'), brandFont)) {
      typography = brandedTypography(typography, brandFont!);
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

  @override
  ThemeState build() {
    _loadTheme();
    return const ThemeState();
  }

  Future<void> _loadTheme() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedTheme = prefs.getString(_themeKey);

      AppThemeMode mode = AppThemeMode.system;
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
