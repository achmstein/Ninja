import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/brand/brand_provider.dart';
import 'package:ninja_client/core/brand/tenant_brand.dart';
import 'package:ninja_client/core/models/localized_text.dart';
import 'package:ninja_client/core/ui/ui.dart';
import 'package:ninja_client/core/utils/money.dart';
import 'package:ninja_client/features/bills/models/bill.dart';
import 'package:ninja_client/features/bills/services/bills_service.dart';
import 'package:ninja_client/features/bills/widgets/bill_slip.dart';
import 'package:ninja_client/features/bills/widgets/bill_tile.dart';
import 'package:ninja_client/features/orders/models/order.dart';
import 'package:ninja_client/features/places/models/place.dart';
import 'package:ninja_client/features/places/services/place_service.dart';
import 'package:ninja_client/l10n/app_localizations.dart';

/// The bill as a stack of its rounds (client_web's bill-card.tsx): the
/// newest round in full, the rest folded under it until the stack is opened.

class _NoStays extends MyStaysNotifier {
  @override
  AsyncValue<List<Stay>> build() => const AsyncValue.data([]);
}

BillLine _line(int id, int orderId, String name, double total) => BillLine(
      id: id,
      source: 'Order',
      orderId: orderId,
      description: LocalizedText(en: name),
      qty: 1,
      unitPrice: total,
      discount: 0,
      total: total,
      isMine: true,
    );

Bill _bill({required bool settled}) => Bill(
      id: 9,
      type: 'Dine',
      status: settled ? 'Settled' : 'Open',
      branchId: 1,
      openedAt: DateTime(2026, 10, 1, 18),
      lastActivityAt: DateTime(2026, 10, 1, 19),
      settledAt: settled ? DateTime(2026, 10, 1, 20) : null,
      lines: [_line(1, 11, 'Latte', 50), _line(2, 12, 'Waffle', 70)],
      subtotal: 120,
      discount: 0,
      serviceCharge: 0,
      serviceChargeRate: 0,
      vat: 0,
      vatRate: 0,
      vatIncluded: true,
      total: 120,
      refundedTotal: 0,
    );

Widget _host(Bill bill, {List<PendingRound> pending = const []}) => ProviderScope(
      overrides: [
        moneyProvider.overrideWithValue(MoneyFormat('EGP', const Locale('en'))),
        featuresProvider.overrideWithValue(TenantFeatures.all),
        myStaysProvider.overrideWith(_NoStays.new),
        minuteClockProvider.overrideWith((ref) => Stream.value(DateTime(2026, 10, 1, 20))),
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
        theme: materialThemeFor(NinjaTheme.neutral(Brightness.light)),
        home: Scaffold(body: SingleChildScrollView(child: SizedBox(width: 390, child: BillTile(bill: bill, pending: pending)))),
      ),
    );

void main() {
  testWidgets('a closed bill shows its newest round, the rest folded until opened', (tester) async {
    await tester.pumpWidget(_host(_bill(settled: true)));
    await tester.pump(const Duration(milliseconds: 400));
    expect(tester.takeException(), isNull);
    expect(find.text('2 rounds'), findsOneWidget);
    // The newest round in full; the older one folded away
    expect(find.text('Waffle'), findsOneWidget);
    expect(find.text('Latte'), findsNothing);
    expect(find.text('Receipt'), findsNothing);

    await tester.tap(find.text('2 rounds'));
    await tester.pumpAndSettle();
    expect(find.text('Latte'), findsOneWidget);
    // Opened, the way to its receipt
    expect(find.text('Receipt'), findsOneWidget);
  });

  test('rounds on their way land on the open bill; confirmed ones only until a bill has them', () {
    final open = _bill(settled: false);
    final order = Order(id: 13, date: DateTime(2026, 10, 1, 19, 30), status: OrderStatus.submitted, total: 40);
    // Confirmed and already on the bill (order 12): nothing pending
    final onIt = Order(id: 12, date: DateTime(2026, 10, 1, 19), status: OrderStatus.confirmed, total: 70);
    final confirmed = Order(id: 14, date: DateTime(2026, 10, 1, 19, 40), status: OrderStatus.confirmed, total: 20);
    final rounds = placeRounds([open], [order, onIt, confirmed])[open.id]!;
    expect(rounds.map((r) => (r.order.id, r.adding)), [(14, true), (13, false)]);
    // No open bill: nothing to land on
    expect(placeRounds([_bill(settled: true)], [order]), isEmpty);
  });

  testWidgets('a round on its way sits on top of the stack, waiting', (tester) async {
    final order = Order(
      id: 13,
      date: DateTime(2026, 10, 1, 19, 30),
      status: OrderStatus.submitted,
      total: 40,
      items: [OrderItem(productName: const LocalizedText(en: 'Mint tea'), unitPrice: 40, units: 1)],
    );
    await tester.pumpWidget(_host(_bill(settled: false), pending: [PendingRound(order, adding: false)]));
    await tester.pump(const Duration(milliseconds: 400));
    expect(tester.takeException(), isNull);
    expect(find.text('3 rounds'), findsOneWidget);
    expect(find.text('Waiting to be confirmed'), findsOneWidget);
    expect(find.text('Mint tea'), findsOneWidget);
  });

  testWidgets('the receipt prints out inside the card, under its button, and folds away', (tester) async {
    tester.view.physicalSize = const Size(1170, 3600);
    tester.view.devicePixelRatio = 3;
    addTearDown(tester.view.reset);
    // An open bill stands open: its receipt is the slip the till would print
    await tester.pumpWidget(_host(_bill(settled: false)));
    await tester.pump(const Duration(milliseconds: 400));
    await tester.tap(find.text('Receipt'));
    await tester.pump(const Duration(milliseconds: 600));
    expect(tester.takeException(), isNull);
    expect(find.text('Hide the receipt'), findsOneWidget);
    expect(find.byType(BillSlip), findsOneWidget);

    await tester.tap(find.text('Hide the receipt'));
    await tester.pump(const Duration(milliseconds: 600));
    expect(find.byType(BillSlip), findsNothing);
  });
}
