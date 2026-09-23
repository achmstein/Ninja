import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:pos_app/core/models/localized_text.dart';
import 'package:pos_app/core/printing/kitchen_printing.dart';
import 'package:pos_app/core/theme/app_theme.dart';
import 'package:pos_app/features/ticket/dialogs/kitchen_reprint_dialog.dart';
import 'package:pos_app/features/tickets/models/ticket_detail.dart';
import 'package:pos_app/l10n/app_localizations.dart';

LocalizedText _text(String en) => LocalizedText.parse({'en': en, 'ar': en});

/// Two orders on the bill: two teas first, then a shisha
final _bill = TicketDetail(
  id: 7,
  lines: [
    TicketLineView(id: 1, orderId: 31, description: _text('Tea'), qty: 2),
    TicketLineView(id: 2, orderId: 32, description: _text('Mint shisha'), qty: 1),
  ],
);

Widget _app(TicketDetail ticket, {required bool branchPrints}) => ProviderScope(
      overrides: [branchPrintsKitchenTicketsProvider.overrideWith((ref) async => branchPrints)],
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
          child: child!,
        ),
        home: Scaffold(body: Row(children: [KitchenReprintButton(ticket: ticket)])),
      ),
    );

void main() {
  testWidgets('a branch whose kitchen prints offers each order on the bill again', (tester) async {
    await tester.pumpWidget(_app(_bill, branchPrints: true));
    await tester.pumpAndSettle();

    await tester.tap(find.text('Kitchen tickets'));
    await tester.pumpAndSettle();

    expect(find.text('Order #32'), findsOneWidget);
    expect(find.text('Order #31'), findsOneWidget);
    expect(find.text('Reprint'), findsNWidgets(2));
    // Newest on top: the shisha was ordered last
    expect(tester.getTopLeft(find.text('Order #32')).dy, lessThan(tester.getTopLeft(find.text('Order #31')).dy));
  });

  testWidgets('a kitchen that only has screens has nothing to reprint', (tester) async {
    await tester.pumpWidget(_app(_bill, branchPrints: false));
    await tester.pumpAndSettle();

    expect(find.text('Kitchen tickets'), findsNothing);
  });

  testWidgets('a bill with no orders on it has nothing to reprint', (tester) async {
    final walkIn = TicketDetail(id: 8, lines: [TicketLineView(id: 1, source: 'Manual', description: _text('Service'), qty: 1)]);
    await tester.pumpWidget(_app(walkIn, branchPrints: true));
    await tester.pumpAndSettle();

    expect(find.text('Kitchen tickets'), findsNothing);
  });
}
