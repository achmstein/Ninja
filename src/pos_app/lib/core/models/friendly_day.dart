import 'package:flutter/widgets.dart';
import 'package:intl/intl.dart' show DateFormat;
import '../../l10n/app_localizations.dart';

/// A moment as the till says it to a cashier: the day in words (Today,
/// Yesterday, otherwise the weekday and the date) and the time on its own
/// (`formatTime`). A list of the night's receipts is read by its times; the
/// date on every row said the same thing fifty times. pos_web's
/// `friendly-day.ts` is the same.

/// One calendar day, in the device's own time: what two moments of the same day share
int dayKey(DateTime value) {
  final local = value.toLocal();
  return local.year * 10000 + local.month * 100 + local.day;
}

String friendlyDay(BuildContext context, DateTime value, {DateTime? now}) {
  final l10n = AppLocalizations.of(context)!;
  final date = value.toLocal();
  final today = (now ?? DateTime.now()).toLocal();
  if (dayKey(date) == dayKey(today)) return l10n.today;
  if (dayKey(date) == dayKey(DateTime(today.year, today.month, today.day - 1))) return l10n.yesterday;
  final locale = Localizations.localeOf(context).toString();
  // The year only once it is not this one
  return (date.year == today.year ? DateFormat.MMMMEEEEd(locale) : DateFormat.yMMMMEEEEd(locale)).format(date);
}
