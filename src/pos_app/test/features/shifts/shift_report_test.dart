import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/brand/brand_service.dart';
import 'package:ninja_app_core/brand/tenant_brand.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:pos_app/features/shifts/models/shift.dart';
import 'package:pos_app/features/shifts/widgets/shift_report.dart';
import 'package:pos_app/l10n/app_localizations.dart';

class _Tenant implements TenantRepository {
  @override
  Future<TenantBrand> getBrand() async => TenantBrand.neutral;
}

Widget _app(ShiftView shift, Locale locale) => ProviderScope(
      overrides: [tenantRepositoryProvider.overrideWithValue(_Tenant())],
      child: MaterialApp(
        locale: locale,
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        builder: (context, child) => FTheme(
          data: const ThemeState(themeMode: AppThemeMode.light).getForuiTheme(context, locale: locale),
          child: child!,
        ),
        home: Scaffold(body: SingleChildScrollView(child: ShiftReport(shift: shift))),
      ),
    );

Future<void> _loadFonts() async {
  for (final family in ['Inter', 'Alexandria']) {
    final loader = FontLoader(family);
    for (final weight in ['Regular', 'Medium', 'SemiBold', 'Bold']) {
      loader.addFont(rootBundle.load('assets/fonts/$family-$weight.ttf'));
    }
    await loader.load();
  }
}

// A closed shift whose drawer took a late offline sale: float 500 + cash
// 1960 (60 of it the late sale) + tab cash 150 + pay-in 200 − pay-out 300 −
// cash refund 50 = 2460; 2400 was frozen at close, before the 60 arrived
final _shift = ShiftView.fromJson({
  'id': 41,
  'status': 'Closed',
  'openingFloat': 500,
  'ticketsSettled': 38,
  'salesTotal': 4270,
  'grossSales': 4270,
  'netSales': 4220,
  'discounts': 85,
  'tenderTotals': [
    {'tender': 'Cash', 'amount': 1960, 'count': 22, 'tendered': 2105},
    {'tender': 'Card', 'amount': 2310, 'count': 17},
  ],
  'cashTendered': 2105,
  'changeGiven': 145,
  'refundsTotal': 50,
  'cashRefunds': 50,
  'payInsTotal': 200,
  'payOutsTotal': 300,
  'cashTabPayments': 150,
  'closingCount': 2440,
  'expectedCash': 2400,
  'overShort': 40,
  'expectedInDrawer': 2460,
  'lateCash': 60,
  'adjustedOverShort': -20,
});

void main() {
  setUpAll(_loadFonts);

  for (final locale in const [Locale('en'), Locale('ar')]) {
    testWidgets('the Z report writes the drawer out part by part (${locale.languageCode})', (tester) async {
      tester.view.physicalSize = const Size(800, 2400);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);

      await tester.pumpWidget(_app(_shift, locale));
      await tester.pumpAndSettle();

      final l10n = lookupAppLocalizations(locale);
      for (final label in [
        l10n.grossSales,
        l10n.netSales,
        l10n.refundsAllTenders,
        l10n.billTenders,
        l10n.drawerCashTitle,
        l10n.cashTakenNet,
        l10n.cashTabPayments,
        l10n.cashRefunds,
        '= ${l10n.expectedInDrawer}',
        l10n.expectedAtClose,
        l10n.lateCash,
        l10n.adjustedOverShort,
      ]) {
        expect(find.text(label), findsOneWidget, reason: label);
      }
      expect(_shift.drawer.addsUpTo(_shift.expectedInDrawer), isTrue);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('an open shift shows no late cash', (tester) async {
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);

    await tester.pumpWidget(_app(ShiftView.fromJson({'id': 1, 'openingFloat': 300, 'expectedInDrawer': 300}), const Locale('en')));
    await tester.pumpAndSettle();

    final l10n = lookupAppLocalizations(const Locale('en'));
    expect(find.text(l10n.lateCash), findsNothing);
    expect(find.text(l10n.cashTakenNet), findsOneWidget);
  });
}
