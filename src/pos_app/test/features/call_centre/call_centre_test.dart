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
