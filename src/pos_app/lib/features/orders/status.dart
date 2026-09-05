import 'package:flutter/widgets.dart';
import '../../core/models/dates.dart';
import '../../l10n/app_localizations.dart';

/// "Just now", "3 min ago", "2 h ago", then the date
String relativeTime(BuildContext context, AppLocalizations l10n, DateTime value, DateTime now) {
  final minutes = (now.difference(value).inSeconds / 60).round();
  if (minutes < 1) return l10n.justNow;
  if (minutes < 60) return l10n.minutesAgo(minutes);
  final hours = (minutes / 60).round();
  return hours < 24 ? l10n.hoursAgo(hours) : formatDateTimeShort(context, value);
}

// KDS-style aging, the same tiers as the admin board and matched to the
// backend reminder escalation (drinks move fast here): amber after 2
// minutes, red once it's the 3-minute order the reminders are already
// ringing about
const warnAfterMinutes = 2;
const delayedAfterMinutes = 3;

enum OrderUrgency { fresh, warning, delayed }

OrderUrgency orderUrgency(DateTime value, DateTime now) {
  final minutes = now.difference(value).inSeconds / 60;
  if (minutes >= delayedAfterMinutes) return OrderUrgency.delayed;
  if (minutes >= warnAfterMinutes) return OrderUrgency.warning;
  return OrderUrgency.fresh;
}
