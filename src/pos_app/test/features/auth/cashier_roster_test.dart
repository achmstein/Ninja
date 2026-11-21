import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/core/auth/cashier_sign_in.dart';
import 'package:pos_app/features/auth/cashier_roster.dart';

void main() {
  final staff = <dynamic>[
    {'username': 'mona@cafe.com', 'firstName': 'Mona', 'lastName': 'Adel', 'realmRoles': ['Cashier'], 'branches': [1]},
    {'username': 'ali@cafe.com', 'firstName': 'Ali', 'realmRoles': ['Cashier'], 'branches': [2]},
    {'username': 'owner@cafe.com', 'firstName': 'Omar', 'realmRoles': ['Owner', 'Admin'], 'branches': <int>[]},
    {'username': 'calls@cafe.com', 'firstName': '', 'lastName': 'Call centre', 'realmRoles': ['Cashier'], 'allBranches': true},
    {'username': '', 'email': '', 'firstName': 'Nobody', 'realmRoles': ['Cashier'], 'branches': [1]},
  ];

  test('lists who works at the branch, the owner and every-branch accounts with them, by whole name', () {
    final roster = cashiersOf(staff, 1);
    expect(roster.map((c) => c.name), ['Call centre', 'Mona Adel', 'Omar']);
    expect(roster.map((c) => c.username), ['calls@cafe.com', 'mona@cafe.com', 'owner@cafe.com']);
  });

  test('a roster survives being stored and read back', () {
    const cashier = Cashier(username: 'mona@cafe.com', name: 'Mona Adel');
    final back = Cashier.fromJson(cashier.toJson());
    expect(back?.username, 'mona@cafe.com');
    expect(back?.name, 'Mona Adel');
    expect(Cashier.fromJson('nonsense'), isNull);
  });

  test('the till is only handed to the name that was tapped', () {
    expect(isSameAccount('Mona@Cafe.com', 'mona@cafe.com'), isTrue);
    expect(isSameAccount('mona@cafe.com', 'ali@cafe.com'), isFalse);
    expect(isSameAccount('mona@cafe.com', null), isFalse);
  });
}
