import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/brand/brand_provider.dart';
import 'package:ninja_app_core/brand/tenant_brand.dart';
import 'package:ninja_app_core/models/branch.dart';
import 'package:pos_app/core/services/branch_names.dart';
import 'package:pos_app/features/call_centre/call_centre_mode.dart';
import 'package:pos_app/features/customers/services/customer_search_service.dart';
import 'package:pos_app/features/deliveries/models/delivery_order.dart';
import 'package:pos_app/features/deliveries/providers/deliveries_provider.dart';
import 'package:pos_app/features/deliveries/services/delivery_service.dart';
import 'package:pos_app/features/deliveries/widgets/delivery_form_dialog.dart';
import 'package:pos_app/features/sale/models/sale_line.dart';
import '../../support/phone.dart';

/// A branch that delivers, and a caller with one earlier address
class _Repository implements DeliveryRepository {
  List<KnownAddress> known = const [KnownAddress(address: 'Tahrir St', building: '12', label: 'Home')];

  @override
  Future<TillDeliveryQuote> tillQuote({String? location, int? zoneId}) async => const TillDeliveryQuote(delivers: true, fee: 20);

  @override
  Future<List<KnownAddress>> knownAddresses({String? customerUserId, String? phone, bool everyBranch = false}) async => known;

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

class _Customers implements CustomerSearchService, CounterCustomerService {
  List<IdentityUser> found = const [];

  @override
  Future<List<IdentityUser>> search(String term, {int max = 20}) async => found;

  @override
  Future<CustomerLookup> lookup({String? phone, String? name}) async => CustomerLookup(phone: phone ?? '', phoneValid: true);

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

class _Brand extends BrandNotifier {
  @override
  TenantBrand build() => TenantBrand.neutral;
}

/// A screen with one button that opens the form for [customer], keeping what it answers
Widget _host(_Repository repository, _Customers customers, {SaleCustomer? customer, void Function(DeliveryFormResult?)? onDone, Locale locale = const Locale('en')}) =>
    tillApp(
      opener((context) async {
        final result = await showDeliveryFormDialog(context, customer: customer, itemsTotal: 100);
        onDone?.call(result);
      }),
      locale: locale,
      overrides: [
        deliveryRepositoryProvider.overrideWithValue(repository),
        callCentreModeProvider.overrideWithValue(false),
        customerSearchServiceProvider.overrideWithValue(customers),
        counterCustomerServiceProvider.overrideWithValue(customers),
        brandProvider.overrideWith(_Brand.new),
        tillRidersProvider.overrideWith((ref) async => const <TillRider>[]),
        allBranchesProvider.overrideWith((ref) async => const <Branch>[]),
      ],
    );

/// Opens the form and waits out its first answers (the terms, the earlier addresses)
Future<void> _open(WidgetTester tester) async {
  await tester.tap(find.text('open'));
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 600));
}

void main() {
  setUpAll(loadTillFonts);

  testWidgets('a new call starts on the customer step, the steps said in words and by name', (tester) async {
    await tester.pumpWidget(_host(_Repository(), _Customers()));
    await _open(tester);

    expect(find.text('Step 1 of 3'), findsOneWidget);
    for (final step in ['Customer', 'Address', 'Confirm']) {
      expect(find.text(step), findsOneWidget);
    }
    expect(find.text('Phone for the rider'), findsOneWidget);
    expect(find.text('Next: Address'), findsOneWidget);
  });

  testWidgets('a number is said for what it is as it is typed: customers to tap, then the customer', (tester) async {
    final customers = _Customers()..found = const [IdentityUser(id: 'u1', firstName: 'Mona', phoneNumber: '+201001234567')];
    final repository = _Repository()..known = const [];
    await tester.pumpWidget(_host(repository, customers));
    await _open(tester);

    await tester.enterText(find.byType(EditableText).first, '010012');
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text('Mona'), findsOneWidget);

    // Tapping her fills the number and the name, and the number is hers
    await tester.tap(find.text('Mona'));
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pump();
    expect(find.text('Mona · Customer'), findsOneWidget);
    expect(tester.widgetList<EditableText>(find.byType(EditableText)).map((f) => f.controller.text), ['010 01234567', 'Mona']);
  });

  testWidgets('a number nobody has is a new caller; one delivered to before says so', (tester) async {
    final repository = _Repository()..known = const [];
    await tester.pumpWidget(_host(repository, _Customers()));
    await _open(tester);

    await tester.enterText(find.byType(EditableText).first, '01001234567');
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pump();
    expect(find.text('New caller: added to customers when the order is sent'), findsOneWidget);

    repository.known = const [KnownAddress(address: 'Tahrir St', building: '12')];
    await tester.enterText(find.byType(EditableText).first, '01001234568');
    await tester.pump();
    expect(find.text('New caller: added to customers when the order is sent'), findsNothing, reason: 'said of the last number, not this one');
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pump();
    expect(find.text('Ordered delivery before'), findsOneWidget);
    expect(find.text('Same address'), findsOneWidget);
  });

  testWidgets("a sale that says who it is for opens on the address, their addresses at its top, one tap to confirm", (tester) async {
    DeliveryFormResult? result;
    await tester.pumpWidget(_host(
      _Repository(),
      _Customers(),
      customer: const SaleCustomer(id: 'u1', name: 'Mona', phone: '+201001234567'),
      onDone: (r) => result = r,
    ));
    await _open(tester);

    expect(find.text('Step 2 of 3'), findsOneWidget);
    // The step behind says who, under its name
    expect(find.text('Mona'), findsOneWidget);
    expect(find.text('Area and street'), findsOneWidget);
    expect(find.text('Next: Confirm'), findsOneWidget);
    expect(find.textContaining('Tahrir St'), findsOneWidget);

    await tester.tap(find.text('Same address'));
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pump();
    expect(find.text('Step 3 of 3'), findsOneWidget);

    await tester.tap(find.text('Deliver here'));
    await tester.pump(const Duration(milliseconds: 600));
    expect(result?.delivery.address, 'Tahrir St');
    expect(result?.delivery.building, '12');
    expect(result?.customer.id, 'u1');
  });

  testWidgets('a sale with a name and no number still asks for the number first', (tester) async {
    await tester.pumpWidget(_host(_Repository(), _Customers(), customer: const SaleCustomer(name: 'Mona')));
    await _open(tester);
    expect(find.text('Step 1 of 3'), findsOneWidget);
  });

  for (final locale in phoneLocales) {
    testWidgets('the steps and the earlier addresses fit a phone ($locale)', (tester) async {
      await usePhone(tester);
      await tester.pumpWidget(_host(
        _Repository(),
        _Customers(),
        customer: const SaleCustomer(id: 'u1', name: 'Mona Abdel Rahman El Sayed', phone: '+201001234567'),
        locale: locale,
      ));
      await _open(tester);
      expectFits(tester, reason: 'the address step');

      await tester.tap(find.byIcon(FIcons.check).last);
      await tester.pump(const Duration(milliseconds: 600));
      await tester.pump();
      expectFits(tester, reason: 'the confirm step');
    });
  }
}
