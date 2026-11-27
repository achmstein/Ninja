import 'dart:convert';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../core/network/api_client.dart';
import '../sale/models/sale_line.dart';

const _key = 'pos.recentCustomers';
const _max = 5;

/// Whoever the branch last rang something up for, the latest first, by their account's id: read
/// from the branch's bills by Sales, so every till of the branch offers the same people. Throws
/// when the server cannot be asked (offline, or a business not on that release yet); the
/// customers picked on this tablet stand in then
final branchRecentCustomersProvider = Provider<Future<List<String>> Function()>((ref) {
  return () async {
    final response = await ref.read(salesApiProvider).get<List<dynamic>>('tickets/recent-customers');
    return [
      for (final entry in response.data ?? const <dynamic>[])
        if (entry is Map && entry['customerId'] is String && (entry['customerId'] as String).isNotEmpty)
          entry['customerId'] as String,
    ];
  };
});

/// The customers picked on this tablet lately, newest first: only what stands in for the
/// branch's own list while the server cannot be asked
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
