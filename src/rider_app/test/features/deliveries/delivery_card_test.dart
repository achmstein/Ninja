import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:rider_app/features/deliveries/models/delivery_order.dart';
import 'package:rider_app/features/deliveries/widgets/delivery_card.dart';
import 'package:rider_app/l10n/app_localizations.dart';

Widget _host(Widget child, {Locale locale = const Locale('en')}) => ProviderScope(
      child: MaterialApp(
        locale: locale,
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        builder: (context, app) => FTheme(
          data: const ThemeState(themeMode: AppThemeMode.light).getForuiTheme(context, locale: locale),
          child: app!,
        ),
        home: Scaffold(body: SingleChildScrollView(child: child)),
      ),
    );

DeliveryOrder _order(String stage) => DeliveryOrder.fromJson({
      'orderNumber': 42,
      'customerName': 'Mona',
      'total': 115,
      'items': [
        {'productName': {'en': 'Latte', 'ar': ''}, 'units': 2},
      ],
      'delivery': {'address': 'Tahrir St', 'building': '12', 'floor': '3', 'phone': '01001234567', 'stage': stage},
    });

String _money(double v) => v.toStringAsFixed(2);

void main() {
  testWidgets('on the way: delivered is the big step, and not handing it over is there too', (tester) async {
    await tester.pumpWidget(_host(DeliveryCard(order: _order('OnTheWay'), money: _money)));
    await tester.pumpAndSettle();
    expect(find.text('Delivered'), findsWidgets);
    expect(find.text("Couldn't deliver"), findsOneWidget);
    expect(find.text('Tahrir St · Bldg 12, Floor 3'), findsOneWidget, reason: 'an English comma in English');
  });

  testWidgets('not handed over: bring it back, nothing to collect, no next step', (tester) async {
    await tester.pumpWidget(_host(DeliveryCard(order: _order('Failed'), money: _money)));
    await tester.pumpAndSettle();
    expect(find.text('Bring it back to the branch'), findsOneWidget);
    expect(find.text('Collect cash'), findsNothing);
    expect(find.text("Couldn't deliver"), findsNothing);
  });

  testWidgets('the count stands apart from a Latin dish name in Arabic', (tester) async {
    await tester.pumpWidget(_host(DeliveryCard(order: _order('Assigned'), money: _money), locale: const Locale('ar')));
    await tester.pumpAndSettle();
    expect(find.text('2×'), findsOneWidget);
    expect(find.text('Latte'), findsOneWidget);
  });
}
