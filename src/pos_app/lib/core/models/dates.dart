import 'package:flutter/widgets.dart';
import 'package:intl/intl.dart' show DateFormat;

/// `dateStyle: medium, timeStyle: short` in the app's language — what the
/// screens show beside a person's name
String formatDateTime(BuildContext context, DateTime value) =>
    DateFormat.yMMMd(_locale(context)).add_jm().format(value.toLocal());

/// `dateStyle: short, timeStyle: short` — the compact form for lists
String formatDateTimeShort(BuildContext context, DateTime value) =>
    DateFormat.yMd(_locale(context)).add_jm().format(value.toLocal());

/// `timeStyle: short` — the clock alone
String formatTime(BuildContext context, DateTime value) =>
    DateFormat.jm(_locale(context)).format(value.toLocal());

String _locale(BuildContext context) => Localizations.localeOf(context).toString();
