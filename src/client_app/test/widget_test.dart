import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:ninja_client/core/brand/brand_mark.dart';
import 'package:ninja_client/core/brand/brand_provider.dart';
import 'package:ninja_client/core/brand/brand_service.dart';
import 'package:ninja_client/core/brand/brand_theme.dart';
import 'package:ninja_client/core/brand/tenant_brand.dart';
import 'package:ninja_client/core/models/localized_text.dart';
import 'package:ninja_client/main.dart';

/// The tenant answering like Branch.API's GET /api/tenant
class _Tenant implements TenantRepository {
  final TenantBrand brand;

  const _Tenant([
    this.brand = const TenantBrand(
      name: LocalizedText(en: 'Chillax', ar: 'تشيلاكس'),
      primaryColorHex: '#0ea5e9',
      features: TenantFeatures(rooms: false),
    ),
  ]);

  @override
  Future<TenantBrand> getBrand() async => brand;
}

const _wordmark = TenantWordmark(url: 'https://api.test/api/tenant/images/wordmark-en?v=7', width: 600, height: 120);

void main() {
  // First, before anything has warmed the brand: a cold start is neutral
  test('the brand is neutral until the tenant answers, then the tenant\'s', () async {
    SharedPreferences.setMockInitialValues({});
    final container = ProviderContainer(
      overrides: [tenantRepositoryProvider.overrideWithValue(const _Tenant())],
    );
    addTearDown(container.dispose);

    final neutral = container.read(brandProvider);
    expect(neutral.displayName(const Locale('en')), 'Ninja');
    expect(neutral.primaryColor, isNull);
    expect(neutral.features.rooms, isTrue);

    await container.read(brandProvider.notifier).refresh();
    final brand = container.read(brandProvider);
    expect(brand.displayName(const Locale('ar')), 'تشيلاكس');
    expect(brand.primaryColor, const Color(0xFF0EA5E9));
    expect(brand.features.rooms, isFalse);
    expect(brand.features.loyalty, isTrue);
  });

  group('TenantBrand', () {
    test('a cache from an older build still parses', () {
      final brand = TenantBrand.fromJson({
        'name': {'en': 'Chillax'},
        'primaryColor': '#0ea5e9',
        'logoUrl': null,
        'features': {'rooms': false},
        'version': 3,
      });
      expect(brand.wordmarks, TenantWordmarks.none);
      expect(brand.theme, TenantTheme.neutral);
      expect(brand.theme.accent, isNull);
      expect(brand.theme.fontLatin, isNull);
      expect(brand.features.rooms, isFalse);
    });

    test('the API shape carries the wordmarks and the theme; the URLs are made absolute', () {
      final brand = TenantBrand.fromApi({
        'name': {'en': 'Chillax'},
        'primaryColor': '#0ea5e9',
        'logoUrl': '/api/tenant/images/logo?v=1',
        'logoDarkUrl': null,
        'wordmarks': {
          'en': {'url': '/api/tenant/images/wordmark-en?v=7', 'width': 600, 'height': 120},
          'enDark': null,
          'ar': null,
          'arDark': null,
        },
        'theme': {
          'accent': '#F59E0B',
          'surface': '#fffbf5',
          'radius': 'lg',
          'fontLatin': 'Poppins',
          'fontArabic': 'Tajawal',
          'dark': {'primary': null, 'accent': null, 'surface': '#1a1412'},
        },
        'features': {},
        'version': 7,
      }, baseUrl: 'https://api.test');

      expect(brand.logoUrl, 'https://api.test/api/tenant/images/logo?v=1');
      expect(brand.logoFor(Brightness.dark), brand.logoUrl);
      expect(brand.wordmarks.en, _wordmark);
      expect(brand.wordmarks.en!.aspectRatio, 5.0);
      expect(brand.theme.accentHex, '#f59e0b');
      expect(brand.theme.accent, const Color(0xFFF59E0B));
      expect(brand.theme.surface, const Color(0xFFFFFBF5));
      expect(brand.theme.radius, 'lg');
      expect(brand.theme.fontLatin, 'Poppins');
      expect(brand.theme.fontArabic, 'Tajawal');
      expect(brand.theme.dark?.surfaceHex, '#1a1412');
      expect(brand.theme.dark?.primary, isNull);

      // What the cache writes reads back the same
      expect(TenantBrand.fromJson(brand.toJson()), brand);
    });

    test('a radius or color off the allowlist is dropped, not kept', () {
      final theme = TenantTheme.fromJson({'accent': 'orange', 'radius': 'round', 'fontLatin': ' ', 'dark': {'surface': 'black'}});
      expect(theme, TenantTheme.neutral);
    });
  });

  group('theme tokens', () {
    const brand = TenantBrand(
      name: LocalizedText(en: 'Chillax'),
      primaryColorHex: '#0ea5e9',
      theme: TenantTheme(accentHex: '#f59e0b', surfaceHex: '#fffbf5', radius: 'xl'),
    );

    Color rgb(Color c) => Color.fromARGB(255, (c.r * 255).round(), (c.g * 255).round(), (c.b * 255).round());

    test('light: the seeds as given with text by contrast; dark: derived from the same seeds', () {
      final light = brandedColors(FThemes.zinc.light.colors, brand);
      expect(rgb(light.primary), const Color(0xFF0EA5E9));
      expect(rgb(light.secondary), const Color(0xFFF59E0B));
      expect(rgb(light.background), const Color(0xFFFFFBF5));
      // Amber is light: near-black ink on it, not white
      expect(Oklch.fromColor(light.secondaryForeground).l, lessThan(0.3));
      expect(contrastRatio(Oklch.fromColor(light.background), Oklch.fromColor(light.foreground)), greaterThan(10));

      final dark = brandedColors(FThemes.zinc.dark.colors, brand);
      // The dark page carries the surface's warm hue at night
      final page = Oklch.fromColor(dark.background);
      expect(page.l, closeTo(0.16, 0.01));
      expect(page.h, closeTo(Oklch.fromColor(const Color(0xFFFFFBF5)).h, 5));
      expect(Oklch.fromColor(dark.foreground).l, greaterThan(0.95));
      // The primary is lifted to read on that page
      expect(Oklch.fromColor(dark.primary).l, closeTo(0.74, 0.01));
      expect(Oklch.fromColor(dark.secondary).l, closeTo(0.32, 0.01));
    });

    test('the dark seeds replace what would be derived', () {
      const given = TenantBrand(
        name: LocalizedText(en: 'Chillax'),
        primaryColorHex: '#0ea5e9',
        theme: TenantTheme(dark: TenantThemeDark(primaryHex: '#7dd3fc', surfaceHex: '#1a1412')),
      );
      final dark = brandedColors(FThemes.zinc.dark.colors, given);
      expect(rgb(dark.primary), const Color(0xFF7DD3FC));
      expect(Oklch.fromColor(dark.background).l, closeTo(Oklch.fromColor(const Color(0xFF1A1412)).l, 0.01));
      // And the light scheme is untouched by them
      expect(brandedColors(FThemes.zinc.light.colors, given).background, FThemes.zinc.light.colors.background);
    });

    test('a colour survives the trip through OKLCH', () {
      for (final hex in [0xFF0EA5E9, 0xFFF59E0B, 0xFF18181B, 0xFFFFFFFF]) {
        expect(rgb(Oklch.fromColor(Color(hex)).toColor()), Color(hex));
      }
    });

    test('nothing set leaves zinc untouched', () {
      expect(brandedColors(FThemes.zinc.light.colors, TenantBrand.neutral), FThemes.zinc.light.colors);
      expect(brandedStyle(FThemes.zinc.light.style, null), FThemes.zinc.light.style);
    });

    test('the radius token sets the style\'s corners', () {
      expect(brandRadius('none'), 0);
      expect(brandRadius('md'), 10);
      expect(brandRadius('xl'), 24);
      expect(brandRadius('round'), isNull);
      final style = brandedStyle(FThemes.zinc.light.style, 'lg');
      expect(style.borderRadius.topLeft, const Radius.circular(16));
    });

    test('a font google_fonts does not know falls back silently, and each script gets its own', () {
      expect(brandFontFamily('Poppins'), 'Poppins');
      expect(brandFontFamily('Comic Sans MS'), isNull);
      expect(brandFontFamily(null), isNull);
      const theme = TenantTheme(fontLatin: 'Poppins', fontArabic: 'Tajawal');
      expect(brandFontFor(theme, const Locale('en')), 'Poppins');
      expect(brandFontFor(theme, const Locale('ar')), 'Tajawal');
      expect(brandFontFor(const TenantTheme(fontLatin: 'Poppins'), const Locale('ar')), isNull);
    });
  });

  testWidgets('the wordmark renders in its own aspect ratio when the tenant has one', (tester) async {
    SharedPreferences.setMockInitialValues({});
    const tenant = _Tenant(TenantBrand(name: LocalizedText(en: 'Chillax'), wordmarks: TenantWordmarks(en: _wordmark)));
    await tester.pumpWidget(
      ProviderScope(
        overrides: [tenantRepositoryProvider.overrideWithValue(tenant)],
        child: const MaterialApp(home: Scaffold(body: Center(child: BrandWordmark(height: 56)))),
      ),
    );
    await tester.pumpAndSettle();

    final box = tester.widget<AspectRatio>(find.byType(AspectRatio));
    expect(box.aspectRatio, 5.0);
    final image = tester.widget<Image>(find.byType(Image));
    expect((image.image as NetworkImage).url, _wordmark.url);
    // No taller than asked, as wide as the ratio makes it
    expect(tester.getSize(find.byType(AspectRatio)), const Size(280, 56));
  });

  test('the wordmark falls back from Arabic dark to Arabic to English dark to English', () {
    const en = TenantWordmark(url: 'https://x/en', width: 5, height: 1);
    const enDark = TenantWordmark(url: 'https://x/en-dark', width: 5, height: 1);
    const ar = TenantWordmark(url: 'https://x/ar', width: 5, height: 1);
    const arabic = Locale('ar');
    const english = Locale('en');

    const all = TenantWordmarks(en: en, enDark: enDark, ar: ar);
    expect(all.resolve(arabic, Brightness.dark), ar);
    expect(all.resolve(arabic, Brightness.light), ar);
    expect(all.resolve(english, Brightness.dark), enDark);
    expect(all.resolve(english, Brightness.light), en);

    const onlyEnglish = TenantWordmarks(en: en);
    expect(onlyEnglish.resolve(arabic, Brightness.dark), en);
    expect(TenantWordmarks.none.resolve(arabic, Brightness.dark), isNull);
  });

  testWidgets('without a wordmark the mark and the name stand in', (tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(
      ProviderScope(
        overrides: [tenantRepositoryProvider.overrideWithValue(const _Tenant())],
        child: const MaterialApp(
          home: Scaffold(body: Center(child: BrandWordmark(height: 56, nameStyle: TextStyle(fontSize: 18)))),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(AspectRatio), findsNothing);
    expect(find.byType(BrandMark), findsOneWidget);
    // The name in the app's language, which starts out Arabic
    expect(find.text('تشيلاكس'), findsOneWidget);
  });

  testWidgets('App renders without errors', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(
      ProviderScope(
        overrides: [tenantRepositoryProvider.overrideWithValue(const _Tenant())],
        child: const NinjaApp(),
      ),
    );

    expect(find.byType(NinjaApp), findsOneWidget);
  });
}
