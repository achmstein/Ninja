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
import 'package:ninja_client/core/shell/top_bar.dart';
import 'package:ninja_client/core/shell/tuck.dart';
import 'package:ninja_client/core/ui/gesture_hint.dart';
import 'package:ninja_client/core/ui/ui.dart';
import 'package:ninja_client/core/utils/money.dart';
import 'package:ninja_client/features/menu/models/menu_item.dart';
import 'package:ninja_client/features/menu/providers/favorites_provider.dart';
import 'package:ninja_client/features/menu/screens/menu_screen.dart';
import 'package:ninja_client/features/menu/services/menu_service.dart';
import 'package:ninja_client/l10n/app_localizations.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// A fast fling to the menu's end (main_scaffold.dart's chrome around it):
/// the page settles one way and never shakes, on iOS's bounce and Android's
/// stop. The dock coming back at the end glides the list's end up with it. (client_web's menu-screen.tsx): the
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

MenuItem _item(int id) => MenuItem(
  id: id,
  name: LocalizedText(en: 'Item $id'),
  description: const LocalizedText(en: ''),
  price: 50,
  catalogTypeId: 1,
  catalogTypeName: const LocalizedText(en: 'Coffee'),
);


late ProviderContainer _container;

/// Another tab in the menu's place (the booking page), a page longer than the screen
final _onBooking = ValueNotifier(false);
final _bookingScroll = ScrollController();

class _Booking extends StatelessWidget {
  const _Booking();
  @override
  Widget build(BuildContext context) => ListView(
    controller: _bookingScroll,
    padding: EdgeInsets.only(bottom: MediaQuery.paddingOf(context).bottom),
    children: [for (var i = 0; i < 30; i++) SizedBox(height: 80, child: Text('Place $i'))],
  );
}

/// Flings the menu down until a fling reaches its end and the dock has come back there, checking every
/// frame on the way: once the dock is coming back the page only goes up with it, the top bar stays up,
/// and the list runs to the page's bottom whatever the dock does (its height never follows the tuck)
Future<int> _flingToEnd(WidgetTester tester) async {
  final last = find.text('Item 48');
  final list = find.descendant(of: find.byType(MenuScreen), matching: find.byType(Scrollable)).first;
  var ends = 0;
  for (var k = 0; k < 5; k++) {
    // The dock's quiet window after it moves runs on the wall clock
    await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 350)));
    await tester.fling(find.byType(MenuScreen), const Offset(0, -900), 6000);
    double? was;
    var tucked = false;
    var back = false;
    for (var f = 0; f < 360; f++) {
      await tester.pump(const Duration(milliseconds: 16));
      expect(tester.getBottomLeft(list).dy, tester.getBottomLeft(find.byType(MenuScreen)).dy, reason: 'frame $f of fling $k: the list follows the dock');
      if (_container.read(dockTuckProvider)) tucked = true;
      if (last.evaluate().isEmpty) continue;
      final y = tester.getTopLeft(last).dy;
      if (tucked && !_container.read(dockTuckProvider)) {
        if (back && was != null) expect(y, lessThanOrEqualTo(was + 0.5), reason: 'frame $f of fling $k moved the page back down');
        back = true;
        expect(_container.read(topBarHiddenProvider), isTrue, reason: 'the bar came back at the end');
      }
      was = y;
    }
    if (back) ends++;
  }
  return ends;
}

/// The shell's part that moves with a scroll (main_scaffold.dart): the top bar's slot above the page,
/// the dock's room under it, tucking and coming back
class _Shell extends ConsumerWidget {
  const _Shell();
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final media = MediaQuery.of(context);
    final tucked = ref.watch(dockTuckProvider);
    final dockHeight = tucked ? 68.0 + 0 : 68.0 + 56 + 8;
    return TuckOnScroll(
      child: TopBarOnScroll(
        child: Column(
          children: [
            const TopBarSlot(),
            Expanded(
              child: MediaQuery(
                data: media.copyWith(padding: media.padding.copyWith(top: 0, bottom: 68.0 + 56 + 8)),
                child: DockCover(
                  height: dockHeight,
                  child: ValueListenableBuilder<bool>(
                    valueListenable: _onBooking,
                    builder: (context, booking, _) => booking ? const _Booking() : const MenuScreen(),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

Widget _host(TargetPlatform platform) {
  final plain = BrandStyle.plain;
  final style = plain.copyWith(layout: plain.layout.copyWith(menuItem: MenuItemLayout.row));
  var id = 0;
  final menu = {
    for (var c = 1; c <= 8; c++)
      MenuCategory(id: c, name: LocalizedText(en: 'Cat $c')): [for (var i = 0; i < 6; i++) _item(++id)],
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
      theme: materialThemeFor(NinjaTheme.neutral(Brightness.light), extensions: [style]).copyWith(platform: platform),
      home: const MediaQuery(
        data: MediaQueryData(size: Size(390, 844)),
        child: Scaffold(body: _Shell()),
      ),
    ),
  );
}

void main() {
  setUp(() {
    _onBooking.value = false;
    SharedPreferences.setMockInitialValues({hintsStorageKey: ['swipe', 'zoom', 'holdAdd']});
  });

  for (final platform in [TargetPlatform.iOS, TargetPlatform.android]) {
    testWidgets('a fling to the end settles without shaking (${platform.name})', (tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.pumpWidget(_host(platform));
      await tester.pump(const Duration(milliseconds: 800));
      expect(await _flingToEnd(tester), greaterThan(0), reason: 'no fling reached the end');
      expect(_container.read(dockTuckProvider), isFalse);
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(seconds: 3));
    });

    // The shell outlives its pages: that the menu was last read at its end once jumped the next page to
    // its own end on every frame of the top bar coming back
    testWidgets('the page opened after the menu\'s end stays where it starts (${platform.name})', (tester) async {
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.pumpWidget(_host(platform));
      await tester.pump(const Duration(milliseconds: 800));
      expect(await _flingToEnd(tester), greaterThan(0), reason: 'no fling reached the end');
      // Another tab: it starts with its bar (main_scaffold.dart)
      _onBooking.value = true;
      _container.read(topBarHiddenProvider.notifier).set(false);
      for (var f = 0; f < 60; f++) {
        await tester.pump(const Duration(milliseconds: 16));
        expect(_bookingScroll.offset, 0, reason: 'frame $f moved the booking page');
      }
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(seconds: 3));
    });
  }
}
