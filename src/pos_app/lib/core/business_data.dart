import 'dart:convert';

import 'package:shared_preferences/shared_preferences.dart';

/// What the till keeps on the tablet that belongs to the business it is
/// connected to, as opposed to the tablet itself (its printers, kiosk mode,
/// how it is held, its device id: those stay whatever business it serves).
/// A tablet moved to another business must not carry any of it across: the
/// last business's cashiers on the sign-in screen, its menu and prices
/// offline, a sale half rung up.

/// Sales rung up offline and charges still on their way to the server: money
/// the business has not been told of yet
const _unsentKeys = ['pos.offline.sales', 'pos.sending'];

/// Forgotten outright
const _businessKeys = ['pos_cashier_roster', 'ninja-pos-sale', 'ninja-pos-call-centre', 'pos.offline.next'];

/// Forgotten by prefix: kept per branch
const _businessPrefixes = ['pos.catalog.', 'pos.pricing.'];

/// How many sales and charges this tablet still owes the business it is
/// connected to. While there are any, the tablet stays with that business:
/// moving on would lose them, or worse, send them to the next one.
Future<int> unsentToBusiness() async {
  final prefs = await SharedPreferences.getInstance();
  var count = 0;
  for (final key in _unsentKeys) {
    try {
      final parsed = jsonDecode(prefs.getString(key) ?? '[]');
      if (parsed is List) count += parsed.length;
    } catch (_) {
      // Unreadable is not empty: something is there
      count += 1;
    }
  }
  return count;
}

/// Forget the business's own data on this tablet. Called when the tablet is
/// moved to another business, after [unsentToBusiness] said there is nothing owed.
Future<void> forgetBusinessData() async {
  final prefs = await SharedPreferences.getInstance();
  for (final key in [..._businessKeys, ..._unsentKeys]) {
    await prefs.remove(key);
  }
  for (final key in prefs.getKeys().toList()) {
    if (_businessPrefixes.any(key.startsWith)) await prefs.remove(key);
  }
}
