import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:pos_app/core/brand/brand_service.dart';
import 'package:pos_app/core/brand/tenant_brand.dart';
import 'package:pos_app/core/providers/branch_provider.dart';
import 'package:pos_app/core/theme/app_theme.dart';
import 'package:pos_app/features/ticket/dialogs/settle_dialog.dart';
import 'package:pos_app/features/ticket/widgets/online_payments_card.dart';
import 'package:pos_app/features/tickets/models/enums.dart';
import 'package:pos_app/features/tickets/models/online_payment.dart';
import 'package:pos_app/features/tickets/models/settle.dart';
import 'package:pos_app/features/tickets/models/ticket_detail.dart';
import 'package:pos_app/features/tickets/services/tickets_service.dart';
import 'package:pos_app/l10n/app_localizations.dart';

/// Pay at table on the till's ticket screen: the guests' payments, what is
/// left for the till, and a settle that takes only the rest.

class _Tenant implements TenantRepository {
  @override
  Future<TenantBrand> getBrand() async => TenantBrand.neutral;
}

/// Records the settle; nothing else is called
class _Tickets implements TicketsRepository {
  SettleRequest? settled;

  @override
  Future<SettleResult> settle(int id, SettleRequest request, {String? requestId}) async {
    settled = request;
    return const SettleResult(receiptNumber: 12, change: 0);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

const _bill = TicketDetail(id: 7, total: 100);

Widget _app(Widget home, {_Tickets? tickets}) => ProviderScope(
      overrides: [
        selectedBranchIdProvider.overrideWithValue(1),
        tenantRepositoryProvider.overrideWithValue(_Tenant()),
        if (tickets != null) ticketsRepositoryProvider.overrideWithValue(tickets),
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
          data: const ThemeState(themeMode: AppThemeMode.dark).getForuiTheme(context, locale: const Locale('en')),
          child: FToaster(child: child!),
        ),
        home: Scaffold(body: home),
      ),
    );

/// The bundled fonts, so widths are the tablet's and not the test font's
Future<void> _loadFonts() async {
  for (final family in ['Inter', 'Cairo']) {
    final loader = FontLoader(family);
    for (final weight in ['Regular', 'Medium', 'SemiBold', 'Bold']) {
      loader.addFont(rootBundle.load('assets/fonts/$family-$weight.ttf'));
    }
    await loader.load();
  }
}

void main() {
  setUpAll(_loadFonts);

  const payments = [
    OnlinePaymentView(key: 'a', payerName: 'Sara', amount: 40, tip: 5, status: 'Paid'),
    OnlinePaymentView(key: 'b', amount: 30, status: 'Pending'),
  ];

  testWidgets('each guest payment shows its payer, its status and the tip apart, then what is left', (tester) async {
    final refunded = <String>[];
    await tester.pumpWidget(_app(OnlinePaymentsCard(ticket: _bill, payments: payments, onRefund: (p) => refunded.add(p.key))));
    await tester.pump();

    expect(find.text('Sara'), findsOneWidget);
    expect(find.text('Guest'), findsOneWidget);
    expect(find.text('Paying…'), findsOneWidget);
    expect(find.textContaining('+ 5.00 EGP tip'), findsOneWidget);
    // Paid online is the shares that landed; the pending one still owes
    expect(find.text('Remaining'), findsOneWidget);
    expect(find.text('60.00 EGP'), findsOneWidget);
    expect(find.text('A guest is paying online. Settle once they finish.'), findsOneWidget);

    // Only a paid payment on an open bill can go back
    expect(find.byKey(const ValueKey('refund-a')), findsOneWidget);
    expect(find.byKey(const ValueKey('refund-b')), findsNothing);
    await tester.tap(find.byKey(const ValueKey('refund-a')));
    await tester.pump(const Duration(seconds: 2));
    expect(refunded, ['a']);
  });

  testWidgets('a settled bill lists its online payments with nothing to refund or take', (tester) async {
    const settled = TicketDetail(id: 7, total: 100, status: TicketStatus.settled);
    await tester.pumpWidget(_app(OnlinePaymentsCard(
      ticket: settled,
      payments: const [OnlinePaymentView(key: 'a', amount: 100, status: 'Paid')],
      onRefund: (_) {},
    )));
    await tester.pump();

    expect(find.byKey(const ValueKey('refund-a')), findsNothing);
    expect(find.text('Remaining'), findsNothing);
  });

  testWidgets('the settle takes only what guests left, and nothing when they paid it all', (tester) async {
    tester.view.physicalSize = const Size(1280, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);

    final tickets = _Tickets();
    await tester.pumpWidget(_app(
      Builder(
        builder: (context) => TextButton(
          onPressed: () => showSettleDialog(context, _bill, onlinePaid: 100),
          child: const Text('open'),
        ),
      ),
      tickets: tickets,
    ));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    expect(find.text('Paid online'), findsOneWidget);
    expect(find.text('−100.00 EGP'), findsOneWidget);
    // Nothing left to take: confirm straight away, with no till payment
    await tester.tap(find.text('Confirm & settle'));
    await tester.pumpAndSettle();
    expect(tickets.settled, isNotNull);
    expect(tickets.settled!.payments, isEmpty);
    await tester.pump(const Duration(seconds: 5));
  });

  testWidgets('with part paid online the settle starts from the rest', (tester) async {
    tester.view.physicalSize = const Size(1280, 900);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);

    await tester.pumpWidget(_app(
      Builder(
        builder: (context) => TextButton(
          onPressed: () => showSettleDialog(context, _bill, onlinePaid: 40),
          child: const Text('open'),
        ),
      ),
      tickets: _Tickets(),
    ));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    // The keypad is prefilled with what is left, not the whole bill
    expect(find.text('60'), findsOneWidget);
    expect(find.text('60.00 EGP'), findsOneWidget);
    // Nothing added yet: the till still owes the rest
    final confirm = tester.widget<FButton>(find.ancestor(of: find.text('Confirm & settle'), matching: find.byType(FButton)));
    expect(confirm.onPress, isNull);
  });
}
