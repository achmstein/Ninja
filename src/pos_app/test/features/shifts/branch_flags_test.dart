import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_app_core/brand/brand_provider.dart';
import 'package:ninja_app_core/brand/tenant_brand.dart';
import 'package:ninja_app_core/models/branch.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import 'package:pos_app/features/places/models/place.dart';
import 'package:pos_app/features/places/providers/places_provider.dart';
import 'package:pos_app/features/shifts/providers/shifts_provider.dart';

/// Taking reservations is a switch only where a branch can be reserved: with
/// no place that takes them, the switch is gone and its being off never
/// turns the trading chip amber.

class _Branch extends BranchNotifier {
  @override
  BranchState build() => BranchState(
        branches: [
          Branch(
            id: 1,
            name: const LocalizedText(en: 'Downtown'),
            isActive: true,
            displayOrder: 0,
            isReservationsEnabled: false,
          ),
        ],
        selectedBranchId: 1,
      );
}

class _Places extends PlacesNotifier {
  final List<Place> places;
  _Places(this.places);

  @override
  PlacesState build() => PlacesState(places: places);
}

Place _place({bool canReserve = true, bool isActive = true}) => Place(
      id: 1,
      name: const LocalizedText(en: 'Room 1'),
      status: PlaceStatus.available,
      canReserve: canReserve,
      isActive: isActive,
    );

BranchFlags _flags(List<Place> places, {bool module = true}) {
  final container = ProviderContainer(
    overrides: [
      branchProvider.overrideWith(_Branch.new),
      placesProvider.overrideWith(() => _Places(places)),
      featuresProvider.overrideWithValue(TenantFeatures(reservations: module)),
    ],
  );
  addTearDown(container.dispose);
  return container.read(branchFlagsProvider);
}

void main() {
  test('a branch with no place that can be reserved has no reservations to pause', () {
    final flags = _flags([_place(canReserve: false)]);
    expect(flags.reservations, isFalse);
    expect(flags.paused, isFalse);
  });

  test('a place that is switched off does not count', () {
    expect(_flags([_place(isActive: false)]).reservations, isFalse);
  });

  test('a reservable place with reservations off reads as paused', () {
    final flags = _flags([_place()]);
    expect(flags.reservations, isTrue);
    expect(flags.paused, isTrue);
  });

  test('without the reservations module nothing is reservable', () {
    expect(_flags([_place()], module: false).reservations, isFalse);
  });
}
