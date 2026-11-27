import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:ninja_app_core/brand/brand_service.dart';
import 'package:ninja_app_core/brand/tenant_brand.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:pos_app/l10n/app_localizations.dart';

/// Both languages the till speaks: Arabic words are the longer ones, and its
/// rows run the other way
const phoneLocales = [Locale('en'), Locale('ar')];

/// The narrowest phone the till is laid out for, upright
Future<void> usePhone(WidgetTester tester) async {
  tester.view.physicalSize = const Size(360, 780);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
}

/// The bundled fonts, so widths are the device's and not the test font's
/// (which draws every glyph a full em wide and overflows narrow rows)
Future<void> loadTillFonts() async {
  for (final family in ['Inter', 'Alexandria']) {
    final loader = FontLoader(family);
    for (final weight in ['Regular', 'Medium', 'SemiBold', 'Bold']) {
      loader.addFont(rootBundle.load('assets/fonts/$family-$weight.ttf'));
    }
    await loader.load();
  }
}

class _Tenant implements TenantRepository {
  @override
  Future<TenantBrand> getBrand() async => TenantBrand.neutral;
}

/// [home] in the till's theme and language, on a branch, as the app wraps it.
/// [home] is built under the navigator, so it can open dialogs and pages.
Widget tillApp(Widget home, {Locale locale = const Locale('en'), List overrides = const []}) => ProviderScope(
      overrides: [
        selectedBranchIdProvider.overrideWithValue(1),
        tenantRepositoryProvider.overrideWithValue(_Tenant()),
        ...overrides,
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
        builder: (context, child) => FTheme(
          data: const ThemeState(themeMode: AppThemeMode.light).getForuiTheme(context, locale: locale),
          // (a few dialogs use ink wells, which only assert for a Material above them)
          child: Material(type: MaterialType.transparency, child: FToaster(child: child!)),
        ),
        home: Scaffold(body: home),
      ),
    );

/// The same, on the till's router: for a screen that goes on to another one
Widget tillRouterApp(GoRouter router, {Locale locale = const Locale('en'), List overrides = const []}) => ProviderScope(
      overrides: [
        selectedBranchIdProvider.overrideWithValue(1),
        tenantRepositoryProvider.overrideWithValue(_Tenant()),
        ...overrides,
      ],
      child: MaterialApp.router(
        routerConfig: router,
        locale: locale,
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        builder: (context, child) => FTheme(
          data: const ThemeState(themeMode: AppThemeMode.light).getForuiTheme(context, locale: locale),
          child: Material(type: MaterialType.transparency, child: FToaster(child: child!)),
        ),
      ),
    );

/// A button that opens whatever [open] shows, for dialogs and pushed pages
Widget opener(Future<void> Function(BuildContext context) open) => Builder(
      builder: (context) => Center(
        child: TextButton(onPressed: () => open(context), child: const Text('open')),
      ),
    );

/// Nothing ran over its edge or threw while laying out. The exception taken
/// here only says by how many pixels; run with `--dart-define=LOUD=true` to
/// leave it for the framework, which prints the row, what it is in and how
/// wide it was allowed to be.
void expectFits(WidgetTester tester, {String? reason}) {
  if (const bool.fromEnvironment('LOUD')) return;
  expect(tester.takeException(), isNull, reason: reason);
}

/// The words [label] are all on screen: not cut short with an ellipsis
void expectWhole(WidgetTester tester, String label) {
  final paragraph = tester.renderObject<RenderParagraph>(
    find.descendant(of: find.text(label), matching: find.byType(RichText)).first,
  );
  expect(paragraph.didExceedMaxLines, isFalse, reason: '"$label" is cut short');
}
