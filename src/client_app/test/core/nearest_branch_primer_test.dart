import 'package:flutter_test/flutter_test.dart';
import 'package:geolocator/geolocator.dart';
import 'package:ninja_client/core/widgets/nearest_branch_primer.dart';

void main() {
  final now = DateTime(2026, 10, 6, 12);
  bool wanted({
    int branches = 2,
    bool atBranch = false,
    bool located = false,
    LocationPermission? permission = LocationPermission.denied,
    DateTime? snoozedAt,
  }) =>
      nearestBranchPrimerWanted(
        placedBranches: branches,
        atBranch: atBranch,
        located: located,
        permission: permission,
        snoozedAt: snoozedAt,
        now: now,
      );

  test('asks a customer the phone would still ask, at a business with branches in more than one place', () {
    expect(wanted(), isTrue);
  });

  test('never where there is nothing to choose, the customer is at a branch, or the position is known', () {
    expect(wanted(branches: 1), isFalse);
    expect(wanted(atBranch: true), isFalse);
    expect(wanted(located: true), isFalse);
  });

  test('never where the phone would not ask: already given, or refused for good', () {
    expect(wanted(permission: LocationPermission.whileInUse), isFalse);
    expect(wanted(permission: LocationPermission.always), isFalse);
    expect(wanted(permission: LocationPermission.deniedForever), isFalse);
    expect(wanted(permission: null), isFalse);
  });

  test('a "Not now" holds for a fortnight', () {
    expect(wanted(snoozedAt: now.subtract(const Duration(days: 3))), isFalse);
    expect(wanted(snoozedAt: now.subtract(const Duration(days: 14))), isTrue);
  });
}
