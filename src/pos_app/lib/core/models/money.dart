import 'package:flutter/widgets.dart';
import '../../l10n/app_localizations.dart';

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

/// Same money shape the whole product uses: `12.50 EGP` / `12.50 ج.م`.
String money(BuildContext context, Object? value) => moneyWith(AppLocalizations.of(context)!, value);

/// The same, for widgets painted outside the app tree (the receipt)
String moneyWith(AppLocalizations l10n, Object? value) => '${toNumber(value).toStringAsFixed(2)} ${l10n.currency}';

/// A rate as percentage digits with no trailing noise: 0.14 → `14`,
/// 0.125 → `12.5`. The ARB strings that show a rate add the sign themselves.
String rateText(Object? rate) {
  final value = toNumber(rate) * 100;
  return value == value.roundToDouble() ? value.toStringAsFixed(0) : value.toStringAsFixed(1);
}

/// A rate as a percentage: 0.14 → `14%`.
String percent(Object? rate) => '${rateText(rate)}%';
