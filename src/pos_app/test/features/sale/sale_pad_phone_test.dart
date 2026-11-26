import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/brand/brand_provider.dart';
import 'package:ninja_app_core/brand/tenant_brand.dart';
import 'package:ninja_app_core/models/branch.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:ninja_app_core/theme/sizes.dart';
import 'package:pos_app/features/call_centre/call_centre_mode.dart';
import 'package:pos_app/features/catalog/models/catalog_item.dart';
import 'package:pos_app/features/catalog/providers/catalog_provider.dart';
import 'package:pos_app/features/deliveries/models/delivery_order.dart';
import 'package:pos_app/features/deliveries/providers/deliveries_provider.dart';
import 'package:pos_app/features/sale/screens/sale_pad_screen.dart';
import 'package:pos_app/features/sale/widgets/cart_line_row.dart';
import 'package:pos_app/features/sale/widgets/item_tile.dart';
import 'package:pos_app/features/sale/widgets/sale_order_panel.dart';
import 'package:pos_app/features/tickets/models/pricing.dart';
import 'package:pos_app/features/tickets/providers/pricing_provider.dart';
import 'package:pos_app/l10n/app_localizations.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The sale pad on a phone: the menu takes the screen, the categories are one
/// row that swipes, and the running sale is a sheet opened from a bar under
/// the menu. On a tablet the sale stays in its column beside the menu.

class _Branches extends BranchNotifier {
  @override
  BranchState build() => BranchState(
        branches: [Branch(id: 1, name: const LocalizedText(en: 'Downtown', ar: 'وسط البلد'), isActive: true, displayOrder: 0)],
        selectedBranchId: 1,
      );
}

class _Brand extends BrandNotifier {
  _Brand(this.tillItems);
  final String tillItems;

  @override
  TenantBrand build() => TenantBrand(name: const LocalizedText(en: 'Blue', ar: 'بلو'), tillItems: tillItems);
}

/// The menu already on the till, as it is from the second sale of the day on
class _Items extends CatalogItemsNotifier {
  @override
  Future<List<CatalogItem>> build() => SynchronousFuture([
        for (var i = 1; i <= 9; i++)
          CatalogItem(
            id: i,
            name: LocalizedText(en: 'Item number $i', ar: 'صنف رقم $i'),
            price: 45.0 + i,
            catalogTypeId: i.isEven ? 2 : 1,
            displayOrder: i,
          ),
      ]);
}

class _Pricing extends PricingNotifier {
  @override
  Future<PricingView> build() async => const PricingView();
}

/// More categories than a phone's row holds, so the row has to swipe
const _categories = [
  CatalogCategory(id: 1, name: LocalizedText(en: 'Hot drinks', ar: 'مشروبات ساخنة')),
  CatalogCategory(id: 2, name: LocalizedText(en: 'Cold drinks', ar: 'مشروبات باردة'), displayOrder: 1),
  CatalogCategory(id: 3, name: LocalizedText(en: 'Sandwiches', ar: 'ساندويتشات'), displayOrder: 2),
  CatalogCategory(id: 4, name: LocalizedText(en: 'Desserts', ar: 'حلويات'), displayOrder: 3),
  CatalogCategory(id: 5, name: LocalizedText(en: 'Breakfast', ar: 'فطور'), displayOrder: 4),
];

Widget _app({Locale locale = const Locale('en'), String tillItems = 'photos'}) => ProviderScope(
      overrides: [
        branchProvider.overrideWith(_Branches.new),
        brandProvider.overrideWith(() => _Brand(tillItems)),
        catalogItemsProvider.overrideWith(_Items.new),
        catalogCategoriesProvider.overrideWith((ref) async => _categories),
        pricingProvider.overrideWith(_Pricing.new),
        // The branch delivers, so the sale carries the counter or delivery
        // switch over its customer
        tillDeliveryTermsProvider.overrideWith((ref) async => const TillDeliveryQuote(delivers: true, fee: 20)),
        callCentreModeProvider.overrideWithValue(false),
      ],
      child: MaterialApp(
        locale: locale,
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        builder: (context, child) => FTheme(
          data: const ThemeState(themeMode: AppThemeMode.light).getForuiTheme(context, locale: locale),
          child: FToaster(child: child!),
        ),
        home: const Scaffold(body: SalePadScreen()),
      ),
    );

void _surface(WidgetTester tester, Size size) {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}

/// The bundled fonts, so widths are the device's and not the test font's
/// (which draws every glyph a full em wide and overflows narrow rows)
Future<void> _loadFonts() async {
  for (final family in ['Inter', 'Alexandria']) {
    final loader = FontLoader(family);
    for (final weight in ['Regular', 'Medium', 'SemiBold', 'Bold']) {
      loader.addFont(rootBundle.load('assets/fonts/$family-$weight.ttf'));
    }
    await loader.load();
  }
}

const _phone = Size(360, 780);
const _tablet = Size(1280, 800);

void main() {
  setUpAll(_loadFonts);
  setUp(() => SharedPreferences.setMockInitialValues({}));

  for (final locale in const [Locale('en'), Locale('ar')]) {
    final viewOrder = locale.languageCode == 'ar' ? 'عرض الطلب' : 'View order';

    for (final tillItems in const ['photos', 'compact']) {
      testWidgets('a phone shows the menu alone, with the way to the order under it (${locale.languageCode}, $tillItems)',
          (tester) async {
        _surface(tester, _phone);
        await tester.pumpWidget(_app(locale: locale, tillItems: tillItems));
        await tester.pumpAndSettle();

        // Laid out without running past either edge
        expect(tester.takeException(), isNull);
        expect(find.byType(SaleOrderPanel), findsNothing, reason: 'no column beside the menu');
        expect(find.text(viewOrder), findsOneWidget);

        // The bar is the screen's width and a full target for a finger
        final bar = tester.getRect(find.ancestor(of: find.text(viewOrder), matching: find.byType(FButton)));
        expect(bar.left, greaterThanOrEqualTo(0));
        expect(bar.right, lessThanOrEqualTo(_phone.width));
        expect(bar.width, greaterThan(_phone.width - 32));
        expect(bar.height, greaterThanOrEqualTo(Sizes.control));

        // The categories are one row of chips, never the list down the side
        // nor its search, whichever tiles the owner chose
        expect(find.byType(FTextField), findsNothing);
        final first = tester.getRect(find.ancestor(of: find.text(_categories.first.name.getText(locale)), matching: find.byType(FButton)));
        final second = tester.getRect(find.ancestor(of: find.text(_categories[1].name.getText(locale)), matching: find.byType(FButton)));
        expect(first.top, second.top, reason: 'one row, not wrapped');
        expect(first.height, greaterThanOrEqualTo(Sizes.control));

        // The menu itself is inside the screen
        final tile = tillItems == 'compact' ? find.byType(CompactItemTile) : find.byType(ItemTile);
        expect(tile, findsWidgets);
        for (final one in tester.widgetList(tile)) {
          final rect = tester.getRect(find.byWidget(one));
          expect(rect.left, greaterThanOrEqualTo(0));
          expect(rect.right, lessThanOrEqualTo(_phone.width));
        }
      });
    }

    testWidgets('the bar opens the order as a sheet, and the sheet closes again (${locale.languageCode})', (tester) async {
      _surface(tester, _phone);
      await tester.pumpWidget(_app(locale: locale));
      await tester.pumpAndSettle();

      // Two of one item rung up: the bar reads how many and what they come to
      await tester.tap(find.byType(ItemTile).first);
      await tester.pump();
      await tester.tap(find.byType(ItemTile).first);
      await tester.pumpAndSettle(const Duration(milliseconds: 100), EnginePhase.sendSemanticsUpdate, const Duration(seconds: 5));
      expect(find.descendant(of: find.ancestor(of: find.text(viewOrder), matching: find.byType(FButton)), matching: find.text('2')),
          findsOneWidget);
      expect(find.byType(CartLineRow), findsNothing, reason: 'the lines are in the sheet');

      await tester.tap(find.text(viewOrder));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);

      // The same panel a tablet has beside the menu, across the phone and
      // nearly its height
      final sheet = tester.getRect(find.byType(SaleOrderPanel));
      expect(sheet.left, 0);
      expect(sheet.right, _phone.width);
      expect(sheet.top, 40);
      expect(sheet.bottom, _phone.height);
      expect(find.byType(CartLineRow), findsOneWidget);

      // Its heading is the sheet's title, with the way out beside it
      final close = find.descendant(of: find.byType(SaleOrderPanel), matching: find.byIcon(FIcons.x));
      expect(close, findsOneWidget);
      // Every control in it is inside the screen and a full target
      for (final icon in const [FIcons.x, FIcons.trash2, FIcons.plus, FIcons.bike]) {
        final button = find.ancestor(
          of: find.descendant(of: find.byType(SaleOrderPanel), matching: find.byIcon(icon)).first,
          matching: find.byType(FButton),
        );
        final rect = tester.getRect(button.first);
        expect(rect.left, greaterThanOrEqualTo(0), reason: '$icon');
        expect(rect.right, lessThanOrEqualTo(_phone.width), reason: '$icon');
        expect(rect.height, greaterThanOrEqualTo(Sizes.control), reason: '$icon');
      }

      // One more from the sheet: the sheet hears of it, though it is a route of its own
      await tester.tap(find.descendant(of: find.byType(CartLineRow), matching: find.byIcon(FIcons.plus)));
      await tester.pumpAndSettle(const Duration(milliseconds: 100), EnginePhase.sendSemanticsUpdate, const Duration(seconds: 5));
      expect(find.descendant(of: find.byType(CartLineRow), matching: find.text('3')), findsOneWidget);

      await tester.tap(close);
      await tester.pumpAndSettle();
      expect(find.byType(SaleOrderPanel), findsNothing);
      expect(find.text(viewOrder), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('the phone searches from the button at the end of the chips', (tester) async {
    _surface(tester, _phone);
    await tester.pumpWidget(_app());
    await tester.pumpAndSettle();

    await tester.tap(find.byIcon(FIcons.search));
    await tester.pumpAndSettle();
    expect(find.text('Hot drinks'), findsNothing, reason: 'the search takes the chips\' place');
    await tester.enterText(find.byType(EditableText), 'number 4');
    await tester.pumpAndSettle();
    expect(find.byType(ItemTile), findsOneWidget, reason: 'across every category');
    expect(tester.takeException(), isNull);

    // Closing it brings the category back
    await tester.tap(find.byIcon(FIcons.x));
    await tester.pumpAndSettle();
    expect(find.text('Hot drinks'), findsOneWidget);
    expect(find.byType(ItemTile), findsNWidgets(5));
  });

  for (final tillItems in const ['photos', 'compact']) {
    testWidgets('a tablet keeps the sale in its column beside the menu ($tillItems)', (tester) async {
      _surface(tester, _tablet);
      await tester.pumpWidget(_app(tillItems: tillItems));
      await tester.pumpAndSettle();

      expect(tester.takeException(), isNull);
      expect(find.text('View order'), findsNothing);
      final column = tester.getRect(find.byType(SaleOrderPanel));
      expect(column.right, _tablet.width);
      expect(column.width, 379, reason: '380 less the rule that meets the menu');
      expect(column.height, _tablet.height);
      expect(find.descendant(of: find.byType(SaleOrderPanel), matching: find.byIcon(FIcons.x)), findsNothing);
      // No search button: every category is in view, or listed down the side with its search
      expect(find.byIcon(FIcons.search), tillItems == 'compact' ? findsOneWidget : findsNothing);
      // The note is the sale's: it is asked for once something is rung up
      expect(find.byType(FTextField), findsNWidgets(tillItems == 'compact' ? 1 : 0));
      await tester.tap((tillItems == 'compact' ? find.byType(CompactItemTile) : find.byType(ItemTile)).first);
      await tester.pumpAndSettle(const Duration(milliseconds: 100), EnginePhase.sendSemanticsUpdate, const Duration(seconds: 5));
      expect(find.byType(FTextField), findsNWidgets(tillItems == 'compact' ? 2 : 1));
    });
  }
}
