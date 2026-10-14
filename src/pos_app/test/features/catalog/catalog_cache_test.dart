import 'dart:io';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import 'package:pos_app/features/catalog/models/catalog_item.dart';
import 'package:pos_app/features/catalog/providers/catalog_provider.dart';
import 'package:pos_app/features/catalog/services/catalog_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FakeCatalog implements CatalogRepository {
  bool offline = false;

  @override
  Future<List<CatalogItem>> getItems() async {
    if (offline) throw const SocketException('down');
    return const [
      CatalogItem(
        id: 7,
        name: LocalizedText(en: 'Latte', ar: 'لاتيه'),
        price: 55,
        effectivePrice: 50,
        catalogTypeId: 3,
        displayOrder: 2,
        customizations: [
          ItemCustomization(id: 1, name: LocalizedText(en: 'Milk'), isRequired: true, options: [
            CustomizationOption(id: 9, name: LocalizedText(en: 'Oat'), priceAdjustment: 5, isOutOfStock: true),
          ]),
        ],
        pairedItemIds: [8],
      ),
    ];
  }

  @override
  Future<List<CatalogCategory>> getCategories() async {
    if (offline) throw const SocketException('down');
    return const [CatalogCategory(id: 3, name: LocalizedText(en: 'Coffee', ar: 'قهوة'), displayOrder: 1)];
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  ProviderContainer containerFor(_FakeCatalog catalog, int branchId) {
    // No automatic retry: a failure is the answer, not a wait
    final container = ProviderContainer(retry: (_, _) => null, overrides: [
      catalogRepositoryProvider.overrideWithValue(catalog),
      selectedBranchIdProvider.overrideWithValue(branchId),
    ]);
    addTearDown(container.dispose);
    return container;
  }

  setUp(() => SharedPreferences.setMockInitialValues({}));

  test('a till started offline sells from the menu it last saw', () async {
    final catalog = _FakeCatalog();
    await containerFor(catalog, 1).read(catalogItemsProvider.future);
    await containerFor(catalog, 1).read(catalogCategoriesProvider.future);

    catalog.offline = true;
    final restarted = containerFor(catalog, 1);
    final item = (await restarted.read(catalogItemsProvider.future)).single;
    expect(item.id, 7);
    expect(item.name.inLanguage('ar'), 'لاتيه');
    expect(item.unitPrice, 50);
    expect(item.customizations.single.options.single.isOutOfStock, isTrue);
    expect(item.pairedItemIds, [8]);
    expect((await restarted.read(catalogCategoriesProvider.future)).single.name.inLanguage('ar'), 'قهوة');
  });

  test('each branch keeps its own menu, and with none kept the failure stands', () async {
    final catalog = _FakeCatalog();
    await containerFor(catalog, 1).read(catalogItemsProvider.future);

    catalog.offline = true;
    await expectLater(containerFor(catalog, 2).read(catalogItemsProvider.future), throwsA(isA<SocketException>()));
  });
}
