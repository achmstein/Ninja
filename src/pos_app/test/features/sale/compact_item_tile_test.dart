import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/brand/tenant_brand.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:pos_app/features/catalog/models/catalog_item.dart';
import 'package:pos_app/features/sale/category_colour.dart';
import 'package:pos_app/features/sale/widgets/item_tile.dart';
import 'package:pos_app/l10n/app_localizations.dart';

Widget _host(Widget child, {Locale locale = const Locale('en')}) => ProviderScope(
      child: MaterialApp(
        locale: locale,
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        builder: (context, app) => FTheme(
          data: const ThemeState(themeMode: AppThemeMode.light).getForuiTheme(context, locale: locale),
          child: app!,
        ),
        home: Scaffold(body: Center(child: SizedBox(width: 140, height: 76, child: child))),
      ),
    );

CatalogItem _item({String en = 'Mixed Grill', String? ar, bool available = true, int category = 3}) => CatalogItem(
      id: 7,
      name: LocalizedText(en: en, ar: ar),
      price: 120,
      effectivePrice: 95,
      pictureUri: 'grill.webp',
      catalogTypeId: category,
      isAvailable: available,
    );

void main() {
  test('the brand says whether the till shows compact items, and photos when it does not', () {
    final compact = TenantBrand.fromApi({'name': {'en': 'Blue'}, 'tillItems': 'compact'}, baseUrl: '');
    expect(compact.compactTillItems, isTrue);
    expect(TenantBrand.fromJson(compact.toJson()).compactTillItems, isTrue, reason: 'kept in the cached brand');

    expect(TenantBrand.fromApi({'name': {'en': 'Blue'}}, baseUrl: '').tillItems, 'photos', reason: 'a stack older than the setting');
    expect(TenantBrand.fromApi({'name': {'en': 'Blue'}, 'tillItems': 'grid'}, baseUrl: '').tillItems, 'photos');
    expect(TenantBrand.fromJson({'name': {'en': 'Blue'}}).compactTillItems, isFalse, reason: 'a cache from before it');
  });

  test("a category's colour is the same every time, and neighbouring categories' far apart", () {
    expect(categoryColour(4), categoryColour(4));
    for (var id = 1; id < 12; id++) {
      final a = HSLColor.fromColor(categoryColour(id)).hue;
      final b = HSLColor.fromColor(categoryColour(id + 1)).hue;
      final apart = (a - b).abs() > 180 ? 360 - (a - b).abs() : (a - b).abs();
      expect(apart, greaterThan(30));
    }
  });

  test('six to eight compact tiles across beside the sale on a 1280 to 1920 tablet', () {
    // The menu's width: the screen less the sale (380) and the grid's padding
    expect(compactColumns(1280 - 380 - 24), 6);
    expect(compactColumns(1600 - 380 - 24), 7);
    expect(compactColumns(1920 - 380 - 24), 8);
    expect(compactColumns(366), 3, reason: 'as many as fit when it is narrow');
    expect(compactColumns(40), 1);
  });

  testWidgets('a compact tile is the name and the price, no picture, and a tap adds it', (tester) async {
    var tapped = 0;
    await tester.pumpWidget(_host(CompactItemTile(item: _item(), onTap: () => tapped++)));
    await tester.pumpAndSettle();

    expect(find.text('Mixed Grill'), findsOneWidget);
    expect(find.textContaining('95.00'), findsOneWidget, reason: 'the price it sells at today');
    expect(find.byType(ItemImage), findsNothing);

    await tester.tap(find.byType(CompactItemTile));
    await tester.pump(const Duration(milliseconds: 300));
    expect(tapped, 1);
  });

  testWidgets('a sold-out item stays on the pad, dimmed, and a tap does nothing', (tester) async {
    var tapped = 0;
    await tester.pumpWidget(_host(CompactItemTile(item: _item(available: false), onTap: () => tapped++)));
    await tester.pumpAndSettle();

    expect(tester.widget<Opacity>(find.byType(Opacity).first).opacity, 0.4);
    await tester.tap(find.byType(CompactItemTile));
    await tester.pump(const Duration(milliseconds: 300));
    expect(tapped, 0);
  });

  testWidgets('in an Arabic till a Latin name reads left to right from the line start, the colour on the right edge', (tester) async {
    await tester.pumpWidget(_host(CompactItemTile(item: _item(en: 'Mixed Grill (Large)', category: 5), onTap: () {}), locale: const Locale('ar')));
    await tester.pumpAndSettle();

    final name = tester.widget<Text>(find.text('Mixed Grill (Large)'));
    expect(name.textDirection, TextDirection.ltr, reason: 'laid out, and cut, as it is written');
    expect(name.textAlign, TextAlign.right, reason: "at the Arabic line's start");

    final strip = find.byWidgetPredicate((w) => w is ColoredBox && w.color == categoryColour(5));
    expect(strip, findsOneWidget);
    expect(tester.getCenter(strip).dx, greaterThan(tester.getCenter(find.text('Mixed Grill (Large)')).dx), reason: 'the start edge is the right one');
  });
}
