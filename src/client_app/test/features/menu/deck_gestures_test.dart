import 'package:flutter/gestures.dart';
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
import 'package:ninja_client/core/ui/ui.dart';
import 'package:ninja_client/core/utils/money.dart';
import 'package:ninja_client/features/menu/models/menu_item.dart';
import 'package:ninja_client/features/menu/providers/favorites_provider.dart';
import 'package:ninja_client/features/menu/widgets/deck.dart';
import 'package:ninja_client/features/menu/widgets/pinch.dart';
import 'package:ninja_client/features/menu/widgets/zoom_flight.dart';
import 'package:ninja_client/l10n/app_localizations.dart';

/// The deck's gestures (client_web's deck-model.ts pinchIntent, deck.tsx,
/// menu-screen.tsx's zoom): two fingers closing or opening past the
/// threshold, the deck opening on the card it was on and telling which card
/// it rests on, and a zoom's photos planned from each card to its tile.

class _NoFavorites extends FavoritesNotifier {
  @override
  FavoritesState build() => const FavoritesState();
}

class _NoBranches extends BranchNotifier {
  @override
  BranchState build() => const BranchState();
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

Widget _host(Widget child) {
  final plain = BrandStyle.plain;
  final style = plain.copyWith(layout: plain.layout.copyWith(menuItem: MenuItemLayout.deck));
  return ProviderScope(
    overrides: [
      moneyProvider.overrideWithValue(MoneyFormat('EGP', const Locale('en'))),
      favoritesProvider.overrideWith(_NoFavorites.new),
      branchProvider.overrideWith(_NoBranches.new),
      brandProvider.overrideWith(_Brand.new),
      localeProvider.overrideWith(_Locale.new),
    ],
    child: MaterialApp(
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: materialThemeFor(NinjaTheme.neutral(Brightness.light), extensions: [style]),
      home: Scaffold(body: child),
    ),
  );
}

void main() {
  group('pinchIntent', () {
    test('closing to 78 % of the start zooms out, and not before', () {
      expect(pinchIntent(200, 156), Pinch.close);
      expect(pinchIntent(200, 120), Pinch.close);
      expect(pinchIntent(200, 160), isNull);
    });

    test('opening past the inverse zooms in, and not before', () {
      expect(pinchIntent(200, 200 / pinchOut + 0.01), Pinch.open);
      expect(pinchIntent(200, 250), isNull);
      expect(pinchIntent(200, 400), Pinch.open);
    });

    test('no start distance asks for nothing', () {
      expect(pinchIntent(0, 100), isNull);
      expect(pinchIntent(-5, 100), isNull);
    });
  });

  group('PinchWatch', () {
    Future<int> pinch(WidgetTester tester, Pinch watch, {required double from, required double to}) async {
      var pinched = 0;
      await tester.pumpWidget(
        Directionality(
          textDirection: TextDirection.ltr,
          child: PinchWatch(
            watch: watch,
            onPinch: () => pinched++,
            child: const ColoredBox(color: Color(0x00000000), child: SizedBox.expand()),
          ),
        ),
      );
      final centre = tester.getCenter(find.byType(ColoredBox));
      final a = await tester.startGesture(centre - Offset(from / 2, 0), pointer: 1);
      final b = await tester.startGesture(centre + Offset(from / 2, 0), pointer: 2);
      // In steps, past the threshold and on: it fires once a pinch
      for (var i = 1; i <= 5; i++) {
        final d = from + (to - from) * i / 5;
        await a.moveTo(centre - Offset(d / 2, 0));
        await b.moveTo(centre + Offset(d / 2, 0));
      }
      await a.up();
      await b.up();
      return pinched;
    }

    testWidgets('two fingers closing zoom out once', (tester) async {
      expect(await pinch(tester, Pinch.close, from: 300, to: 120), 1);
    });

    testWidgets('two fingers opening do not zoom out', (tester) async {
      expect(await pinch(tester, Pinch.close, from: 120, to: 300), 0);
    });

    testWidgets('two fingers opening zoom in once', (tester) async {
      expect(await pinch(tester, Pinch.open, from: 120, to: 300), 1);
    });

    testWidgets('a small pinch is not a zoom', (tester) async {
      expect(await pinch(tester, Pinch.close, from: 300, to: 250), 0);
    });

    testWidgets('one finger dragging is a swipe, never a pinch', (tester) async {
      var pinched = 0;
      await tester.pumpWidget(
        Directionality(
          textDirection: TextDirection.ltr,
          child: PinchWatch(
            watch: Pinch.close,
            onPinch: () => pinched++,
            child: const ColoredBox(color: Color(0x00000000), child: SizedBox.expand()),
          ),
        ),
      );
      await tester.dragFrom(const Offset(200, 400), const Offset(0, -300));
      expect(pinched, 0);
    });

    testWidgets("a trackpad's pinch counts", (tester) async {
      var pinched = 0;
      await tester.pumpWidget(
        Directionality(
          textDirection: TextDirection.ltr,
          child: PinchWatch(
            watch: Pinch.close,
            onPinch: () => pinched++,
            child: const ColoredBox(color: Color(0x00000000), child: SizedBox.expand()),
          ),
        ),
      );
      final pad = TestPointer(1, PointerDeviceKind.trackpad);
      await tester.sendEventToBinding(pad.panZoomStart(const Offset(200, 300)));
      await tester.sendEventToBinding(pad.panZoomUpdate(const Offset(200, 300), scale: 0.9));
      expect(pinched, 0);
      await tester.sendEventToBinding(pad.panZoomUpdate(const Offset(200, 300), scale: 0.7));
      await tester.sendEventToBinding(pad.panZoomUpdate(const Offset(200, 300), scale: 0.6));
      await tester.sendEventToBinding(pad.panZoomEnd());
      expect(pinched, 1);
    });
  });

  group('the deck', () {
    final columns = [
      DeckColumn(id: 'c0', label: 'Coffee', usuals: false, tone: PosterTone.primary, items: [_dish(1), _dish(2), _dish(3)]),
      DeckColumn(id: 'c1', label: 'Tea', usuals: false, tone: PosterTone.secondary, items: [_dish(4), _dish(5)]),
    ];

    testWidgets('opens each column on the card it was on, and tells the card it comes to rest on', (tester) async {
      final rested = <(int, int)>[];
      await tester.pumpWidget(
        _host(
          SizedBox(
            width: 390,
            height: 700,
            child: Deck(columns: columns, column: 0, onColumnChange: (_) {}, rows: const {0: 1}, onRowChange: (c, r) => rested.add((c, r))),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 400));
      expect(tester.takeException(), isNull);
      // On its second card, the third peeking under it
      final second = tester.getRect(find.text('Dish 2'));
      expect(second.top, lessThan(700));
      expect(find.text('Dish 1'), findsNothing);

      await tester.fling(find.text('Dish 2'), const Offset(0, -400), 2000);
      await tester.pumpAndSettle();
      expect(rested, contains((0, 2)));
    });

    testWidgets('the one-time "hold to add" cue sits on its card', (tester) async {
      await tester.pumpWidget(
        _host(
          SizedBox(
            width: 390,
            height: 700,
            child: Deck(columns: columns, column: 0, onColumnChange: (_) {}, holdHintId: 1),
          ),
        ),
      );
      await tester.pump(const Duration(milliseconds: 400));
      // Its words beside the ring, on the card it is about and no other
      expect(find.text('Hold to add'), findsOneWidget);
      expect(tester.getRect(find.text('Hold to add')).top, lessThan(tester.getRect(find.text('Dish 1')).top));
    });
  });

  group('zoom flights', () {
    test('a flight carries its frame and corner across, and hands over in its last fifth', () {
      final f = ZoomFlight(item: _dish(1), from: const Rect.fromLTWH(0, 0, 300, 500), to: const Rect.fromLTWH(20, 40, 100, 125), fromRadius: 28, toRadius: 18);
      expect(f.rectAt(0), f.from);
      expect(f.rectAt(1), f.to);
      expect(f.rectAt(0.5), const Rect.fromLTWH(10, 20, 200, 312.5));
      expect(f.radiusAt(0.5), 23);
      // The spring's overshoot never carries it past its end
      expect(f.rectAt(1.02), f.to);
      expect(ZoomFlight.opacityAt(0.5), 1);
      expect(ZoomFlight.opacityAt(0.9), closeTo(0.5, 1e-9));
      expect(ZoomFlight.opacityAt(1), 0);
    });

    testWidgets('each card in view flies to its own tile', (tester) async {
      final room = GlobalKey();
      final item = _dish(1);
      final other = _dish(2);
      await tester.pumpWidget(
        Directionality(
          textDirection: TextDirection.ltr,
          child: Stack(
            key: room,
            children: [
              Positioned(
                left: 16,
                top: 12,
                width: 300,
                height: 500,
                child: ZoomPhotoAnchor(view: ZoomView.deck, item: item, radius: cardRadius, child: const SizedBox.expand()),
              ),
              // A card out of view flies nowhere
              Positioned(
                left: 16,
                top: 2000,
                width: 300,
                height: 500,
                child: ZoomPhotoAnchor(view: ZoomView.deck, item: other, radius: cardRadius, child: const SizedBox.expand()),
              ),
              Positioned(
                left: 120,
                top: 300,
                width: 100,
                height: 125,
                child: ZoomPhotoAnchor(view: ZoomView.grid, item: item, radius: 18, child: const SizedBox.expand()),
              ),
              Positioned(
                left: 230,
                top: 300,
                width: 100,
                height: 125,
                child: ZoomPhotoAnchor(view: ZoomView.grid, item: other, radius: 18, child: const SizedBox.expand()),
              ),
            ],
          ),
        ),
      );
      final box = room.currentContext!.findRenderObject()! as RenderBox;

      final out = ZoomPhotos.plan(ZoomView.deck, box);
      expect(out, hasLength(1));
      expect(out.single.item.id, 1);
      expect(out.single.from, const Rect.fromLTWH(16, 12, 300, 500));
      expect(out.single.to, const Rect.fromLTWH(120, 300, 100, 125));
      expect(out.single.fromRadius, cardRadius);
      expect(out.single.toRadius, 18);

      // Back in, the other way round
      final back = ZoomPhotos.plan(ZoomView.grid, box);
      expect(back.single.from, const Rect.fromLTWH(120, 300, 100, 125));
      expect(back.single.to, const Rect.fromLTWH(16, 12, 300, 500));
    });
  });
}
