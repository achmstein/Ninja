import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:kds_app/core/brand/brand_provider.dart';
import 'package:kds_app/core/brand/tenant_brand.dart';
import 'package:kds_app/core/motion/motion.dart';
import 'package:kds_app/core/theme/app_theme.dart';
import 'package:kds_app/features/kitchen/models/kitchen_order.dart';
import 'package:kds_app/features/kitchen/models/kitchen_station.dart';
import 'package:kds_app/features/kitchen/screens/board_screen.dart';
import 'package:kds_app/features/kitchen/services/kitchen_service.dart';
import 'package:kds_app/features/kitchen/widgets/bump_exit.dart';
import 'package:kds_app/features/kitchen/widgets/dish_line.dart';
import 'package:kds_app/features/kitchen/widgets/elapsed_ring.dart';
import 'package:kds_app/features/kitchen/widgets/order_card.dart';
import 'package:kds_app/l10n/app_localizations.dart';

// The kitchen's moments: a dish struck through, the clock ring, a ticket
// bumped off the board.

Widget _app(Widget home) => MaterialApp(
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
      home: Scaffold(body: home),
    );

KitchenOrder _order(int number, {DateTime? confirmedAt, String product = 'Latte'}) => KitchenOrder.fromJson({
      'orderNumber': number,
      'date': (confirmedAt ?? DateTime.utc(2026, 9, 5, 19, 50)).toIso8601String(),
      'confirmedAt': (confirmedAt ?? DateTime.utc(2026, 9, 5, 19, 52)).toIso8601String(),
      'source': 'Customer',
      'items': [
        {
          'productName': {'en': product, 'ar': product},
          'units': 2,
        },
        {
          'productName': {'en': 'Croissant', 'ar': 'كرواسون'},
          'units': 1,
        },
      ],
    });

/// A kitchen whose orders stay ready once readied
class _Kitchen implements KitchenRepository {
  final List<KitchenOrder> orders;
  _Kitchen(this.orders);

  @override
  Future<List<KitchenOrder>> getKitchenOrders({int? stationId}) async => orders;

  @override
  Future<List<KitchenStation>> getStations() async => const [];

  @override
  Future<void> setReady(int orderNumber, bool ready, {int? stationId, required String requestId}) async {
    final i = orders.indexWhere((o) => o.orderNumber == orderNumber);
    orders[i] = orders[i].withReadyAt(ready ? DateTime.now().toUtc() : null);
  }
}

void main() {
  setUp(() => dishTicks.value = <String>{});

  testWidgets('a tapped dish is struck through, its check fills, and a second tap takes it back', (tester) async {
    final order = _order(3121);
    await tester.pumpWidget(_app(SizedBox(
      width: 400,
      child: OrderCard(order: order, now: DateTime.utc(2026, 9, 5, 19, 55), acting: false, onReady: () {}),
    )));
    await tester.pumpAndSettle();

    final latte = find.widgetWithText(StrikeText, 'Latte');
    expect(tester.widget<StrikeText>(latte).struck, isFalse);

    await tester.tap(find.text('Latte'));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    // Mid-stroke: the line is being drawn, the other dish untouched
    expect(tester.widget<StrikeText>(latte).struck, isTrue);
    expect(find.descendant(of: latte, matching: find.byType(CustomPaint)), findsWidgets);
    expect(tester.widget<StrikeText>(find.widgetWithText(StrikeText, 'Croissant')).struck, isFalse);
    expect(dishTicks.value, {dishKey(3121, 0)});
    await tester.pumpAndSettle();
    expect(tester.widgetList<DishCheck>(find.byType(DishCheck)).map((c) => c.done), [true, false]);

    await tester.tap(find.text('Latte'));
    await tester.pumpAndSettle();
    expect(dishTicks.value, isEmpty);
    expect(tester.widget<StrikeText>(latte).struck, isFalse);
  });

  testWidgets('the history card has no checks to tick', (tester) async {
    final order = _order(3121).withReadyAt(DateTime.utc(2026, 9, 5, 20));
    await tester.pumpWidget(_app(SizedBox(
      width: 400,
      child: OrderCard(order: order, now: DateTime.utc(2026, 9, 5, 20, 5), acting: false, onBringBack: () {}),
    )));
    await tester.pumpAndSettle();
    expect(find.byType(DishCheck), findsNothing);
    expect(find.byType(ElapsedRing), findsNothing);
    await tester.tap(find.text('Latte'));
    expect(dishTicks.value, isEmpty);
  });

  testWidgets('the ring fills with the clock and only a late order breathes', (tester) async {
    final since = DateTime.utc(2026, 9, 5, 19, 52);
    Widget ring(Duration after) => _app(Center(child: ElapsedRing(since: since, now: since.add(after))));

    await tester.pumpWidget(ring(const Duration(minutes: 3)));
    await tester.pumpAndSettle();
    expect(tester.hasRunningAnimations, isFalse);

    await tester.pumpWidget(ring(const Duration(minutes: 7)));
    await tester.pumpAndSettle();
    expect(tester.hasRunningAnimations, isFalse);

    await tester.pumpWidget(ring(const Duration(minutes: 12)));
    await tester.pump(const Duration(milliseconds: 700));
    expect(tester.hasRunningAnimations, isTrue);
    Opacity breath() => tester.widget<Opacity>(find.descendant(of: find.byType(ElapsedRing), matching: find.byType(Opacity)));
    final a = breath().opacity;
    await tester.pump(const Duration(milliseconds: 800));
    expect(breath().opacity, isNot(closeTo(a, 0.05)));

    // Back under the line (brought back, say): still again
    await tester.pumpWidget(ring(const Duration(minutes: 2)));
    await tester.pumpAndSettle();
    expect(tester.hasRunningAnimations, isFalse);
  });

  testWidgets('Ready draws the card in to a chip that leaves, and the board closes up', (tester) async {
    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);

    final now = DateTime.now().toUtc();
    final kitchen = _Kitchen([
      _order(101, confirmedAt: now.subtract(const Duration(minutes: 2)), product: 'Latte'),
      _order(102, confirmedAt: now.subtract(const Duration(minutes: 1)), product: 'Mocha'),
    ]);
    await tester.pumpWidget(ProviderScope(
      overrides: [
        featuresProvider.overrideWithValue(const TenantFeatures(kds: true)),
        kitchenRepositoryProvider.overrideWithValue(kitchen),
      ],
      child: _app(const BoardScreen()),
    ));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 100));
    expect(find.text('Latte'), findsOneWidget);
    final mochaBefore = tester.getTopLeft(find.text('Mocha'));

    await tester.tap(find.widgetWithText(FButton, 'Ready').first);
    await tester.pump();
    expect(find.byType(BumpExit), findsOneWidget);

    await tester.pump(const Duration(milliseconds: 350));
    expect(find.text('Ready #101'), findsOneWidget);
    // The board keeps its shape while the chip leaves
    expect(tester.getTopLeft(find.text('Mocha')), mochaBefore);

    await tester.pump(bumpDuration);
    await tester.pump(const Duration(milliseconds: 16));
    expect(find.byType(BumpExit), findsNothing);
    expect(find.text('Latte'), findsNothing);
    await tester.pump(const Duration(milliseconds: 60));
    final gliding = tester.getTopLeft(find.text('Mocha'));
    expect(gliding.dx, lessThan(mochaBefore.dx));
    await tester.pump(const Duration(milliseconds: 600));
    final settled = tester.getTopLeft(find.text('Mocha'));
    expect(settled.dx, lessThan(gliding.dx));
  });

  testWidgets('with reduced motion a new ticket only fades in', (tester) async {
    await tester.pumpWidget(MediaQuery(
      data: const MediaQueryData(disableAnimations: true),
      child: _app(const SlideInItem(child: Text('new'))),
    ));
    await tester.pump(const Duration(milliseconds: 60));
    final transforms = find.ancestor(of: find.text('new'), matching: find.byType(Transform));
    for (final t in tester.widgetList<Transform>(transforms)) {
      expect(t.transform.getTranslation().x, 0);
    }
    await tester.pumpAndSettle();
  });
}
