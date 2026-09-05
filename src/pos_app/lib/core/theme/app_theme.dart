import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Get font family based on locale — the pair pos_web loads: Inter, and
/// Cairo for Arabic.
String getFontFamily(Locale locale) {
  return locale.languageCode == 'ar' ? 'Cairo' : 'Inter';
}

/// Extension to get font family from context
extension LocaleFontExtension on BuildContext {
  /// Get the font family for the current locale
  String get fontFamily {
    final locale = Localizations.localeOf(this);
    return getFontFamily(locale);
  }
}

/// Theme mode enum
enum AppThemeMode { light, dark, system }

/// Theme state
class ThemeState {
  final AppThemeMode themeMode;
  final bool isLoading;

  const ThemeState({
    this.themeMode = AppThemeMode.system,
    this.isLoading = true,
  });

  ThemeState copyWith({AppThemeMode? themeMode, bool? isLoading}) {
    return ThemeState(
      themeMode: themeMode ?? this.themeMode,
      isLoading: isLoading ?? this.isLoading,
    );
  }

  Brightness resolveBrightness(BuildContext context) {
    switch (themeMode) {
      case AppThemeMode.light:
        return Brightness.light;
      case AppThemeMode.dark:
        return Brightness.dark;
      case AppThemeMode.system:
        return MediaQuery.platformBrightnessOf(context);
    }
  }

  /// Get Forui theme with locale-aware typography
  FThemeData getForuiTheme(BuildContext context, {Locale? locale}) {
    final brightness = resolveBrightness(context);

    // pos_web is built on shadcn's slate palette (styles/theme.css)
    final colors = brightness == Brightness.dark
        ? FThemes.slate.dark.colors
        : FThemes.slate.light.colors;

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

  /// Get Material ThemeMode
  ThemeMode get materialThemeMode {
    switch (themeMode) {
      case AppThemeMode.light:
        return ThemeMode.light;
      case AppThemeMode.dark:
        return ThemeMode.dark;
      case AppThemeMode.system:
        return ThemeMode.system;
    }
  }
}

/// Theme notifier with persistence
class ThemeNotifier extends Notifier<ThemeState> {
  static const _themeKey = 'pos_app_theme_mode';

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

  void toggleTheme() {
    final newMode = state.themeMode == AppThemeMode.dark
        ? AppThemeMode.light
        : AppThemeMode.dark;
    setThemeMode(newMode);
  }
}

/// Theme provider
final themeProvider = NotifierProvider<ThemeNotifier, ThemeState>(() {
  return ThemeNotifier();
});

/// Semantic colors — the Tailwind stops pos_web uses for state. Each has a
/// light and a dark reading, like `text-amber-600 dark:text-amber-500`.
class AppColors {
  static const Color successColor = Color(0xFF16A34A); // green-600
  static const Color errorColor = Color(0xFFDC2626); // red-600
  static const Color warningColor = Color(0xFFCA8A04); // yellow-600

  static const Color amber600 = Color(0xFFD97706);
  static const Color amber500 = Color(0xFFF59E0B);
  static const Color emerald600 = Color(0xFF059669);
  static const Color emerald500 = Color(0xFF10B981);
  static const Color red500 = Color(0xFFEF4444);
  static const Color gray400 = Color(0xFF9CA3AF);

  static Color amber(Brightness b) => b == Brightness.dark ? amber500 : amber600;
  static Color emerald(Brightness b) => b == Brightness.dark ? emerald500 : emerald600;
}
