import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
import '../sale/models/sale_line.dart';

const _key = 'pos.recentCustomers';
const _max = 5;

/// The customers picked on this till lately, newest first: most sales are a regular's
Future<List<({String id, String name})>> readRecentCustomers() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final list = jsonDecode(prefs.getString(_key) ?? '[]');
    if (list is! List) return const [];
    return [
      for (final entry in list)
        if (entry is Map && entry['id'] is String && entry['name'] is String)
          if ((entry['id'] as String).isNotEmpty && (entry['name'] as String).isNotEmpty)
            (id: entry['id'] as String, name: entry['name'] as String),
    ];
  } catch (_) {
    return const [];
  }
}

/// Only an account is remembered: a bare name is nobody to find again
Future<void> rememberRecentCustomer(SaleCustomer customer) async {
  final id = customer.id;
  if (id == null || id.isEmpty || customer.name.isEmpty) return;
  try {
    final rest = (await readRecentCustomers()).where((c) => c.id != id);
    final list = [(id: id, name: customer.name), ...rest].take(_max);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_key, jsonEncode([for (final c in list) {'id': c.id, 'name': c.name}]));
  } catch (_) {
    // A tablet that refuses storage only loses the shortcut
  }
}
