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

MenuItem _dish(int id) => MenuItem(
  id: id,
  name: LocalizedText(en: 'Dish $id'),
  description: const LocalizedText(en: ''),
  price: 50,
  catalogTypeId: 1,
  catalogTypeName: const LocalizedText(en: 'Coffee'),
);


late ProviderContainer _container;

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
                child: DockCover(height: dockHeight, child: const MenuScreen()),
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
      MenuCategory(id: c, name: LocalizedText(en: 'Cat $c')): [for (var i = 0; i < 6; i++) _dish(++id)],
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
  for (final platform in [TargetPlatform.iOS, TargetPlatform.android]) {
    testWidgets('a fling to the end settles without shaking (${platform.name})', (tester) async {
      SharedPreferences.setMockInitialValues({hintsStorageKey: ['swipe', 'zoom', 'holdAdd']});
      await tester.binding.setSurfaceSize(const Size(390, 844));
      addTearDown(() => tester.binding.setSurfaceSize(null));
      await tester.pumpWidget(_host(platform));
      await tester.pump(const Duration(milliseconds: 800));
      final last = find.text('Dish 48');
      var ends = 0;
      // Flings down until the end is reached: each one that tucks the dock and comes to the end is watched
      for (var k = 0; k < 5; k++) {
        // The dock's quiet window after it moves runs on the wall clock
        await tester.runAsync(() => Future<void>.delayed(const Duration(milliseconds: 350)));
        await tester.fling(find.byType(MenuScreen), const Offset(0, -900), 6000);
        double? was;
        var tucked = false;
        var back = false;
        for (var f = 0; f < 360; f++) {
          await tester.pump(const Duration(milliseconds: 16));
          if (_container.read(dockTuckProvider)) tucked = true;
          if (last.evaluate().isEmpty) continue;
          final y = tester.getTopLeft(last).dy;
          // Once the dock is coming back the page only goes up with it, and the top bar stays up
          if (tucked && !_container.read(dockTuckProvider)) {
            if (back && was != null) expect(y, lessThanOrEqualTo(was + 0.5), reason: 'frame $f of fling $k moved the page back down');
            back = true;
            expect(_container.read(topBarHiddenProvider), isTrue, reason: 'the bar came back at the end');
          }
          was = y;
        }
        if (back) ends++;
      }
      expect(ends, greaterThan(0), reason: 'no fling reached the end');
      expect(_container.read(dockTuckProvider), isFalse);
      await tester.pumpWidget(const SizedBox());
      await tester.pump(const Duration(seconds: 3));
    });
  }
}
