import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:ninja_client/core/brand/brand_provider.dart';
import 'package:ninja_client/core/brand/brand_style.dart';
import 'package:ninja_client/core/brand/styles.dart';
import 'package:ninja_client/core/brand/tenant_brand.dart';
import 'package:ninja_client/core/models/localized_text.dart';
import 'package:ninja_client/core/providers/branch_provider.dart';
import 'package:ninja_client/core/providers/locale_provider.dart';
import 'package:ninja_client/core/theme/theme_provider.dart';
import 'package:ninja_client/core/utils/money.dart';
import 'package:ninja_client/features/menu/models/menu_item.dart';
import 'package:ninja_client/features/menu/providers/favorites_provider.dart';
import 'package:ninja_client/features/menu/screens/menu_screen.dart';
import 'package:ninja_client/l10n/app_localizations.dart';

/// Every way a style shows an item, and every header, in both directions
/// and both schemes: each one lays out without overflowing and still says
/// what the item is and what it costs.

class _NoFavorites extends FavoritesNotifier {
  @override
  FavoritesState build() => const FavoritesState();
}

class _NoBranches extends BranchNotifier {
  @override
  BranchState build() => const BranchState();
}

class _Locale extends LocaleNotifier {
  final Locale locale;

  _Locale(this.locale);

  @override
  Locale build() => locale;
}

class _Brand extends BrandNotifier {
  @override
  TenantBrand build() => const TenantBrand(
        name: LocalizedText(en: 'Chillax', ar: 'تشيلاكس'),
        primaryColorHex: '#0ea5e9',
        theme: TenantTheme(accentHex: '#fde68a'),
      );
}

final _latte = MenuItem(
  id: 7,
  name: const LocalizedText(en: 'Spanish latte', ar: 'سبانش لاتيه'),
  description: const LocalizedText(en: 'Espresso, condensed milk, cold milk', ar: 'اسبريسو وحليب مكثف'),
  price: 95,
  offerPrice: 80,
  isOnOffer: true,
  catalogTypeId: 1,
  catalogTypeName: const LocalizedText(en: 'Coffee'),
);

BrandStyle _style({MenuItemLayout? menuItem, HeaderLayout? header, ButtonsLayout? buttons, SurfaceLayout? surface}) {
  final classic = BrandStyle.classic;
  return classic.copyWith(
    layout: classic.layout.copyWith(menuItem: menuItem, header: header, buttons: buttons, surface: surface),
  );
}

Widget _host(Widget child, {required BrandStyle style, Locale locale = const Locale('en'), bool dark = false}) =>
    ProviderScope(
      overrides: [
        moneyProvider.overrideWithValue(MoneyFormat('EGP', locale)),
        favoritesProvider.overrideWith(_NoFavorites.new),
        branchProvider.overrideWith(_NoBranches.new),
        brandProvider.overrideWith(_Brand.new),
        localeProvider.overrideWith(() => _Locale(locale)),
      ],
      child: MaterialApp(
        locale: locale,
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        theme: ThemeData(extensions: [style]),
        builder: (context, child) => FTheme(
          data: ThemeState(themeMode: dark ? AppThemeMode.dark : AppThemeMode.light)
              .getForuiTheme(context, locale: locale),
          child: child!,
        ),
        home: Scaffold(body: SingleChildScrollView(child: child)),
      ),
    );

void main() {
  for (final variant in MenuItemLayout.values) {
    for (final (locale, dark) in [(const Locale('en'), false), (const Locale('ar'), true)]) {
      testWidgets('a ${variant.name} item lays out (${locale.languageCode}, ${dark ? 'dark' : 'light'})', (tester) async {
        final width = variant == MenuItemLayout.card ? 180.0 : 400.0;
        await tester.pumpWidget(_host(
          SizedBox(width: width, child: MenuItemTile(item: _latte, locale: locale, variant: variant)),
          style: _style(menuItem: variant),
          locale: locale,
          dark: dark,
        ));
        await tester.pump();

        expect(tester.takeException(), isNull);
        expect(find.text(_latte.name.getText(locale)), findsOneWidget);
        // The offer's price, whatever the layout
        expect(find.textContaining('80'), findsWidgets);
        // Laid out in the language's direction
        final directionality = tester.widget<Directionality>(
          find.ancestor(of: find.byType(MenuItemTile), matching: find.byType(Directionality)).first,
        );
        expect(directionality.textDirection, locale.languageCode == 'ar' ? TextDirection.rtl : TextDirection.ltr);
      });
    }
  }

  testWidgets('square buttons square the add button; the rest keep it round', (tester) async {
    Future<BorderRadiusGeometry?> addRadius(ButtonsLayout buttons) async {
      await tester.pumpWidget(_host(
        SizedBox(width: 400, child: MenuItemTile(item: _latte, locale: const Locale('en'))),
        style: _style(buttons: buttons),
      ));
      // Past the theme's cross-fade from the last pump's
      await tester.pumpAndSettle();
      final add = tester.widget<Container>(
        find.ancestor(of: find.byIcon(FIcons.plus), matching: find.byType(Container)).first,
      );
      return (add.decoration as BoxDecoration).borderRadius;
    }

    expect(await addRadius(ButtonsLayout.rounded), BorderRadius.circular(20));
    expect(await addRadius(ButtonsLayout.pill), BorderRadius.circular(20));
    expect(await addRadius(ButtonsLayout.square), BorderRadius.circular(4));
  });

  test('surfaces: flat has no edge, outlined a hairline, shadow a lift that becomes a hairline in the dark', () {
    final light = FThemes.zinc.light.colors;
    final dark = FThemes.zinc.dark.colors;

    final flat = _style(surface: SurfaceLayout.flat).surface(light, radius: 12);
    expect(flat.color, light.muted);
    expect(flat.border, isNull);
    expect(flat.boxShadow, isNull);

    final outlined = _style(surface: SurfaceLayout.outlined).surface(light, radius: 12);
    expect(outlined.color, light.background);
    expect(outlined.border, isNotNull);

    final shadow = _style(surface: SurfaceLayout.shadow);
    expect(shadow.surface(light, radius: 12).boxShadow, isNotEmpty);
    expect(shadow.surface(light, radius: 12).border, isNull);
    expect(shadow.surface(dark, radius: 12).boxShadow, isNull);
    expect(shadow.surface(dark, radius: 12).border, isNotNull);
  });

  test('density scales the spacing', () {
    final classic = BrandStyle.classic;
    expect(classic.space, 1);
    expect(classic.copyWith(layout: classic.layout.copyWith(density: DensityLayout.airy)).space, 1.35);
    expect(classic.copyWith(layout: classic.layout.copyWith(density: DensityLayout.compact)).space, 0.7);
  });

  for (final header in HeaderLayout.values) {
    for (final (locale, dark) in [(const Locale('en'), false), (const Locale('ar'), true)]) {
      testWidgets('the ${header.name} header lays out (${locale.languageCode}, ${dark ? 'dark' : 'light'})',
          (tester) async {
        var searched = 0;
        await tester.pumpWidget(_host(
          SizedBox(
            width: 400,
            child: MenuHeader(
              variant: header,
              title: 'Menu',
              searchOpen: false,
              onScan: () {},
              onSearch: () => searched++,
            ),
          ),
          style: _style(header: header),
          locale: locale,
          dark: dark,
        ));
        await tester.pump();

        expect(tester.takeException(), isNull);
        if (header == HeaderLayout.left) {
          expect(find.text('Menu'), findsOneWidget);
        } else {
          // No wordmark uploaded: the brand's name stands in
          expect(find.text(locale.languageCode == 'ar' ? 'تشيلاكس' : 'Chillax'), findsOneWidget);
        }
        await tester.tap(find.byIcon(FIcons.search));
        await tester.pump(const Duration(seconds: 1));
        expect(searched, 1);
      });
    }
  }
}
