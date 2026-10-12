import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/brand/brand_provider.dart';
import 'package:ninja_client/core/brand/brand_style.dart';
import 'package:ninja_client/core/brand/styles.dart';
import 'package:ninja_client/core/brand/tenant_brand.dart';
import 'package:ninja_client/core/models/localized_text.dart';
import 'package:ninja_client/core/providers/branch_provider.dart';
import 'package:ninja_client/core/providers/locale_provider.dart';
import 'package:ninja_client/core/ui/gesture_hint.dart';
import 'package:ninja_client/core/ui/ui.dart';
import 'package:ninja_client/core/utils/money.dart';
import 'package:ninja_client/features/menu/models/menu_item.dart';
import 'package:ninja_client/features/menu/providers/favorites_provider.dart';
import 'package:ninja_client/features/menu/screens/menu_screen.dart';
import 'package:ninja_client/features/menu/services/menu_service.dart';
import 'package:ninja_client/l10n/app_localizations.dart';
import 'package:ninja_client/features/promotions/promotion.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The promotion running at the branch (client_web's components/promotions):
/// it opens once on its own over the menu, out of the dock, and not again
/// once seen; the API's answer reads into it.

class _NoFavorites extends FavoritesNotifier {
  @override
  FavoritesState build() => const FavoritesState();
}

class _Branch extends BranchNotifier {
  @override
  BranchState build() => const BranchState(selectedBranchId: 1);
}

class _Locale extends LocaleNotifier {
  @override
  Locale build() => const Locale('en');
}

class _Brand extends BrandNotifier {
  @override
  TenantBrand build() => const TenantBrand(
    name: LocalizedText(en: 'Chillax'),
    primaryColorHex: '#0ea5e9',
  );
}

MenuItem _dish(int id) => MenuItem(
  id: id,
  name: LocalizedText(en: 'Dish $id'),
  description: const LocalizedText(en: ''),
  price: 50,
  catalogTypeId: 1,
  catalogTypeName: const LocalizedText(en: 'Coffee'),
);


late ProviderContainer _container;

const _promotion = Promotion(
  id: 7,
  headline: LocalizedText(en: 'Waffle Wednesday', ar: 'أربعاء الوافل'),
  pictureUri: 'https://example.test/api/catalog/promotions/7/pic?v=promo_7_1.webp',
  link: PromotionLink.item,
  linkId: 2,
);

Widget _host() {
  final plain = BrandStyle.plain;
  final style = plain.copyWith(layout: plain.layout.copyWith(menuItem: MenuItemLayout.row));
  final menu = {
    MenuCategory(id: 1, name: const LocalizedText(en: 'Coffee')): [_dish(1), _dish(2), _dish(3)],
  };
  return UncontrolledProviderScope(
    container: _container = ProviderContainer(
      overrides: [
        moneyProvider.overrideWithValue(MoneyFormat('EGP', const Locale('en'))),
        favoritesProvider.overrideWith(_NoFavorites.new),
        branchProvider.overrideWith(_Branch.new),
        brandProvider.overrideWith(_Brand.new),
        localeProvider.overrideWith(_Locale.new),
        groupedMenuItemsProvider.overrideWith((ref, _) async => menu),
        topMenuItemsProvider.overrideWith((ref) async => const []),
        livePromotionProvider.overrideWith((ref) async => _promotion),
      ],
    ),
    child: MaterialApp(
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: materialThemeFor(NinjaTheme.neutral(Brightness.light), extensions: [style]),
      home: const MediaQuery(
        data: MediaQueryData(size: Size(390, 844)),
        child: Scaffold(body: MenuScreen()),
      ),
    ),
  );
}

void main() {
  setUp(() {
    hintBook.reset();
    cueOnScreen.value = null;
  });

  test('the live promotion reads from the API, its link and its picture sizes', () {
    final read = Promotion.fromJson({
      'id': 3,
      'headline': {'en': 'Two for one', 'ar': null},
      'pictureUri': 'https://x.test/api/catalog/promotions/3/pic?v=a.webp',
      'link': 'Category',
      'linkId': 5,
    });
    expect(read.link, PromotionLink.category);
    expect(read.linkId, 5);
    expect(read.pictureAt(320), 'https://x.test/api/catalog/promotions/3/pic?v=a.webp&api-version=1.0&w=320');
    expect(read.seenKey, '3:https://x.test/api/catalog/promotions/3/pic?v=a.webp');
    expect(Promotion.fromJson({'id': 4, 'headline': {}, 'pictureUri': null, 'link': 'Nope'}).link, PromotionLink.none);
  });

  testWidgets('it opens once on its own over the menu, and not again once seen', (tester) async {
    SharedPreferences.setMockInitialValues({hintsStorageKey: ['swipe', 'zoom', 'holdAdd']});
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(_host());
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Order now'), findsNothing, reason: 'it waits for the menu to settle');

    await tester.pump(const Duration(milliseconds: 1200));
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.text('Order now'), findsOneWidget);
    expect(_container.read(seenPromotionsProvider), contains(_promotion.seenKey));
    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getStringList('promotions_seen'), contains(_promotion.seenKey));

    // Closed, and the menu built again: seen, it stays closed
    Navigator.of(tester.element(find.text('Order now'))).pop();
    await tester.pump(const Duration(milliseconds: 600));
    await tester.pumpWidget(const SizedBox());
    await tester.pumpWidget(_host());
    _container.read(seenPromotionsProvider.notifier).see(_promotion);
    await tester.pump(const Duration(milliseconds: 2500));
    expect(find.text('Order now'), findsNothing);

    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 3));
  });
}
