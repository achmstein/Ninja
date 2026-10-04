import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:pos_app/features/orders/models/order.dart';
import 'package:pos_app/features/orders/models/stock_disposition.dart';
import 'package:pos_app/features/orders/services/order_service.dart';
import 'package:pos_app/features/ticket/dialogs/void_dialog.dart';
import 'package:pos_app/features/tickets/models/ticket_summary.dart';
import 'package:pos_app/features/tickets/services/tickets_service.dart';
import 'package:pos_app/l10n/app_localizations.dart';

/// Records what the void sends
class _Tickets implements TicketsRepository {
  String? reason;
  String? disposition;
  bool voided = false;

  @override
  Future<void> voidTicket(int id, String reason, {String? requestId, String? stockDisposition}) async {
    voided = true;
    this.reason = reason;
    disposition = stockDisposition;
  }

  @override
  Future<List<TicketSummary>> getOpenTickets() async => [];

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

/// Ordering's word on whether each order was made
class _Orders implements OrderRepository {
  final Map<int, bool> prepared;
  _Orders(this.prepared);

  @override
  Future<Order> getOrderDetails(int orderId) async => Order(
        id: orderId,
        date: DateTime(2026, 10, 4),
        status: OrderStatus.confirmed,
        total: 50,
        wasPrepared: prepared[orderId] ?? false,
      );

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

Widget _app(_Tickets tickets, _Orders orders, List<int> orderIds) => ProviderScope(
      overrides: [
        ticketsRepositoryProvider.overrideWithValue(tickets),
        orderRepositoryProvider.overrideWithValue(orders),
      ],
      child: MaterialApp(
        locale: const Locale('ar'),
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        builder: (context, child) => FTheme(
          data: const ThemeState(themeMode: AppThemeMode.light).getForuiTheme(context, locale: const Locale('ar')),
          child: FToaster(child: child!),
        ),
        home: Builder(
          builder: (context) => Center(
            child: TextButton(
              onPressed: () => showVoidDialog(context, 7, orderIds: orderIds),
              child: const Text('open'),
            ),
          ),
        ),
      ),
    );

Future<void> _open(WidgetTester tester, _Tickets tickets, _Orders orders, List<int> orderIds) async {
  tester.view.physicalSize = const Size(1280, 800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  await tester.pumpWidget(_app(tickets, orders, orderIds));
  await tester.tap(find.text('open'));
  await tester.pumpAndSettle();
}

Future<void> _voidFor(WidgetTester tester, String reason) async {
  await tester.enterText(find.byType(TextField), reason);
  await tester.pumpAndSettle();
  // The title and the button read the same in Arabic: the button is the last
  await tester.tap(find.text('إلغاء الفاتورة').last);
  await tester.pumpAndSettle();
}

/// The radio that says it is checked (or not), by its label
void _expectChecked(WidgetTester tester, String label, bool checked) =>
    expect(tester.getSemantics(find.text(label)), isSemantics(isInMutuallyExclusiveGroup: true, isChecked: checked));

/// The bundled fonts, so widths are the tablet's and not the test font's
/// (which draws every glyph a full em wide and overflows narrow rows)
Future<void> _loadFonts() async {
  for (final family in ['Inter', 'Alexandria']) {
    final loader = FontLoader(family);
    for (final weight in ['Regular', 'Medium', 'SemiBold', 'Bold']) {
      loader.addFont(rootBundle.load('assets/fonts/$family-$weight.ttf'));
    }
    await loader.load();
  }
}
void main() {
  setUpAll(_loadFonts);

  group('StockDisposition', () {
    test('writes made food off and puts the rest back', () {
      expect(StockDisposition.defaultFor(true), StockDisposition.waste);
      expect(StockDisposition.defaultFor(false), StockDisposition.restock);
      expect(StockDisposition.defaultForAll([false, true]), StockDisposition.waste);
      expect(StockDisposition.defaultForAll(const []), StockDisposition.restock);
      expect(StockDisposition.waste.wire, 'Waste');
      expect(StockDisposition.restock.wire, 'Restock');
    });
  });

  testWidgets('a bill with a made order starts at waste and sends it', (tester) async {
    final tickets = _Tickets();
    await _open(tester, tickets, _Orders({41: true, 42: false}), [41, 42]);

    expect(find.text('الأكل اتعمل؟'), findsOneWidget);
    _expectChecked(tester, 'يتحسب هالك', true);
    _expectChecked(tester, 'يرجع المخزن', false);

    await _voidFor(tester, 'مشي من غير ما يدفع');
    expect(tickets.voided, isTrue);
    expect(tickets.disposition, 'Waste');
    expect(tester.takeException(), isNull);
  });

  testWidgets('nothing made starts at back to stock, and the cashier has the last word', (tester) async {
    final tickets = _Tickets();
    await _open(tester, tickets, _Orders({41: false}), [41]);

    _expectChecked(tester, 'يرجع المخزن', true);

    await tester.tap(find.text('يتحسب هالك'));
    await tester.pumpAndSettle();
    _expectChecked(tester, 'يتحسب هالك', true);

    await _voidFor(tester, 'اتفتحت غلط');
    expect(tickets.disposition, 'Waste');
  });

  testWidgets('a bill of manual lines asks nothing of the food', (tester) async {
    final tickets = _Tickets();
    await _open(tester, tickets, _Orders({}), const []);

    expect(find.text('الأكل اتعمل؟'), findsNothing);

    await _voidFor(tester, 'اتفتحت غلط');
    expect(tickets.voided, isTrue);
    expect(tickets.disposition, isNull);
  });
}
