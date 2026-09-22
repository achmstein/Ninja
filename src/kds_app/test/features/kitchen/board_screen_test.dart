import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:kds_app/core/brand/brand_provider.dart';
import 'package:kds_app/core/brand/tenant_brand.dart';
import 'package:kds_app/core/theme/app_theme.dart';
import 'package:kds_app/features/kitchen/models/kitchen_order.dart';
import 'package:kds_app/features/kitchen/screens/board_screen.dart';
import 'package:kds_app/features/kitchen/services/kitchen_service.dart';
import 'package:kds_app/l10n/app_localizations.dart';

/// The kitchen the board would poll. It counts, so a board that must not
/// show orders can be caught asking for them.
class _Kitchen implements KitchenRepository {
  int asked = 0;

  @override
  Future<List<KitchenOrder>> getKitchenOrders() async {
    asked++;
    return [
      KitchenOrder.fromJson({
        'orderNumber': 3121,
        'date': '2026-09-05T19:50:00Z',
        'confirmedAt': '2026-09-05T19:52:00Z',
        'source': 'Customer',
        'items': [
          {
            'productName': {'en': 'Latte', 'ar': 'لاتيه'},
            'units': 2,
          },
        ],
      }),
    ];
  }

  @override
  Future<void> setReady(int orderNumber, bool ready, {required String requestId}) async {}
}

Widget _board(_Kitchen kitchen, {required bool kds}) => ProviderScope(
      overrides: [
        featuresProvider.overrideWithValue(TenantFeatures(kds: kds)),
        kitchenRepositoryProvider.overrideWithValue(kitchen),
      ],
      child: MaterialApp(
        locale: const Locale('en'),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        builder: (context, child) => FTheme(
          data: const ThemeState(themeMode: AppThemeMode.light).getForuiTheme(context, locale: const Locale('en')),
          child: FToaster(child: child!),
        ),
        home: const Scaffold(body: BoardScreen()),
      ),
    );

void main() {
  testWidgets('a kitchen display that is not in the plan says so and asks the kitchen for nothing', (tester) async {
    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);

    final kitchen = _Kitchen();
    await tester.pumpWidget(_board(kitchen, kds: false));
    await tester.pump();

    expect(find.text('The kitchen display is not in your plan'), findsOneWidget);
    expect(find.textContaining('Orders still reach the till'), findsOneWidget);
    expect(find.text('Latte'), findsNothing);
    // A screen that may not show the board does not poll for it either
    expect(kitchen.asked, 0);
  });

  testWidgets('with the module on, the board is the orders and no lock', (tester) async {
    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);

    final kitchen = _Kitchen();
    await tester.pumpWidget(_board(kitchen, kds: true));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('The kitchen display is not in your plan'), findsNothing);
    expect(find.text('Latte'), findsOneWidget);
    expect(kitchen.asked, greaterThan(0));
  });
}
