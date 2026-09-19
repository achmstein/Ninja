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
      expect(brand.theme.font, isNull);
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
          'background': '#fffbf5',
          'foreground': null,
          'radius': 'lg',
          'font': 'Poppins',
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
      expect(brand.theme.background, const Color(0xFFFFFBF5));
      expect(brand.theme.foreground, isNull);
      expect(brand.theme.radius, 'lg');
      expect(brand.theme.font, 'Poppins');

      // What the cache writes reads back the same
      expect(TenantBrand.fromJson(brand.toJson()), brand);
    });

    test('a radius or color off the allowlist is dropped, not kept', () {
      final theme = TenantTheme.fromJson({'accent': 'orange', 'radius': 'round', 'font': ' '});
      expect(theme, TenantTheme.neutral);
    });
  });

  group('theme tokens', () {
    const brand = TenantBrand(
      name: LocalizedText(en: 'Chillax'),
      primaryColorHex: '#0ea5e9',
      theme: TenantTheme(accentHex: '#f59e0b', backgroundHex: '#fffbf5', foregroundHex: '#1c1917', radius: 'xl'),
    );

    test('light: the tenant colors as given; dark: keeps the zinc page and lifts the fills', () {
      final light = brandedColors(FThemes.zinc.light.colors, brand);
      expect(light.primary, const Color(0xFF0EA5E9));
      expect(light.secondary, const Color(0xFFF59E0B));
      expect(light.background, const Color(0xFFFFFBF5));
      expect(light.foreground, const Color(0xFF1C1917));

      final dark = brandedColors(FThemes.zinc.dark.colors, brand);
      expect(dark.background, FThemes.zinc.dark.colors.background);
      expect(dark.foreground, FThemes.zinc.dark.colors.foreground);
      // Lifted to 0.72, give or take 8-bit rounding on the way back to a Color
      expect(HSLColor.fromColor(dark.primary).lightness, closeTo(0.72, 0.005));
      expect(HSLColor.fromColor(dark.secondary).lightness, closeTo(0.30, 0.01));
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

    test('a font google_fonts does not know falls back silently', () {
      expect(brandFontFamily('Poppins'), 'Poppins');
      expect(brandFontFamily('Comic Sans MS'), isNull);
      expect(brandFontFamily(null), isNull);
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
