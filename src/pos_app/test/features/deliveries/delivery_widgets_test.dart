import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:pos_app/core/theme/app_theme.dart';
import 'package:pos_app/features/deliveries/models/delivery_order.dart';
import 'package:pos_app/features/deliveries/widgets/deliveries_strip.dart';
import 'package:pos_app/features/deliveries/widgets/delivery_dialog.dart';
import 'package:pos_app/l10n/app_localizations.dart';

Widget _host(Widget child) => ProviderScope(
      child: MaterialApp(
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        builder: (context, app) => FTheme(
          data: const ThemeState(themeMode: AppThemeMode.light).getForuiTheme(context, locale: const Locale('en')),
          child: app!,
        ),
        home: Scaffold(body: Center(child: child)),
      ),
    );

DeliveryOrder _order(String stage) => DeliveryOrder.fromJson({
      'orderNumber': 42,
      'confirmedAt': '2026-10-04T10:00:00Z',
      'customerName': 'Mona',
      'total': 145,
      'delivery': {'address': 'Tahrir St', 'phone': '01001234567', 'stage': stage, 'riderUserId': 'r1', 'riderName': 'Emam'},
    });

void main() {
  testWidgets('a card is a button to assistive technology, saying the order, whom and where it stands', (tester) async {
    final handle = tester.ensureSemantics();
    var opened = false;
    await tester.pumpWidget(_host(DeliveryCard(order: _order('Failed'), now: DateTime.utc(2026, 10, 4, 10, 30), onTap: () => opened = true)));
    await tester.pumpAndSettle();
    expect(find.text('Coming back with Emam'), findsOneWidget);
    expect(find.bySemanticsLabel(RegExp('Mona, Coming back with Emam')), findsOneWidget);
    await tester.tap(find.byType(DeliveryCard));
    expect(opened, isTrue);
    handle.dispose();
  });

  testWidgets('cash counted in: prefilled with the bill, the difference said before it is taken', (tester) async {
    double? taken;
    await tester.pumpWidget(_host(Builder(
      builder: (context) => FButton(
        onPress: () async => taken = await showCashInDialog(context, order: _order('Delivered')),
        child: const Text('open'),
      ),
    )));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expect(find.text('Exactly the bill'), findsOneWidget);

    await tester.enterText(find.byType(EditableText), '140');
    await tester.pumpAndSettle();
    expect(find.textContaining('short'), findsOneWidget);

    await tester.tap(find.text('Take it in'));
    await tester.pumpAndSettle();
    expect(taken, 140);
  });
}
