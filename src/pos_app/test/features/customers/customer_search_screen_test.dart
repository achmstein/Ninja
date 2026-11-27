import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:pos_app/features/customers/recent_customers.dart';
import 'package:pos_app/features/customers/services/customer_search_service.dart';
import 'package:pos_app/features/sale/models/sale_line.dart';
import 'package:pos_app/features/sale/widgets/customer_dialog.dart';
import 'package:pos_app/l10n/app_localizations.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The whole-screen customer search, as every "Choose customer" opens it.

const _customers = [
  IdentityUser(id: 'c1', firstName: 'Mona', lastName: 'Ali', phoneNumber: '+201012345678'),
  IdentityUser(id: 'c2', firstName: 'Ahmed', lastName: 'Hady'),
  IdentityUser(id: 'c3', firstName: 'أحمد'),
  IdentityUser(id: 'c4', firstName: 'Omar', enabled: false),
];

class _Customers implements CustomerSearchService {
  final asked = <String>[];

  @override
  Future<List<IdentityUser>> search(String term, {int max = 20}) async {
    asked.add('$term|$max');
    if (term.isEmpty) return _customers;
    return _customers.where((u) => u.displayName.toLowerCase().contains(term.toLowerCase())).toList();
  }
}

// A press holds its look a moment: let it go before the test ends
const _press = Duration(milliseconds: 250);

SaleCustomer? _picked;
bool _closed = false;

Widget _app(_Customers customers,
        {bool accountsOnly = false, Map<String, String> busy = const {}, List<String>? branchRecent}) =>
    ProviderScope(
      overrides: [
        customerSearchServiceProvider.overrideWithValue(customers),
        // The branch's own list when the server answers; left out, it cannot be asked and the tablet's stands in
        branchRecentCustomersProvider
            .overrideWithValue(() async => branchRecent ?? (throw StateError('the server cannot be asked'))),
      ],
      child: MaterialApp(
        locale: const Locale('en'),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        builder: (context, child) => FTheme(
          data: const ThemeState(themeMode: AppThemeMode.light).getForuiTheme(context, locale: const Locale('en')),
          child: FToaster(child: child!),
        ),
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () async {
                _picked = await showCustomerDialog(context, accountsOnly: accountsOnly, busy: busy);
                _closed = true;
              },
              child: const Text('open'),
            ),
          ),
        ),
      ),
    );

Future<void> _open(WidgetTester tester) async {
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
}

void main() {
  setUp(() {
    _picked = null;
    _closed = false;
    SharedPreferences.setMockInitialValues({
      'pos.recentCustomers': '[{"id":"c2","name":"Ahmed Hady"},{"id":"gone","name":"Left Town"}]',
    });
  });

  testWidgets('before anything is typed: the recent ones, then everyone, and the keyboard stays down', (tester) async {
    final customers = _Customers();
    await tester.pumpWidget(_app(customers));
    await _open(tester);

    expect(customers.asked, ['|200']);
    expect(find.text('RECENT'), findsOneWidget);
    expect(find.text('EVERYONE'), findsOneWidget);
    // Once under Recent, once under Everyone; whoever is no longer a customer is not offered
    expect(find.text('Ahmed Hady'), findsNWidgets(2));
    expect(find.text('Left Town'), findsNothing);
    expect(find.text('Mona Ali'), findsOneWidget);
    expect(tester.testTextInput.isVisible, isFalse);
  });

  testWidgets('the recent ones are those of the branch, from its bills, whatever was picked on this tablet', (tester) async {
    final customers = _Customers();
    // The tablet remembers Ahmed; the branch last rang up Mona
    await tester.pumpWidget(_app(customers, branchRecent: ['c1', 'gone']));
    await _open(tester);

    expect(find.text('RECENT'), findsOneWidget);
    expect(find.text('Mona Ali'), findsNWidgets(2), reason: 'under Recent and under Everyone');
    expect(find.text('Ahmed Hady'), findsOneWidget, reason: 'only under Everyone');
    expect(find.text('Left Town'), findsNothing);
  });

  testWidgets('a letter shows the names filed under it, and again clears it', (tester) async {
    await tester.pumpWidget(_app(_Customers()));
    await _open(tester);

    // Only letters somebody starts with
    expect(find.text('A'), findsOneWidget);
    expect(find.text('أ'), findsOneWidget);
    expect(find.text('B'), findsNothing);

    await tester.tap(find.text('M'));
    await tester.pump(_press);
    expect(find.text('Mona Ali'), findsOneWidget);
    expect(find.text('Ahmed Hady'), findsNothing);
    expect(find.text('EVERYONE'), findsNothing);

    await tester.tap(find.text('M'));
    await tester.pump(_press);
    expect(find.text('EVERYONE'), findsOneWidget);
  });

  testWidgets('picking returns the account and remembers it', (tester) async {
    await tester.pumpWidget(_app(_Customers()));
    await _open(tester);

    await tester.tap(find.text('Mona Ali'));
    await tester.pumpAndSettle();

    expect(_picked?.id, 'c1');
    expect(_picked?.name, 'Mona Ali');
    expect(_picked?.phone, '+201012345678');
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getString('pos.recentCustomers'), startsWith('[{"id":"c1"'));
  });

  testWidgets('a switched-off account and one with a bill open cannot be picked', (tester) async {
    await tester.pumpWidget(_app(_Customers(), busy: const {'c1': 'Table 4'}));
    await _open(tester);

    expect(find.text('Already has a bill open · Table 4'), findsOneWidget);
    await tester.tap(find.text('Mona Ali'));
    await tester.tap(find.text('Omar'));
    await tester.pump(_press);
    expect(_closed, isFalse);
  });

  testWidgets('a typed name is searched, and can go on the order as it is', (tester) async {
    final customers = _Customers();
    await tester.pumpWidget(_app(customers));
    await _open(tester);

    await tester.enterText(find.byType(EditableText), 'Sara');
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pump();

    expect(customers.asked.last, 'Sara|20');
    expect(find.text('Nobody by that name'), findsOneWidget);
    expect(find.text('NOT IN THE LIST?'), findsOneWidget);
    expect(find.text('New customer'), findsOneWidget);

    await tester.tap(find.text('Use "Sara"'));
    await tester.pumpAndSettle();
    expect(_picked?.id, isNull);
    expect(_picked?.name, 'Sara');
  });

  testWidgets('where only an account will do, the name is not offered', (tester) async {
    await tester.pumpWidget(_app(_Customers(), accountsOnly: true));
    await _open(tester);

    await tester.enterText(find.byType(EditableText), 'Sara');
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pump();

    expect(find.text('NOT IN THE LIST?'), findsNothing);
    expect(find.text('New customer'), findsOneWidget);
  });
}
