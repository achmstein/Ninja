import 'package:flutter/widgets.dart';

/// What the money is called, in each language; a currency this list lacks shows its ISO code
const Map<String, ({String en, String ar})> _labels = {
  'EGP': (en: 'EGP', ar: 'ج.م'),
  'SAR': (en: 'SAR', ar: 'ر.س'),
  'AED': (en: 'AED', ar: 'د.إ'),
  'KWD': (en: 'KWD', ar: 'د.ك'),
  'QAR': (en: 'QAR', ar: 'ر.ق'),
  'BHD': (en: 'BHD', ar: 'د.ب'),
  'OMR': (en: 'OMR', ar: 'ر.ع'),
  'JOD': (en: 'JOD', ar: 'د.أ'),
  'USD': (en: 'USD', ar: r'$'),
  'EUR': (en: 'EUR', ar: '€'),
  'GBP': (en: 'GBP', ar: '£'),
};

/// Left-to-right isolate and its pop: the figure keeps its order inside Arabic text
final _isolate = String.fromCharCode(0x2066);
final _pop = String.fromCharCode(0x2069);

/// The product's one money shape: two decimals grouped in thousands, western
/// figures, and the currency in the reader's language: `1,250.00 EGP` / `1,250.00 ج.م`.
String formatMoney(double amount, String currency, Locale locale) {
  final fixed = amount.abs().toStringAsFixed(2);
  final whole = fixed.substring(0, fixed.length - 3).replaceAllMapped(RegExp(r'\B(?=(\d{3})+(?!\d))'), (_) => ',');
  final figure = '${amount < 0 ? '−' : ''}$whole${fixed.substring(fixed.length - 3)}';
  final label = _labels[currency];
  final name = label == null ? currency : (locale.languageCode == 'ar' ? label.ar : label.en);
  // Held left to right, so in an Arabic line the minus stays before the figure
  return '$_isolate$figure$_pop $name';
}
