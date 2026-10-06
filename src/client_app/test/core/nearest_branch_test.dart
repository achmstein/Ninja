import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/models/branch.dart';
import 'package:ninja_client/core/models/localized_text.dart';
import 'package:ninja_client/core/providers/branch_switch.dart';
import 'package:ninja_client/core/services/location_service.dart';

Branch _branch(int id, {int order = 0, double? lat, double? lng, bool active = true, bool ordering = true}) => Branch(
      id: id,
      name: LocalizedText(en: 'B$id'),
      displayOrder: order,
      latitude: lat,
      longitude: lng,
      isActive: active,
      isOrderingEnabled: ordering,
    );

void main() {
  test('a distance reads as people say it', () {
    expect(distanceParts(3), (value: '10', km: false));
    expect(distanceParts(784), (value: '780', km: false));
    expect(distanceParts(1240), (value: '1.2', km: true));
    expect(distanceParts(2000), (value: '2', km: true));
    expect(distanceParts(14400), (value: '14', km: true));
  });

  test('metres between two points: Tahrir to Maadi is about ten kilometres', () {
    final meters = distanceMeters((lat: 30.0444, lng: 31.2357), (lat: 29.9602, lng: 31.2569));
    expect(meters, inInclusiveRange(9000, 10500));
  });

  test('without a position: the branch used last, then the owner\'s order', () {
    final sorted = branchesByDistance([_branch(1, order: 0), _branch(2, order: 1), _branch(3, order: 2)], 3, null);
    expect(sorted.map((s) => s.item.id), [3, 1, 2]);
    expect(sorted.every((s) => s.meters == null), isTrue);
  });

  test('with a position: closest first, a branch with no point after those with one', () {
    const here = (lat: 30.0444, lng: 31.2357);
    final sorted = branchesByDistance([
      _branch(1, order: 0, lat: 29.9602, lng: 31.2569), // Maadi, ~10 km
      _branch(2, order: 1), // no point
      _branch(3, order: 2, lat: 30.0626, lng: 31.2197), // Zamalek, ~2.5 km
    ], 1, here);
    expect(sorted.map((s) => s.item.id), [3, 1, 2]);
    expect(sorted.last.meters, isNull);
  });

  test('a branch reads open, open but not taking orders, or closed', () {
    expect(branchOpenState(_branch(1)), BranchOpenState.open);
    expect(branchOpenState(_branch(1, ordering: false)), BranchOpenState.notOrdering);
    expect(branchOpenState(_branch(1, active: false)), BranchOpenState.closed);
  });

  test('the branch\'s point and delivery terms are read from the API', () {
    final b = Branch.fromJson({
      'id': 4,
      'name': {'en': 'Maadi'},
      'displayOrder': 0,
      'latitude': 29.96,
      'longitude': '31.25',
      'isDeliveryEnabled': true,
      'deliveryFee': 25,
      'deliveryRadiusKm': 5.5,
    });
    expect(b.point, (lat: 29.96, lng: 31.25));
    expect(b.isDeliveryEnabled, isTrue);
    expect(b.deliveryFee, 25);
    expect(b.deliveryRadiusKm, 5.5);
    expect(Branch.fromJson({'id': 5, 'name': {'en': 'X'}}).point, isNull);
  });
}
