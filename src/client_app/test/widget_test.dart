import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:ninja_client/core/brand/brand_provider.dart';
import 'package:ninja_client/core/brand/brand_service.dart';
import 'package:ninja_client/core/brand/tenant_brand.dart';
import 'package:ninja_client/core/models/localized_text.dart';
import 'package:ninja_client/main.dart';

/// The tenant answering like Branch.API's GET /api/tenant
class _Tenant implements TenantRepository {
  @override
  Future<TenantBrand> getBrand() async => const TenantBrand(
        name: LocalizedText(en: 'Chillax', ar: 'تشيلاكس'),
        primaryColorHex: '#0ea5e9',
        features: TenantFeatures(rooms: false),
      );
}

void main() {
  // First, before anything has warmed the brand: a cold start is neutral
  test('the brand is neutral until the tenant answers, then the tenant\'s', () async {
    SharedPreferences.setMockInitialValues({});
    final container = ProviderContainer(
      overrides: [tenantRepositoryProvider.overrideWithValue(_Tenant())],
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

  testWidgets('App renders without errors', (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});
    await tester.pumpWidget(
      ProviderScope(
        overrides: [tenantRepositoryProvider.overrideWithValue(_Tenant())],
        child: const NinjaApp(),
      ),
    );

    expect(find.byType(NinjaApp), findsOneWidget);
  });
}
