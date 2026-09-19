import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../brand/brand_theme.dart';

enum AppThemeMode { light, dark, system }

/// Returns the appropriate font family based on locale
String getFontFamily(Locale locale) {
  return locale.languageCode == 'ar' ? 'NotoSansArabic' : 'Inter';
}

/// Extension on BuildContext for easy access to locale-aware font
extension LocaleFontExtension on BuildContext {
  /// Get the font family for the current locale
  String get fontFamily {
    final locale = Localizations.localeOf(this);
    return getFontFamily(locale);
  }
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

  /// [brandColor] is the tenant's primary; the rest of the palette stays zinc
  FThemeData getForuiTheme(BuildContext context, {Locale? locale, Color? brandColor}) {
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

    // Base colors from the zinc theme, the brand's primary on top
    final colors = brandedColors(
      brightness == Brightness.dark ? FThemes.zinc.dark.colors : FThemes.zinc.light.colors,
      brandColor,
    );

    // Get font family based on locale
    final fontFamily = locale != null ? getFontFamily(locale) : 'Inter';

    // Create typography with the correct font family
    // This ensures all text styles use the locale-appropriate font
    final typography = FTypography.inherit(
      colors: colors,
      defaultFontFamily: fontFamily,
    );

    // Create style that inherits from colors and typography
    final style = FStyle.inherit(
      colors: colors,
      typography: typography,
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
