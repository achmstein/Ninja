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
import 'package:ninja_client/features/bills/widgets/open_bills.dart';
import 'package:ninja_client/features/orders/models/order.dart';
import 'package:ninja_client/features/orders/services/order_service.dart';
import 'package:ninja_client/features/places/models/place.dart';
import 'package:ninja_client/features/places/services/place_service.dart';
import 'package:ninja_client/l10n/app_localizations.dart';

/// The bills running now, as the dock's sheet shows them: with no open bill
/// the orders on their way stand as a bill of their own, with nothing to pay.

class _Bills extends MyBillsNotifier {
  @override
  AsyncValue<List<Bill>> build() => const AsyncValue.data([]);
}

class _Orders extends OrdersNotifier {
  @override
  OrdersState build() => OrdersState(orders: [
        Order(
          id: 7,
          date: DateTime(2026, 10, 1, 13),
          status: OrderStatus.submitted,
          total: 50,
          items: [OrderItem(productName: const LocalizedText(en: 'Cappuccino'), unitPrice: 50, units: 1)],
        ),
      ]);
}

class _NoStays extends MyStaysNotifier {
  @override
  AsyncValue<List<Stay>> build() => const AsyncValue.data([]);
}

void main() {
  testWidgets('orders on their way with no open bill form one: their round waiting, its total, nothing to pay', (tester) async {
    await tester.pumpWidget(ProviderScope(
      overrides: [
        moneyProvider.overrideWithValue(MoneyFormat('EGP', const Locale('en'))),
        featuresProvider.overrideWithValue(TenantFeatures.all),
        myBillsProvider.overrideWith(_Bills.new),
        ordersProvider.overrideWith(_Orders.new),
        myStaysProvider.overrideWith(_NoStays.new),
        minuteClockProvider.overrideWith((ref) => Stream.value(DateTime(2026, 10, 1, 14))),
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
        home: const Scaffold(body: SingleChildScrollView(child: OpenBills())),
      ),
    ));
    await tester.pump(const Duration(milliseconds: 500));
    expect(tester.takeException(), isNull);
    expect(find.text('Waiting to be confirmed'), findsOneWidget);
    expect(find.text('Cappuccino'), findsOneWidget);
    expect(find.textContaining('50'), findsWidgets);
    // Nothing to pay or print yet
    expect(find.text('Receipt'), findsNothing);
  });
}
