import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/ui/ui.dart';
import 'package:ninja_client/core/brand/brand_provider.dart';
import 'package:ninja_client/core/brand/brand_style.dart';
import 'package:ninja_client/core/brand/styles.dart';
import 'package:ninja_client/core/brand/tenant_brand.dart';
import 'package:ninja_client/core/models/localized_text.dart';
import 'package:ninja_client/core/providers/branch_provider.dart';
import 'package:ninja_client/core/providers/locale_provider.dart';
import 'package:ninja_client/core/utils/money.dart';
import 'package:ninja_client/features/menu/models/menu_item.dart';
import 'package:ninja_client/features/menu/providers/favorites_provider.dart';
import 'package:ninja_client/features/menu/widgets/deck.dart';
import 'package:ninja_client/features/menu/widgets/dish.dart';
import 'package:ninja_client/l10n/app_localizations.dart';

/// Every way the menu shows a dish, in both directions and both schemes:
/// each lays out without overflowing and still says what the dish is and
/// what it costs; and the button at its end does what the web's does.

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
  final plain = BrandStyle.plain;
  return plain.copyWith(
    layout: plain.layout.copyWith(menuItem: menuItem, header: header, buttons: buttons, surface: surface),
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
        theme: materialThemeFor(NinjaTheme.neutral(dark ? Brightness.dark : Brightness.light), extensions: [style]),
        home: Scaffold(body: SingleChildScrollView(child: child)),
      ),
    );

MenuItem _with({bool required = false, bool available = true}) => MenuItem(
      id: _latte.id,
      name: _latte.name,
      description: _latte.description,
      price: _latte.price,
      offerPrice: _latte.offerPrice,
      isOnOffer: _latte.isOnOffer,
      isAvailable: available,
      catalogTypeId: 1,
      catalogTypeName: _latte.catalogTypeName,
      customizations: [
        if (required)
          ItemCustomization(id: 1, name: const LocalizedText(en: 'Milk'), isRequired: true, options: [
            CustomizationOption(id: 1, name: const LocalizedText(en: 'Oat')),
          ]),
      ],
    );

void main() {
  for (final variant in MenuItemLayout.values) {
    for (final (locale, dark) in [(const Locale('en'), false), (const Locale('ar'), true)]) {
      testWidgets('a ${variant.name} dish lays out (${locale.languageCode}, ${dark ? 'dark' : 'light'})', (tester) async {
        final small = variant == MenuItemLayout.card || variant == MenuItemLayout.deck || variant == MenuItemLayout.tiles;
        final width = small ? 180.0 : 400.0;
        await tester.pumpWidget(_host(
          SizedBox(width: width, child: dishFor(variant, _latte)),
          style: _style(menuItem: variant),
          locale: locale,
          dark: dark,
        ));
        await tester.pump(const Duration(milliseconds: 400));

        expect(tester.takeException(), isNull);
        // A tile with no photo carries its name on it as well as under it
        expect(find.text(_latte.name.getText(locale)), findsWidgets);
        // The offer's price, whatever the layout, and the one it replaces where there is room
        expect(find.textContaining('80'), findsWidgets);
        if (!small || variant == MenuItemLayout.card) expect(find.textContaining('95'), findsWidgets);
      });
    }
  }

  for (final (locale, dark) in [(const Locale('en'), false), (const Locale('ar'), true)]) {
    testWidgets("the deck's card lays out, the usual marked (${locale.languageCode}, ${dark ? 'dark' : 'light'})", (tester) async {
      await tester.pumpWidget(_host(
        SizedBox(width: 360, height: 560, child: DeckCard(item: _latte, usual: true)),
        style: _style(menuItem: MenuItemLayout.deck),
        locale: locale,
        dark: dark,
      ));
      await tester.pump(const Duration(milliseconds: 400));
      expect(tester.takeException(), isNull);
      expect(find.text(_latte.name.getText(locale)), findsOneWidget);
      expect(find.byIcon(LucideIcons.repeat2), findsOneWidget);
    });
  }

  testWidgets("a dish with nothing to choose goes in with its plus, which becomes a stepper", (tester) async {
    await tester.pumpWidget(_host(SizedBox(width: 400, child: dishFor(MenuItemLayout.row, _latte)), style: _style()));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.byIcon(LucideIcons.minus), findsNothing);

    await tester.tap(find.byIcon(LucideIcons.plus));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.byIcon(LucideIcons.minus), findsOneWidget);
    expect(find.text('1'), findsOneWidget);

    // Less takes it back out, and the plus returns
    await tester.tap(find.byIcon(LucideIcons.minus));
    await tester.pumpAndSettle();
    expect(find.byIcon(LucideIcons.minus), findsNothing);
    expect(find.byIcon(LucideIcons.plus), findsOneWidget);
  });

  testWidgets('a dish with something to choose shows a way to its options, not a plus', (tester) async {
    await tester.pumpWidget(_host(SizedBox(width: 400, child: dishFor(MenuItemLayout.row, _with(required: true))), style: _style()));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.byIcon(LucideIcons.plus), findsNothing);
    expect(find.byIcon(LucideIcons.chevronRight), findsOneWidget);
  });

  testWidgets('a sold-out dish has no button', (tester) async {
    await tester.pumpWidget(_host(SizedBox(width: 400, child: dishFor(MenuItemLayout.row, _with(available: false))), style: _style()));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.byIcon(LucideIcons.plus), findsNothing);
    expect(find.byIcon(LucideIcons.chevronRight), findsNothing);
  });

  test('surfaces: flat has no edge, outlined a hairline, shadow a lift that becomes a hairline in the dark', () {
    final light = NinjaColors.light;
    final dark = NinjaColors.dark;

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
    final plain = BrandStyle.plain;
    expect(plain.space, 1);
    expect(plain.copyWith(layout: plain.layout.copyWith(density: DensityLayout.airy)).space, 1.35);
    expect(plain.copyWith(layout: plain.layout.copyWith(density: DensityLayout.compact)).space, 0.7);
  });
}
