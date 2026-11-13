import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_app_core/auth/auth_service.dart';
import 'package:ninja_app_core/models/branch.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import 'package:ninja_app_core/services/branch_service.dart';
import 'package:pos_app/features/call_centre/call_centre_controller.dart';
import 'package:pos_app/features/call_centre/call_centre_mode.dart';
import 'package:pos_app/features/customers/services/customer_search_service.dart';
import 'package:pos_app/features/deliveries/models/delivery_order.dart';
import 'package:pos_app/features/deliveries/services/delivery_service.dart';
import 'package:pos_app/features/deliveries/widgets/delivery_form_dialog.dart';
import 'package:pos_app/features/sale/models/sale_delivery.dart';
import 'package:pos_app/features/sale/models/sale_line.dart';
import 'package:pos_app/features/sale/providers/sale_provider.dart';
import 'package:pos_app/l10n/app_localizations_ar.dart';
import 'package:pos_app/l10n/app_localizations_en.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _downtown = 1;
const _maadi = 2;
const _zamalek = 3;

/// Ordering's answers for the call centre
class _FakeDeliveries implements DeliveryRepository {
  StaffDeliveryResolution resolution = const StaffDeliveryResolution();
  final List<bool> everyBranchAsked = [];

  @override
  Future<StaffDeliveryResolution> resolveForStaff(String location) async => resolution;

  @override
  Future<List<KnownAddress>> knownAddresses({String? customerUserId, String? phone, bool everyBranch = false}) async {
    everyBranchAsked.add(everyBranch);
    return const [KnownAddress(address: 'Road 9', building: '4', latitude: 29.96, longitude: 31.25)];
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

class _FakeCustomers implements CounterCustomerService {
  @override
  Future<CustomerLookup> lookup({String? phone, String? name}) async => CustomerLookup(
        phone: phone ?? '',
        phoneValid: true,
        match: const IdentityUser(id: 'c1', firstName: 'Mona', lastName: 'Adel', phoneNumber: '01001234567'),
      );

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

class _FakeAuth extends AuthService {
  final AuthState _state;
  _FakeAuth(this._state);

  @override
  AuthState build() => _state;

  @override
  Future<void> initialize() async {}
}

class _FakeBranches implements BranchRepository {
  @override
  Future<List<Branch>> getBranches() async => [
        for (final id in [_downtown, _maadi, _zamalek])
          Branch(id: id, name: LocalizedText(en: 'Branch $id'), isActive: true, displayOrder: id),
      ];

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

const _hotline = AuthState(
  isInitializing: false,
  isAuthenticated: true,
  mayUseApp: true,
  userId: 'agent',
  roles: ['Cashier'],
  allBranches: true,
);

Future<(ProviderContainer, _FakeDeliveries)> _container() async {
  SharedPreferences.setMockInitialValues({});
  await initializeBranch();
  final deliveries = _FakeDeliveries();
  final container = ProviderContainer(overrides: [
    authServiceProvider.overrideWith(() => _FakeAuth(_hotline)),
    branchRepositoryProvider.overrideWithValue(_FakeBranches()),
    deliveryRepositoryProvider.overrideWithValue(deliveries),
    counterCustomerServiceProvider.overrideWithValue(_FakeCustomers()),
  ]);
  addTearDown(container.dispose);
  await container.read(branchProvider.notifier).loadBranches();
  return (container, deliveries);
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('the call centre is offered', () {
    const cashier = AuthState(isInitializing: false, isAuthenticated: true, mayUseApp: true, branches: [1]);

    test('with the module on and every branch held (a star, or an owner)', () {
      expect(callCentreAvailable(featureOn: true, auth: _hotline), isTrue);
      expect(callCentreAvailable(featureOn: true, auth: const AuthState(isOwner: true)), isTrue);
    });

    test('never without the module, nor to a branch cashier', () {
      expect(callCentreAvailable(featureOn: false, auth: _hotline), isFalse);
      expect(callCentreAvailable(featureOn: true, auth: cashier), isFalse);
    });
  });

  group("Ordering's answer", () {
    test('reads the branches nearest first, paused ones flagged, and suggests the nearest taking orders', () {
      final resolution = StaffDeliveryResolution.fromJson({
        'delivers': true,
        'latitude': 29.96,
        'longitude': 31.25,
        'locationRead': true,
        'branches': [
          {'branchId': _maadi, 'distanceMeters': 600, 'fee': 25, 'minimumOrder': 100, 'paused': true},
          {'branchId': _downtown, 'distanceMeters': 9000, 'fee': 20, 'minimumOrder': 0, 'paused': false},
        ],
      });

      expect(resolution.pinned, isTrue);
      expect([for (final b in resolution.branches) b.branchId], [_maadi, _downtown]);
      expect(resolution.branches.first.paused, isTrue);
      expect(resolution.suggested?.branchId, _downtown, reason: 'a paused branch is never picked for the agent');
    });

    test('suggests nothing when every branch is paused or none reaches', () {
      expect(
        const StaffDeliveryResolution(branches: [DeliveryAlternative(branchId: _maadi, distanceMeters: 600, paused: true)]).suggested,
        isNull,
      );
      expect(const StaffDeliveryResolution().suggested, isNull);
    });

    test('with no point on the map, every branch that delivers is offered for the agent to pick', () {
      final resolution = StaffDeliveryResolution.fromJson({
        'delivers': true,
        'locationRead': true,
        'branches': <dynamic>[],
        'delivering': [
          {'branchId': _downtown, 'fee': 20, 'minimumOrder': 0, 'paused': false},
          {'branchId': _maadi, 'fee': 25, 'minimumOrder': 100, 'paused': true},
        ],
      });

      expect(resolution.pinned, isFalse);
      expect(resolution.byHand, isTrue);
      expect([for (final b in resolution.offers) b.branchId], [_downtown, _maadi]);
      expect(resolution.offers.last.fee, 25);
      expect(resolution.suggested, isNull, reason: 'the caller only said where they live: any choice would be a guess');
    });

    test('by hand, a business with one open delivering branch needs no pick', () {
      const one = StaffDeliveryResolution(delivering: [DeliveryAlternative(branchId: _maadi, distanceMeters: 0)]);
      const paused = StaffDeliveryResolution(delivering: [DeliveryAlternative(branchId: _maadi, distanceMeters: 0, paused: true)]);

      expect(one.suggested?.branchId, _maadi);
      expect(paused.suggested, isNull);
    });

    test('the map still chooses when a branch reaches the point', () {
      const resolution = StaffDeliveryResolution(
        latitude: 29.96,
        longitude: 31.25,
        branches: [DeliveryAlternative(branchId: _maadi, distanceMeters: 600)],
        delivering: [DeliveryAlternative(branchId: _downtown, distanceMeters: 0), DeliveryAlternative(branchId: _maadi, distanceMeters: 0)],
      );

      expect(resolution.byHand, isFalse);
      expect([for (final b in resolution.offers) b.branchId], [_maadi]);
      expect(resolution.suggested?.branchId, _maadi);
    });

    test("lists every branch's named areas, and the area the point is in at each branch", () {
      final resolution = StaffDeliveryResolution.fromJson({
        'delivers': true,
        'latitude': 29.96,
        'longitude': 31.25,
        'branches': [
          {
            'branchId': _maadi,
            'distanceMeters': 600,
            'fee': '35.00',
            'minimumOrder': 150,
            'paused': false,
            'zoneId': 11,
            'zoneName': {'en': 'Maadi Degla', 'ar': 'دجلة المعادي'},
            'etaMinutes': '40',
            'zoneOff': true,
          },
          {'branchId': _downtown, 'distanceMeters': 9000, 'fee': 20, 'minimumOrder': 0, 'paused': false, 'zoneId': null, 'zoneName': null},
        ],
        'zones': [
          {
            'zoneId': '11',
            'branchId': _maadi,
            'name': {'en': 'Maadi Degla', 'ar': 'دجلة المعادي'},
            'fee': '35.00',
            'minimumOrder': 150,
            'etaMinutes': 40,
            'on': false,
            'branchPaused': true,
            'drawn': true,
          },
          {'zoneId': 12, 'branchId': _downtown, 'name': {'en': null, 'ar': 'جاردن سيتي'}, 'fee': 0, 'minimumOrder': 0, 'etaMinutes': null, 'on': true, 'branchPaused': false, 'drawn': false},
        ],
      });

      final at = resolution.branches.first;
      expect((at.zoneId, at.zoneName?.ar, at.etaMinutes, at.zoneOff, at.fee), (11, 'دجلة المعادي', 40, true, 35));
      expect(resolution.branches.last.zoneId, isNull);
      expect(resolution.branches.last.zoneName, isNull);
      final zone = resolution.zones.first;
      expect((zone.zoneId, zone.branchId, zone.name.en, zone.fee, zone.minimumOrder, zone.etaMinutes), (11, _maadi, 'Maadi Degla', 35, 150, 40));
      expect((zone.on, zone.branchPaused, zone.drawn), (false, true, true));
      final other = resolution.zones.last;
      expect((other.name.en, other.name.ar, other.etaMinutes, other.on, other.drawn), (null, 'جاردن سيتي', null, true, false));
      expect(const StaffDeliveryResolution().zones, isEmpty);
      expect(StaffDeliveryResolution.fromJson({'delivers': true}).zones, isEmpty, reason: 'an older answer lists none');
    });
  });

  group('one call', () {
    test("the caller's number brings their account and any branch's addresses", () async {
      final (container, deliveries) = await _container();
      await container.read(callCentreControllerProvider.notifier).lookUp('01001234567');

      final call = container.read(callCentreControllerProvider);
      expect(call.customer?.id, 'c1');
      expect(call.known.single.address, 'Road 9');
      expect(deliveries.everyBranchAsked, [true]);
    });

    test('the location picks the nearest branch taking orders; the agent may choose another', () async {
      final (container, deliveries) = await _container();
      deliveries.resolution = const StaffDeliveryResolution(
        delivers: true,
        latitude: 29.96,
        longitude: 31.25,
        branches: [
          DeliveryAlternative(branchId: _maadi, distanceMeters: 600, fee: 25),
          DeliveryAlternative(branchId: _downtown, distanceMeters: 9000, fee: 20),
        ],
      );
      final controller = container.read(callCentreControllerProvider.notifier);

      await controller.resolve('29.96, 31.25');
      expect(container.read(callCentreControllerProvider).chosen?.branchId, _maadi);

      controller.choose(deliveries.resolution.branches.last);
      expect(container.read(callCentreControllerProvider).chosen?.branchId, _downtown);
    });

    group('a named area', () {
      const degla = DeliveryZone(zoneId: 11, branchId: _maadi, name: LocalizedText(en: 'Maadi Degla', ar: 'دجلة المعادي'), fee: 35, minimumOrder: 150, etaMinutes: 40);
      const garden = DeliveryZone(zoneId: 12, branchId: _downtown, name: LocalizedText(en: 'Garden City'), fee: 15, on: false);

      test("picked by name sends the order to that area's branch, whatever the map chose; clearing goes back", () async {
        final (container, deliveries) = await _container();
        deliveries.resolution = const StaffDeliveryResolution(
          delivers: true,
          latitude: 29.96,
          longitude: 31.25,
          branches: [
            DeliveryAlternative(branchId: _downtown, distanceMeters: 600, fee: 20),
            DeliveryAlternative(branchId: _maadi, distanceMeters: 9000, fee: 25),
          ],
          zones: [degla, garden],
        );
        final controller = container.read(callCentreControllerProvider.notifier);
        await controller.resolve('29.96, 31.25');
        expect(container.read(callCentreControllerProvider).chosen?.branchId, _downtown);
        expect(container.read(callCentreControllerProvider).zone, isNull, reason: 'the point is in no named area');
        expect(container.read(callCentreControllerProvider).zones, hasLength(2));

        controller.pickZone(degla);
        var call = container.read(callCentreControllerProvider);
        expect(call.zone?.zoneId, 11);
        expect(call.chosen?.branchId, _maadi);
        expect(call.chosen?.fee, 35, reason: "the area's fee, not the branch's");
        expect(call.chosen?.distanceMeters, 9000);

        // The caller is put on the map afterwards: the area they named still holds
        await controller.resolve('29.97, 31.26');
        call = container.read(callCentreControllerProvider);
        expect(call.zone?.zoneId, 11);
        expect(call.chosen?.branchId, _maadi);

        controller.pickZone(null);
        call = container.read(callCentreControllerProvider);
        expect(call.zone, isNull);
        expect(call.chosen?.branchId, _downtown, reason: 'back to the branch the map suggests');
      });

      test('the point on the map pre-selects the area it is in at the suggested branch', () async {
        final (container, deliveries) = await _container();
        deliveries.resolution = const StaffDeliveryResolution(
          delivers: true,
          latitude: 29.96,
          longitude: 31.25,
          branches: [
            DeliveryAlternative(branchId: _maadi, distanceMeters: 600, fee: 35, minimumOrder: 150, zoneId: 11, etaMinutes: 40),
            DeliveryAlternative(branchId: _downtown, distanceMeters: 9000, fee: 20),
          ],
          zones: [degla, garden],
        );
        final controller = container.read(callCentreControllerProvider.notifier);
        await controller.resolve('29.96, 31.25');
        var call = container.read(callCentreControllerProvider);
        expect(call.chosen?.branchId, _maadi);
        expect(call.zone?.zoneId, 11);
        expect(call.zone?.name.en, 'Maadi Degla');

        // Another branch picked off the list: its own area at that point, here none
        controller.choose(deliveries.resolution.branches.last);
        call = container.read(callCentreControllerProvider);
        expect(call.chosen?.branchId, _downtown);
        expect(call.zone, isNull);

        // Off the map again: an area the point found goes with the point
        deliveries.resolution = const StaffDeliveryResolution(delivers: true, zones: [degla, garden]);
        controller.choose(const DeliveryAlternative(branchId: _maadi, distanceMeters: 600, zoneId: 11));
        await controller.resolve('');
        expect(container.read(callCentreControllerProvider).zone, isNull);
      });

      test('the point never pre-selects an area that is switched off', () async {
        final (container, deliveries) = await _container();
        deliveries.resolution = const StaffDeliveryResolution(
          delivers: true,
          latitude: 30.04,
          longitude: 31.23,
          branches: [DeliveryAlternative(branchId: _downtown, distanceMeters: 400, fee: 15, zoneId: 12, zoneOff: true)],
          zones: [degla, garden],
        );
        final controller = container.read(callCentreControllerProvider.notifier);
        await controller.resolve('30.04, 31.23');
        var call = container.read(callCentreControllerProvider);
        expect(call.chosen?.branchId, _downtown);
        expect(call.zone, isNull);

        // The agent's own pick by name is theirs to make
        controller.pickZone(garden);
        call = container.read(callCentreControllerProvider);
        expect(call.zone?.zoneId, 12);
      });

      test('picked by name with no point on the map chooses its branch; gone from the list, the pick goes', () async {
        final (container, deliveries) = await _container();
        deliveries.resolution = const StaffDeliveryResolution(
          delivers: true,
          delivering: [DeliveryAlternative(branchId: _downtown, distanceMeters: 0, fee: 20), DeliveryAlternative(branchId: _maadi, distanceMeters: 0, fee: 25)],
          zones: [degla, garden],
        );
        final controller = container.read(callCentreControllerProvider.notifier);
        await controller.resolve('');
        expect(container.read(callCentreControllerProvider).chosen, isNull);

        controller.pickZone(garden);
        var call = container.read(callCentreControllerProvider);
        expect(call.chosen?.branchId, _downtown);
        expect(call.chosen?.zoneOff, isTrue);

        deliveries.resolution = const StaffDeliveryResolution(delivers: true, zones: [degla]);
        await controller.resolve('');
        call = container.read(callCentreControllerProvider);
        expect(call.zone, isNull);
        expect(call.chosen, isNull);

        // The next caller starts with nothing picked
        controller.pickZone(degla);
        controller.reset();
        expect(container.read(callCentreControllerProvider).zone, isNull);
      });

      test('travels on the sale to its branch', () async {
        final (container, _) = await _container();
        await container.read(callCentreControllerProvider.notifier).start(
              branchId: _maadi,
              customer: const SaleCustomer(name: 'Mona', phone: '01001234567'),
              delivery: SaleDelivery(address: 'Road 9', phone: '01001234567', zone: SaleDeliveryZone.of(degla)),
            );
        final delivery = container.read(saleProvider).delivery!;
        expect(delivery.zoneId, 11);
        expect(delivery.toRequest()['zoneId'], 11);
        expect(delivery.feeWith(20), 35);
      });
    });

    test('taking the order makes the till that branch, with the caller and the door on the sale', () async {
      final (container, _) = await _container();
      container.read(saleProvider.notifier).setNote('from the last caller');

      await container.read(callCentreControllerProvider.notifier).start(
            branchId: _maadi,
            customer: const SaleCustomer(name: 'Mona', phone: '01001234567'),
            delivery: const SaleDelivery(address: 'Road 9', phone: '01001234567', latitude: 29.96, longitude: 31.25),
          );

      expect(container.read(branchProvider).selectedBranchId, _maadi);
      final sale = container.read(saleProvider);
      expect(sale.customer?.name, 'Mona');
      expect(sale.delivery?.hasPin, isTrue);
      expect(sale.delivery?.sendTo, isNull, reason: 'a normal order at that branch, never sent from elsewhere');
      expect(sale.target, isNull, reason: 'never on an open bill');
      expect(sale.note, isEmpty, reason: 'nothing of the last call is kept');
    });

    test('a pickup opens the sale at the branch with no delivery', () async {
      final (container, _) = await _container();
      await container.read(callCentreControllerProvider.notifier).start(
            branchId: _zamalek,
            customer: const SaleCustomer(name: 'Omar', phone: '01009998888'),
          );

      expect(container.read(branchProvider).selectedBranchId, _zamalek);
      expect(container.read(saleProvider).delivery, isNull);
    });
  });

  group('the phone-order form', () {
    const alternatives = [DeliveryAlternative(branchId: _maadi, distanceMeters: 600)];
    const quote = TillDeliveryQuote(delivers: true, inRange: false, latitude: 29.96, longitude: 31.25, alternatives: alternatives);

    test('offers the nearer branch, but not where a call centre takes the calls', () {
      expect(offeredAlternatives(quote, pinned: true, callCentre: false), alternatives);
      expect(offeredAlternatives(quote, pinned: true, callCentre: true), isEmpty);
      expect(offeredAlternatives(quote, pinned: false, callCentre: false), isEmpty);
    });

    test("says the branch's area when it has one drawn, never a 0 km radius", () {
      final en = AppLocalizationsEn();
      final ar = AppLocalizationsAr();
      final drawn = TillDeliveryQuote.fromJson({'delivers': true, 'inRange': false, 'radiusKm': 0, 'hasArea': true});

      expect(drawn.hasArea, isTrue);
      expect(outOfRangeWarning(en, drawn), "Outside the branch's delivery area");
      expect(outOfRangeWarning(ar, drawn), 'خارج منطقة توصيل الفرع');
      expect(outOfRangeWarning(en, const TillDeliveryQuote(radiusKm: 5)), 'Outside the 5 km delivery area');
      expect(outOfRangeWarning(en, const TillDeliveryQuote(radiusKm: 2.5)), 'Outside the 2.5 km delivery area');
    });
  });
}
