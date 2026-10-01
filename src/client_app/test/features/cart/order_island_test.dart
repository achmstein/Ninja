import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/models/localized_text.dart';
import 'package:ninja_client/core/ui/ui.dart';
import 'package:ninja_client/features/cart/widgets/order_island.dart';
import 'package:ninja_client/features/orders/models/order.dart';
import 'package:ninja_client/l10n/app_localizations.dart';

/// An order turned down opens the island out with what client_web's
/// order-pill.tsx says: the stage and number, that the business could not
/// take it, the first four dishes and how many more, what it came to, and
/// the way to the bill, in either language.

OrderItem _line(String en, String ar, {int units = 1}) => OrderItem(productName: LocalizedText(en: en, ar: ar), unitPrice: 50, units: units);

final _order = Order(
  id: 12,
  date: DateTime(2026, 10, 2, 13),
  status: OrderStatus.cancelled,
  total: 300,
  items: [
    _line('Cappuccino', 'كابتشينو', units: 2),
    _line('Latte', 'لاتيه'),
    _line('Waffle', 'وافل'),
    _line('Brownie', 'براوني'),
    _line('Water', 'مياه'),
  ],
);

Widget _app(Locale locale, IslandController controller) => MaterialApp(
      locale: locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      theme: materialThemeFor(NinjaTheme.neutral(Brightness.light)),
      builder: (context, child) => IslandHost(controller: controller, child: child!),
      home: const SizedBox.expand(),
    );

void main() {
  for (final (locale, cancelled, bills) in [
    (const Locale('en'), 'Cancelled · #12', 'See your bill'),
    (const Locale('ar'), 'اتلغى · #12', 'شوف الحساب'),
    (const Locale('ar', '001'), 'أُلغي · #12', 'اعرض الفاتورة'),
  ]) {
    testWidgets('an order turned down, opened out ($locale)', (tester) async {
      final island = IslandController();
      var toBills = false;
      await tester.pumpWidget(_app(locale, island));
      island.flash(turnedDownFace(_order, business: 'Chillax', total: '300.00 EGP', onBills: () => toBills = true), duration: orderAnnounce);
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.text(cancelled), findsOneWidget);
      expect(find.textContaining('Chillax'), findsOneWidget);
      expect(find.text('2×'), findsOneWidget);
      // Four dishes, and how many more
      expect(find.text('+1'), findsOneWidget);
      expect(find.text('300.00 EGP'), findsOneWidget);

      await tester.tap(find.text(bills));
      await tester.pumpAndSettle();
      expect(toBills, isTrue);
      expect(island.face, isNull);
    });
  }
}
