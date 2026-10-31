import 'dart:io' show Platform;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../brand/brand_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../brand/brand_provider.dart';
import '../brand/brand_theme.dart';
import '../brand/brand_style.dart';
import 'ninja_theme.dart';
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
  if (brandFont != null) return brandFontStyle(brandFont, style);
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
  TextStyle localeText(TextStyle style) => localeTextStyle(Localizations.localeOf(this), style, brandFont: BrandFont.of(this));
}

class ThemeState {
  final AppThemeMode themeMode;
  final bool isLoading;

  const ThemeState({
    // Until the saved choice and the business's theme are read: what the launch screen
    // showed, which on Android 12+ is the app's last light or dark (see ThemeNotifier._apply)
    this.themeMode = AppThemeMode.system,
    this.isLoading = true,
  });

  ThemeState copyWith({AppThemeMode? themeMode, bool? isLoading}) {
    return ThemeState(themeMode: themeMode ?? this.themeMode, isLoading: isLoading ?? this.isLoading);
  }

  /// The neutral slate theme with the tenant's seeds on top: its colours
  /// derived for [brightness] and its corner radius. Whatever [brand] leaves
  /// unset stays neutral.
  static NinjaTheme themeFor(Brightness brightness, TenantBrand brand) {
    final colors = brandedColors(NinjaColors.of(brightness), brand);
    final style = BrandStyle.fromTheme(brand.theme);
    return NinjaTheme(colors: colors, typography: NinjaTypography.scaled(style.headings.scale), radius: style.radius);
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

  /// The person picked light or dark themselves; the business's default no longer applies
  bool _chosen = false;

  @override
  ThemeState build() {
    // Until someone chooses, the app follows the business's starting theme
    ref.listen(brandProvider.select((b) => b.defaultThemeMode), (_, mode) {
      if (!_chosen) _apply(state.copyWith(themeMode: _businessDefault(mode)));
    });
    _loadTheme();
    return const ThemeState();
  }

  /// The business's starting theme; the phone's own where it has not said, as admin's
  /// "Follow device" means
  AppThemeMode _businessDefault(String? mode) => switch (mode) {
    'light' => AppThemeMode.light,
    'dark' => AppThemeMode.dark,
    _ => AppThemeMode.system,
  };

  static const _platform = MethodChannel('com.chillax.client/theme');

  /// The mode last handed to Android, so it is told only of a change
  AppThemeMode? _told;

  /// The new state, and Android told of its mode: from Android 12 the system draws the
  /// next launch screen in the app's light or dark rather than the phone's
  void _apply(ThemeState next) {
    state = next;
    if (next.isLoading || _told == next.themeMode || !Platform.isAndroid) return;
    _told = next.themeMode;
    _platform.invokeMethod<void>('setNightMode', next.themeMode.name).catchError((_) {});
  }

  Future<void> _loadTheme() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final savedTheme = prefs.getString(_themeKey);

      _chosen = savedTheme != null;
      AppThemeMode mode = _businessDefault(ref.read(brandProvider).defaultThemeMode);
      if (savedTheme != null) {
        mode = AppThemeMode.values.firstWhere(
          (e) => e.name == savedTheme,
          orElse: () => _businessDefault(ref.read(brandProvider).defaultThemeMode),
        );
      }

      _apply(state.copyWith(themeMode: mode, isLoading: false));
    } catch (e) {
      _apply(state.copyWith(isLoading: false));
    }
  }

  Future<void> setThemeMode(AppThemeMode mode) async {
    _chosen = true;
    _apply(state.copyWith(themeMode: mode));

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_themeKey, mode.name);
    } catch (e) {
      // Ignore save errors
    }
  }
}

final themeProvider = NotifierProvider<ThemeNotifier, ThemeState>(ThemeNotifier.new);
