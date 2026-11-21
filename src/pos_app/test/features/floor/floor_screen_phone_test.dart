import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:pos_app/core/brand/brand_provider.dart';
import 'package:pos_app/core/demo/demo.dart';
import 'package:pos_app/features/floor/screens/floor_screen.dart';
import 'package:pos_app/features/floor/widgets/bill_card.dart';
import 'package:pos_app/features/floor/widgets/place_list.dart';
import 'package:pos_app/l10n/app_localizations.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/app_fonts.dart';

/// The floor on a phone and on a tablet, over the demo's business: its bills,
/// its rooms and tables, a reservation on its way and a room asking for a
/// waiter. A tablet has the places beside the bills; a phone has no room for
/// that, so the bills come first and the places stack under them.

const _phone = Size(360, 780);
const _tablet = Size(1280, 800);

Future<void> _pumpFloor(WidgetTester tester, Size size, {Locale locale = const Locale('en'), bool cloudKitchen = false}) async {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
  SharedPreferences.setMockInitialValues({});

  await tester.pumpWidget(
    ProviderScope(
      overrides: [...demoOverrides, if (cloudKitchen) isCloudKitchenProvider.overrideWithValue(true)],
      child: MaterialApp(
        locale: locale,
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        builder: (context, child) => FTheme(
          data: const ThemeState(themeMode: AppThemeMode.light).getForuiTheme(context, locale: locale),
          child: FToaster(child: child!),
        ),
        home: const Scaffold(body: FloorScreen()),
      ),
    ),
  );
  // The branch first, as app.dart loads it after sign-in; then what the floor asks for
  final container = ProviderScope.containerOf(tester.element(find.byType(FloorScreen)));
  await container.read(branchProvider.notifier).loadBranches();
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 600));
  await tester.pump(const Duration(milliseconds: 600));
}

/// The demo's providers poll; taking the screen down stops them
Future<void> _close(WidgetTester tester) async {
  await tester.pumpWidget(const SizedBox());
  await tester.pump(const Duration(seconds: 1));
}

void main() {
  setUpAll(loadAppFonts);

  for (final locale in const [Locale('en'), Locale('ar')]) {
    testWidgets('a phone stacks the places under the bills, nothing past its edge (${locale.languageCode})', (tester) async {
      await _pumpFloor(tester, _phone, locale: locale);
      expect(tester.takeException(), isNull);

      final l10n = AppLocalizations.of(tester.element(find.byType(FloorScreen)))!;
      final title = tester.getRect(find.text(l10n.openBills));
      final places = tester.getRect(find.byType(PlaceSearchField));
      final firstBill = tester.getRect(find.byType(BillCard).first);
      expect(places.top, greaterThan(title.bottom));
      expect(places.top, greaterThan(firstBill.bottom));
      // The places take the page's whole width, not a column's
      expect(places.width, _phone.width - 24);

      // New sale has a row of its own with the icon buttons, under the title
      final sale = tester.getRect(find.widgetWithText(FButton, l10n.newSale));
      expect(sale.top, greaterThan(title.bottom));
      expect(sale.height, Sizes.control);
      expect(sale.width, greaterThan(150));

      await _close(tester);
    });
  }

  testWidgets('a phone shows the bills two across', (tester) async {
    await _pumpFloor(tester, _phone);

    final cards = find.byType(BillCard);
    expect(cards, findsAtLeastNWidgets(2));
    final first = tester.getRect(cards.at(0));
    final second = tester.getRect(cards.at(1));
    expect(second.top, first.top);
    expect(first.width, second.width);
    expect(first.width, greaterThan(150));
    expect(first.left, greaterThanOrEqualTo(0));
    expect(second.right, lessThanOrEqualTo(_phone.width));
    expect(tester.takeException(), isNull);

    await _close(tester);
  });

  testWidgets('a kitchen with no tables fits its two worded buttons on a phone, the icons under them', (tester) async {
    await _pumpFloor(tester, _phone, cloudKitchen: true);
    expect(tester.takeException(), isNull);

    expect(find.byType(PlaceSearchField), findsNothing);
    final sale = tester.getRect(find.widgetWithText(FButton, 'New sale'));
    final tab = tester.getRect(find.widgetWithText(FButton, 'New tab'));
    expect(tab.top, sale.top);
    expect(tab.width, sale.width);
    expect(tester.getRect(find.byIcon(FIcons.receiptText)).top, greaterThan(sale.bottom));

    await _close(tester);
  });

  testWidgets('between a phone and a tablet the places still stack, and the buttons stay on the title row', (tester) async {
    await _pumpFloor(tester, const Size(700, 900));
    expect(tester.takeException(), isNull);

    final title = tester.getRect(find.text('Open bills'));
    expect(tester.getRect(find.widgetWithText(FButton, 'New sale')).center.dy, closeTo(title.center.dy, 1));
    expect(tester.getRect(find.byType(PlaceSearchField)).top, greaterThan(tester.getRect(find.byType(BillCard).first).bottom));
    expect(tester.getSize(find.byType(BillCard).first).width, inInclusiveRange(180, 220));

    await _close(tester);
  });

  testWidgets('a tablet still has the places in a column beside the bills', (tester) async {
    await _pumpFloor(tester, _tablet);
    expect(tester.takeException(), isNull);

    final title = tester.getRect(find.text('Open bills'));
    final places = tester.getRect(find.byType(PlaceSearchField));
    // Side by side: the search is the places column's header, level with the bills' title
    expect(places.right, lessThan(title.left));
    expect(places.center.dy, closeTo(title.center.dy, 1));
    expect(places.width, closeTo(240, 1));

    // The buttons share the title's row
    final sale = tester.getRect(find.widgetWithText(FButton, 'New sale'));
    expect(sale.center.dy, closeTo(title.center.dy, 1));
    expect(sale.left, greaterThan(title.right));

    // And a bill card keeps its tablet width
    expect(tester.getSize(find.byType(BillCard).first).width, inInclusiveRange(180, 220));

    await _close(tester);
  });
}
