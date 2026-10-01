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
import 'package:ninja_client/core/shell/deck_compact.dart';
import 'package:ninja_client/core/shell/tuck.dart';
import 'package:ninja_client/core/ui/gesture_hint.dart';
import 'package:ninja_client/core/ui/ui.dart';
import 'package:ninja_client/core/utils/money.dart';
import 'package:ninja_client/features/menu/models/menu_item.dart';
import 'package:ninja_client/features/menu/providers/favorites_provider.dart';
import 'package:ninja_client/features/menu/screens/menu_screen.dart';
import 'package:ninja_client/features/menu/services/menu_service.dart';
import 'package:ninja_client/features/menu/widgets/deck.dart';
import 'package:ninja_client/features/menu/widgets/zoom_flight.dart';
import 'package:ninja_client/l10n/app_localizations.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// The menu's deck as a whole (client_web's menu-screen.tsx): the
/// first-visit cues each shown once, a pinch out to the whole menu and back,
/// and the chrome going compact past the first card.

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

Widget _host({bool reduced = false}) {
  final plain = BrandStyle.plain;
  final style = plain.copyWith(layout: plain.layout.copyWith(menuItem: MenuItemLayout.deck));
  final menu = {
    MenuCategory(id: 1, name: const LocalizedText(en: 'Coffee')): [_dish(1), _dish(2), _dish(3)],
    MenuCategory(id: 2, name: const LocalizedText(en: 'Tea')): [_dish(4), _dish(5)],
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
      home: MediaQuery(
        data: MediaQueryData(size: const Size(390, 844), disableAnimations: reduced),
        child: const Scaffold(body: MenuScreen()),
      ),
    ),
  );
}

Future<void> _pinch(WidgetTester tester, {required double from, required double to}) async {
  final centre = tester.getCenter(find.byType(Deck).evaluate().isEmpty ? find.byType(MenuScreen) : find.byType(Deck));
  final a = await tester.startGesture(centre - Offset(from / 2, 0), pointer: 11);
  final b = await tester.startGesture(centre + Offset(from / 2, 0), pointer: 12);
  for (var i = 1; i <= 5; i++) {
    final d = from + (to - from) * i / 5;
    await a.moveTo(centre - Offset(d / 2, 0));
    await b.moveTo(centre + Offset(d / 2, 0));
  }
  await a.up();
  await b.up();
}

void main() {
  setUp(() {
    hintBook.reset();
    cueOnScreen.value = null;
  });

  testWidgets('a first visit is shown the swipe, then the pinch, each once', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(_host());
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.byType(Deck), findsOneWidget);
    expect(find.text('Swipe up for more, sideways for other categories'), findsNothing);

    // Once the deck has sat idle a moment
    await tester.pump(const Duration(milliseconds: 1500));
    expect(find.text('Swipe up for more, sideways for other categories'), findsOneWidget);
    expect(find.byType(GestureHint), findsOneWidget);

    // It runs its course, then the next one waits its turn
    await tester.pump(gestureShown(GestureKind.swipe));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Swipe up for more, sideways for other categories'), findsNothing);
    await tester.pump(const Duration(milliseconds: 1500));
    expect(find.text('Pinch or tap the grid to see everything'), findsOneWidget);
    await tester.pump(gestureShown(GestureKind.pinch));
    await tester.pump(const Duration(milliseconds: 400));

    // Then "hold to add", on the card in view (it needs no choosing)
    await tester.pump(const Duration(milliseconds: 1500));
    expect(find.text('Hold to add'), findsOneWidget);
    await tester.pump(gestureShown(GestureKind.hold));
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Hold to add'), findsNothing);

    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getStringList(hintsStorageKey), containsAll(['swipe', 'zoom', 'holdAdd']));

    // Coming back, none is shown again
    await tester.pumpWidget(const SizedBox());
    hintBook.reset();
    await tester.pumpWidget(_host());
    await tester.pump(const Duration(seconds: 3));
    expect(find.byType(GestureHint), findsNothing);
    expect(find.byType(HintBubble), findsNothing);
  });

  testWidgets('two fingers closing on the cards zoom out to the whole menu, opening there zoom back in', (tester) async {
    SharedPreferences.setMockInitialValues({
      hintsStorageKey: ['swipe', 'zoom', 'holdAdd'],
    });
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(_host());
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.text('Whole menu'), findsNothing);

    await _pinch(tester, from: 300, to: 120);
    await tester.pumpAndSettle();
    expect(find.byType(Deck), findsNothing);
    expect(find.text('Whole menu'), findsOneWidget);

    await _pinch(tester, from: 120, to: 300);
    await tester.pumpAndSettle();
    expect(find.byType(Deck), findsOneWidget);
    expect(find.text('Whole menu'), findsNothing);
    expect(tester.takeException(), isNull);
  });

  testWidgets("zooming out, both views are on screen while the cards' photos fly to their tiles", (tester) async {
    SharedPreferences.setMockInitialValues({
      hintsStorageKey: ['swipe', 'zoom', 'holdAdd'],
    });
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(_host());
    await tester.pump(const Duration(milliseconds: 400));
    await _pinch(tester, from: 300, to: 120);
    // Both views on screen for the move
    await tester.pump();
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 50));
    expect(find.byType(Deck), findsOneWidget);
    expect(find.text('Whole menu'), findsOneWidget);
    // The card in view and the one peeking under it, each flying to its tile
    final flights = tester.widget<ZoomFlights>(find.byType(ZoomFlights)).flights;
    expect(flights.map((f) => f.item.id), [1, 2]);
    expect(flights.first.from.height, greaterThan(flights.first.to.height));
    await tester.pumpAndSettle();
    expect(find.byType(ZoomFlights), findsNothing);
    expect(find.byType(Deck), findsNothing);
  });

  testWidgets('under reduced motion the zoom is a cut and the cues are words alone', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(_host(reduced: true));
    await tester.pump(const Duration(milliseconds: 400));
    await tester.pump(const Duration(milliseconds: 1500));
    expect(find.text('Swipe up for more, sideways for other categories'), findsOneWidget);
    // No fingertip acts it out
    expect(find.byType(CustomPaint).evaluate().where((e) => e.findAncestorWidgetOfExactType<GestureHint>() != null), isEmpty);
    await tester.pump(gestureShown(GestureKind.swipe));

    await _pinch(tester, from: 300, to: 120);
    await tester.pump();
    expect(find.byType(Deck), findsNothing);
    expect(find.text('Whole menu'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 6));
  });

  testWidgets('past the first card the chrome goes compact, and the first card brings it back', (tester) async {
    SharedPreferences.setMockInitialValues({
      hintsStorageKey: ['swipe', 'zoom', 'holdAdd'],
    });
    await tester.binding.setSurfaceSize(const Size(390, 844));
    addTearDown(() => tester.binding.setSurfaceSize(null));
    await tester.pumpWidget(_host());
    await tester.pump(const Duration(milliseconds: 400));
    expect(_container.read(deckCompactProvider), isFalse);

    await tester.fling(find.text('Dish 1'), const Offset(0, -400), 2000);
    await tester.pumpAndSettle();
    expect(_container.read(deckCompactProvider), isTrue);
    // Swiping on folds the dock's tabs
    expect(_container.read(dockTuckProvider), isTrue);
    await tester.fling(find.text('Dish 2'), const Offset(0, -400), 2000);
    await tester.pumpAndSettle();
    expect(_container.read(dockTuckProvider), isTrue);

    // A card back asks the tabs back, the chrome staying compact
    await tester.fling(find.text('Dish 3'), const Offset(0, 400), 2000);
    await tester.pumpAndSettle();
    expect(_container.read(deckCompactProvider), isTrue);
    expect(_container.read(dockTuckProvider), isFalse);

    // The first card brings the chrome back
    await tester.fling(find.text('Dish 2'), const Offset(0, 400), 2000);
    await tester.pumpAndSettle();
    expect(_container.read(deckCompactProvider), isFalse);
    expect(_container.read(dockTuckProvider), isFalse);
  });
}
