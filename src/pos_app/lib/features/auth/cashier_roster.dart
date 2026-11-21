import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../core/auth/auth_service.dart';
import '../../core/network/api_client.dart';

/// Who can take over this till: the same list pos_web keeps
/// (features/cashiers/roster.ts). The sign-in screen shows them by name;
/// nobody is signed in by then to ask the server who works here, so the till
/// keeps the names from the last time somebody was: full names and sign-in
/// names of the branch's till staff, nothing else.
class Cashier {
  /// What Keycloak knows them by (their email): the name the till gives it
  final String username;

  /// What the tile says
  final String name;

  const Cashier({required this.username, required this.name});

  Map<String, dynamic> toJson() => {'username': username, 'name': name};

  static Cashier? fromJson(Object? json) {
    if (json is! Map) return null;
    final username = json['username'];
    final name = json['name'];
    return username is String && name is String ? Cashier(username: username, name: name) : null;
  }
}

const String _rosterKey = 'pos_cashier_roster';
const String _tillRoles = 'Admin,Owner,Cashier';

/// The till staff who work at the branch (owners work at every one), by
/// name. The whole name: two Ahmeds work the same till.
List<Cashier> cashiersOf(List<dynamic> staff, int? branchId) {
  final cashiers = <Cashier>[];
  for (final user in staff) {
    if (user is! Map) continue;
    final roles = (user['realmRoles'] as List?)?.cast<Object?>() ?? const [];
    final branches = (user['branches'] as List?)?.map((b) => (b as num).toInt()).toList() ?? const <int>[];
    final here = user['allBranches'] == true || roles.contains('Owner') || (branchId != null && branches.contains(branchId));
    if (!here) continue;
    final username = ((user['username'] ?? user['email'] ?? '') as String).trim();
    if (username.isEmpty) continue;
    final name = [user['firstName'], user['lastName']]
        .map((part) => (part as String? ?? '').trim())
        .where((part) => part.isNotEmpty)
        .join(' ');
    cashiers.add(Cashier(username: username, name: name.isEmpty ? username : name));
  }
  cashiers.sort((a, b) => a.name.toLowerCase().compareTo(b.name.toLowerCase()));
  return cashiers;
}

Future<List<Cashier>> readCashierRoster() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_rosterKey);
    if (raw == null) return const [];
    final parsed = jsonDecode(raw);
    if (parsed is! List) return const [];
    return [
      for (final entry in parsed) ?Cashier.fromJson(entry),
    ];
  } catch (_) {
    return const [];
  }
}

/// The names the sign-in screen offers
final cashierRosterProvider = FutureProvider.autoDispose<List<Cashier>>((ref) => readCashierRoster());

/// Keeps the roster current while somebody is signed in: asked again when
/// the account or the branch changes. Watched by the header, which is there
/// whenever the till is.
final cashierRosterKeeperProvider = FutureProvider<void>((ref) async {
  final signedIn = ref.watch(authServiceProvider.select((s) => s.isAuthenticated ? s.userId : null));
  final branchId = ref.watch(branchProvider.select((s) => s.selectedBranchId));
  if (signedIn == null) return;
  try {
    final response = await ref.read(identityApiProvider).get<List<dynamic>>(
      'users',
      queryParameters: {'role': _tillRoles, 'enabled': true, 'max': 200},
    );
    final roster = cashiersOf(response.data ?? const [], branchId);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_rosterKey, jsonEncode([for (final cashier in roster) cashier.toJson()]));
  } catch (_) {
    // Offline, or the list could not be kept: the names from last time stand
  }
});
