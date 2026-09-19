import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../brand/brand_provider.dart';
import '../providers/locale_provider.dart';

/// Generated API number fields arrive as `number | string` (the backend
/// serializes decimals loosely), so every money helper accepts both.
double toNumber(Object? value) {
  if (value == null) return 0;
  if (value is num) return value.toDouble();
  return double.tryParse(value.toString()) ?? 0;
}

int toInt(Object? value) {
  if (value == null) return 0;
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value.toString()) ?? 0;
}

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

/// Same money shape the whole product uses: two decimals and the tenant's
/// currency, labelled in the reader's language: `12.50 EGP` / `12.50 ج.م`.
class MoneyFormat {
  /// ISO 4217
  final String currency;
  final Locale locale;

  const MoneyFormat(this.currency, this.locale);

  /// The tenant's currency in the page's language, from anywhere under the app
  factory MoneyFormat.of(BuildContext context) =>
      MoneyFormat(ProviderScope.containerOf(context).read(brandProvider).locale.currency, Localizations.localeOf(context));

  /// The currency's label in [locale]'s language: what an amount field is headed with
  String get label {
    final labels = currencyLabels[currency];
    if (labels == null) return currency;
    return locale.languageCode == 'ar' ? labels.ar : labels.en;
  }

  String call(Object? value) => '${toNumber(value).toStringAsFixed(2)} $label';
}

/// The tenant's currency in the app's language, for a widget that watches
final moneyProvider = Provider<MoneyFormat>((ref) {
  return MoneyFormat(ref.watch(brandProvider.select((b) => b.locale.currency)), ref.watch(localeProvider));
});

/// A price as the page prints it; the sheets painted off screen carry their own [MoneyFormat]
String money(BuildContext context, Object? value) => MoneyFormat.of(context)(value);

/// A rate as percentage digits with no trailing noise: 0.14 → `14`,
/// 0.125 → `12.5`. The ARB strings that show a rate add the sign themselves.
String rateText(Object? rate) {
  final value = toNumber(rate) * 100;
  return value == value.roundToDouble() ? value.toStringAsFixed(0) : value.toStringAsFixed(1);
}

/// A rate as a percentage: 0.14 → `14%`.
String percent(Object? rate) => '${rateText(rate)}%';
