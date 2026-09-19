import 'dart:ui' show Locale;
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../brand/brand_provider.dart';
import '../providers/locale_provider.dart';

/// What the money is called on a price tag, in each language; a currency
/// this list lacks shows its ISO code in both.
const Map<String, ({String en, String ar})> currencyLabels = {
  'EGP': (en: 'EGP', ar: 'ج.م'),
  'SAR': (en: 'SAR', ar: 'ر.س'),
  'AED': (en: 'AED', ar: 'د.إ'),
  'KWD': (en: 'KWD', ar: 'د.ك'),
  'QAR': (en: 'QAR', ar: 'ر.ق'),
  'BHD': (en: 'BHD', ar: 'د.ب'),
  'OMR': (en: 'OMR', ar: 'ر.ع'),
  'JOD': (en: 'JOD', ar: 'د.أ'),
  'LBP': (en: 'LBP', ar: 'ل.ل'),
  'IQD': (en: 'IQD', ar: 'د.ع'),
  'MAD': (en: 'MAD', ar: 'د.م'),
  'TND': (en: 'TND', ar: 'د.ت'),
  'DZD': (en: 'DZD', ar: 'د.ج'),
  'LYD': (en: 'LYD', ar: 'د.ل'),
  'SDG': (en: 'SDG', ar: 'ج.س'),
  'TRY': (en: 'TRY', ar: '₺'),
  'GBP': (en: 'GBP', ar: '£'),
  'EUR': (en: 'EUR', ar: '€'),
  'USD': (en: 'USD', ar: r'$'),
  'CAD': (en: 'CAD', ar: r'C$'),
};

/// Prices the way the whole product prints them: two decimals and the
/// tenant's currency, labelled in the reader's language: `12.50 EGP` /
/// `12.50 ج.م`.
class MoneyFormat {
  /// ISO 4217
  final String currency;
  final Locale locale;

  const MoneyFormat(this.currency, this.locale);

  /// The currency's label in [locale]'s language
  String get label {
    final labels = currencyLabels[currency];
    if (labels == null) return currency;
    return locale.languageCode == 'ar' ? labels.ar : labels.en;
  }

  /// `12.50 EGP`
  String call(num value) => '${value.toStringAsFixed(2)} $label';

  /// `12 EGP`: a rate, a tariff, anything quoted without its piastres
  String whole(num value) => '${value.toStringAsFixed(0)} $label';

  /// `-12.50 EGP`
  String discount(num value) => '-${call(value)}';
}

/// The tenant's currency in the app's language; every price goes through it
final moneyProvider = Provider<MoneyFormat>((ref) {
  return MoneyFormat(ref.watch(brandProvider.select((b) => b.locale.currency)), ref.watch(localeProvider));
});
