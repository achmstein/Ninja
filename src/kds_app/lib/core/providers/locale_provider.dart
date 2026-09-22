import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const String _localeKey = 'kds_app_locale';

/// Cached initial locale loaded before app starts
Locale? _initialLocale;

/// Call this before runApp() to preload the saved locale. [override] wins
/// over the saved one (the demo's `KDS_DEMO_LOCALE`).
Future<void> initializeLocale({String? override}) async {
  final prefs = await SharedPreferences.getInstance();
  final savedLocale = override?.isNotEmpty == true ? override : prefs.getString(_localeKey);
  _initialLocale = savedLocale != null ? Locale(savedLocale) : const Locale('en');
}

/// The saved locale, for what shows before the providers exist (the
/// connect screen)
Locale get initialLocale => _initialLocale ?? const Locale('en');

/// Keep a language chosen before the providers exist; the app starts in it
Future<void> persistLocale(Locale locale) async {
  _initialLocale = locale;
  final prefs = await SharedPreferences.getInstance();
  await prefs.setString(_localeKey, locale.languageCode);
}

/// Provider for managing the app's locale/language setting. Direction
/// follows the language (no separate setting), as on kds_web.
final localeProvider = NotifierProvider<LocaleNotifier, Locale>(() {
  return LocaleNotifier();
});

class LocaleNotifier extends Notifier<Locale> {
  static const List<Locale> supportedLocales = [
    Locale('en'), // English - default
    Locale('ar'), // Arabic
  ];

  @override
  Locale build() {
    // Use preloaded locale or default to English
    return _initialLocale ?? const Locale('en');
  }

  Future<void> setLocale(Locale locale) async {
    if (!supportedLocales.contains(locale)) return;

    state = locale;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_localeKey, locale.languageCode);
  }

  void toggleLocale() {
    final newLocale = state.languageCode == 'ar'
        ? const Locale('en')
        : const Locale('ar');
    setLocale(newLocale);
  }

  bool get isArabic => state.languageCode == 'ar';
  bool get isEnglish => state.languageCode == 'en';
}
