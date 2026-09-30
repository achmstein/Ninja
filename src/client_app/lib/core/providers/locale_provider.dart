import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../brand/brand_provider.dart';

const String _localeKey = 'app_locale';

/// The language the customer picked on the settings page, loaded before the
/// app starts; null until they pick one (only a pick is ever saved)
String? _chosenLanguage;

/// Call this before runApp() to preload the saved choice
Future<void> initializeLocale() async {
  final prefs = await SharedPreferences.getInstance();
  _chosenLanguage = prefs.getString(_localeKey);
}

/// The language the app shows: a one-language business's only language; the
/// customer's own choice; the business's default; Arabic.
String openingLanguage({
  required String contentLanguages,
  required String businessDefault,
  String? chosen,
}) {
  if (contentLanguages == 'ar' || contentLanguages == 'en') return contentLanguages;
  if (chosen == 'ar' || chosen == 'en') return chosen!;
  return businessDefault == 'en' ? 'en' : 'ar';
}

/// Provider for managing the app's locale/language setting
final localeProvider = NotifierProvider<LocaleNotifier, Locale>(() {
  return LocaleNotifier();
});

class LocaleNotifier extends Notifier<Locale> {
  static const List<Locale> supportedLocales = [
    Locale('ar'), // Arabic - default
    Locale('en'), // English
  ];

  @override
  Locale build() {
    // Follows the business's setting as the brand arrives: the cached brand first, the network's after
    final business = ref.watch(brandProvider.select((b) => b.locale));
    return Locale(openingLanguage(
      contentLanguages: business.contentLanguages,
      businessDefault: business.language,
      chosen: _chosenLanguage,
    ));
  }

  Future<void> setLocale(Locale locale) async {
    if (!supportedLocales.contains(locale)) return;

    _chosenLanguage = locale.languageCode;
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
