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
import 'package:ninja_client/features/bills/widgets/bill_tile.dart';
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

Widget _host(Bill bill) => ProviderScope(
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
        home: Scaffold(body: SingleChildScrollView(child: SizedBox(width: 390, child: BillTile(bill: bill)))),
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
}
