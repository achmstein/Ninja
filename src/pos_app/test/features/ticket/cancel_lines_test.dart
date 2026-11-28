import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/brand/brand_provider.dart';
import 'package:ninja_app_core/brand/tenant_brand.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/theme/app_theme.dart';
import 'package:pos_app/features/sale/bill_lines.dart';
import 'package:pos_app/features/sale/widgets/sent_lines.dart';
import 'package:pos_app/features/ticket/dialogs/cancel_lines_dialog.dart';
import 'package:pos_app/features/ticket/lines.dart';
import 'package:pos_app/features/tickets/models/ticket_detail.dart';
import 'package:pos_app/features/tickets/models/ticket_summary.dart';
import 'package:pos_app/features/tickets/services/tickets_service.dart';
import 'package:pos_app/l10n/app_localizations.dart';

/// Records what the cancel sends
class _Tickets implements TicketsRepository {
  int? ticketId;
  Map<String, dynamic>? body;
  String? requestId;

  @override
  Future<void> cancelLines(int id, CancelLinesRequest request, {String? requestId}) async {
    ticketId = id;
    body = request.toJson();
    this.requestId = requestId;
  }

  @override
  Future<List<TicketSummary>> getOpenTickets() async => [];

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

TicketLineView _line(
  int id,
  String name,
  double qty,
  double unitPrice, {
  String source = 'Order',
  int? orderId = 1,
  double cancelledQty = 0,
  String? cancelReason,
  bool paid = false,
}) =>
    TicketLineView(
      id: id,
      source: source,
      orderId: orderId,
      description: LocalizedText.parse({'en': name, 'ar': name}),
      qty: qty,
      unitPrice: unitPrice,
      total: qty * unitPrice,
      cancelledQty: cancelledQty,
      cancelReason: cancelReason,
      paid: paid,
    );

final _ticket = TicketDetail(
  id: 93,
  lines: [
    _line(1, 'Double burger', 2, 165),
    _line(2, 'Fries', 1, 50),
    _line(3, 'Mango juice', 2, 60, source: 'Manual', orderId: null),
  ],
);

Widget _host(Widget home, {TicketsRepository? tickets}) => ProviderScope(
      overrides: [
        featuresProvider.overrideWithValue(const TenantFeatures(inventory: true)),
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
          data: const ThemeState(themeMode: AppThemeMode.light).getForuiTheme(context, locale: const Locale('en')),
          child: FToaster(child: child!),
        ),
        home: home,
      ),
    );

/// The bundled fonts, so widths are the tablet's and not the test font's
Future<void> _loadFonts() async {
  for (final family in ['Inter', 'Alexandria']) {
    final loader = FontLoader(family);
    for (final weight in ['Regular', 'Medium', 'SemiBold', 'Bold']) {
      loader.addFont(rootBundle.load('assets/fonts/$family-$weight.ttf'));
    }
    await loader.load();
  }
}

void _tablet(WidgetTester tester) {
  tester.view.physicalSize = const Size(1280, 800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
}

void main() {
  setUpAll(_loadFonts);

  group('the model', () {
    test('a line reads what was cancelled of it; an older server sends nothing', () {
      final line = TicketLineView.fromJson({
        'id': 4,
        'source': 'Order',
        'qty': 0,
        'unitPrice': 60,
        'total': 0,
        'cancelledQty': 2,
        'cancelReason': 'We ran out',
        'cancelledBy': 'Owner',
        'cancelledAt': '2026-11-28T18:00:00Z',
      });
      expect(line.cancelledWhole, isTrue);
      expect(line.originalQty, 2);
      expect(line.cancelReason, 'We ran out');
      expect(line.cancelledAt, DateTime.utc(2026, 11, 28, 18));
      expect(line.cancellable, isFalse);

      final old = TicketLineView.fromJson({'id': 5, 'qty': 1, 'unitPrice': 50, 'total': 50});
      expect(old.isCancelled, isFalse);
      expect(old.cancellable, isTrue);
    });

    test('only an item with some left, not paid for, can be cancelled', () {
      expect(_line(1, 'Latte', 1, 55).cancellable, isTrue);
      expect(_line(1, 'Latte', 1, 55, source: 'Manual').cancellable, isTrue);
      expect(_line(1, 'Room', 1.5, 100, source: 'SessionTime').cancellable, isFalse);
      expect(_line(1, 'Delivery', 1, 30, source: 'DeliveryFee').cancellable, isFalse);
      expect(_line(1, 'Points', 1, -20).cancellable, isFalse);
      expect(_line(1, 'Latte', 1, 55, paid: true).cancellable, isFalse);
    });

    test('the request carries the lines, the reason and the food', () {
      const request = CancelLinesRequest(
        lines: [CancelLineRequest(lineId: 123, qty: 1)],
        reason: 'Took too long',
        stockDisposition: 'Waste',
      );
      expect(request.toJson(), {
        'lines': [
          {'lineId': 123, 'qty': 1.0},
        ],
        'reason': 'Took too long',
        'stockDisposition': 'Waste',
      });
      expect(const CancelLinesRequest(lines: [], reason: 'x').toJson().containsKey('stockDisposition'), isFalse);
    });

    test('everything left on the bill is a void, not a cancel', () {
      final lines = _ticket.lines;
      expect(cancelsEverything(lines, {1: 2, 2: 1}), isFalse);
      expect(cancelsEverything(lines, {1: 2, 2: 1, 3: 2}), isTrue);
      // The room's time is still sold
      expect(
          cancelsEverything([...lines, _line(9, 'Room', 1, 100, source: 'SessionTime')], {1: 2, 2: 1, 3: 2}), isFalse);
    });

    test('a line with items cancelled is not merged with its twin, nor picked once all of it went', () {
      final merged = mergeIdenticalLines([
        _line(1, 'Latte', 1, 55),
        _line(2, 'Latte', 0, 55, cancelledQty: 1, cancelReason: 'Rung up by mistake'),
        _line(3, 'Latte', 1, 55),
      ]);
      expect(merged.map((l) => l.id), [1, 2]);
      expect(merged.first.qty, 2);
      expect(pickableLine(merged[1]), isFalse);
    });
  });

  group('the dialog', () {
    testWidgets('sends how many of each, the reason tapped and what became of the food', (tester) async {
      _tablet(tester);
      final tickets = _Tickets();
      var cancelled = false;
      await tester.pumpWidget(_host(
        Builder(
          builder: (context) => Center(
            child: TextButton(
              onPressed: () async => cancelled = await showCancelLinesDialog(context, _ticket, {1, 2}),
              child: const Text('open'),
            ),
          ),
        ),
        tickets: tickets,
      ));
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();

      // A line of two starts at both; a line of one has no stepper
      expect(find.text('2 of 2'), findsOneWidget);
      expect(find.text('Was the food made?'), findsOneWidget);
      expect(find.textContaining('Cancel 3 items ·'), findsOneWidget);

      await tester.tap(find.byIcon(FIcons.minus));
      await tester.pumpAndSettle();
      expect(find.text('1 of 2'), findsOneWidget);

      // No reason, no cancel
      await tester.tap(find.textContaining('Cancel 2 items ·'));
      await tester.pumpAndSettle();
      expect(tickets.body, isNull);

      await tester.tap(find.text('Rung up by mistake'));
      await tester.tap(find.text('Back to stock'));
      await tester.pumpAndSettle();
      // 165 of the burger and 50 of the fries come off
      expect(find.textContaining('215.00'), findsOneWidget);
      await tester.tap(find.textContaining('Cancel 2 items ·'));
      await tester.pumpAndSettle();

      expect(tickets.ticketId, 93);
      expect(tickets.requestId, isNotEmpty);
      expect(tickets.body, {
        'lines': [
          {'lineId': 1, 'qty': 1.0},
          {'lineId': 2, 'qty': 1.0},
        ],
        'reason': 'Rung up by mistake',
        'stockDisposition': 'Restock',
      });
      expect(cancelled, isTrue);
      expect(tester.takeException(), isNull);
    });

    testWidgets('items rung up by hand say nothing of stock, and the whole bill is refused', (tester) async {
      _tablet(tester);
      final tickets = _Tickets();
      final manualOnly = TicketDetail(id: 7, lines: [_line(3, 'Mango juice', 2, 60, source: 'Manual', orderId: null)]);
      await tester.pumpWidget(_host(
        Builder(
          builder: (context) => Center(
            child: TextButton(
              onPressed: () => showCancelLinesDialog(context, manualOnly, {3}),
              child: const Text('open'),
            ),
          ),
        ),
        tickets: tickets,
      ));
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();

      expect(find.text('Was the food made?'), findsNothing);
      await tester.enterText(find.byType(TextField), 'Spilled');
      await tester.pumpAndSettle();
      // Both of the only item is everything: said, and not sent
      expect(find.text('That is everything on the bill: void the bill instead.'), findsOneWidget);
      await tester.tap(find.textContaining('Cancel 2 items ·'));
      await tester.pumpAndSettle();
      expect(tickets.body, isNull);

      await tester.tap(find.byIcon(FIcons.minus));
      await tester.pumpAndSettle();
      await tester.tap(find.textContaining('Cancel 1 item ·'));
      await tester.pumpAndSettle();
      expect(tickets.body, {
        'lines': [
          {'lineId': 3, 'qty': 1.0},
        ],
        'reason': 'Spilled',
      });
    });
  });

  group('on the bill', () {
    testWidgets('a line cancelled whole is struck; part of one shows what is left; both say why in red', (tester) async {
      _tablet(tester);
      await tester.pumpWidget(_host(Scaffold(
        body: SentLines(lines: [
          _line(1, 'Double burger', 0, 165, cancelledQty: 2, cancelReason: 'Rung up by mistake'),
          _line(2, 'Mango juice', 1, 60, cancelledQty: 1, cancelReason: 'We ran out'),
          _line(3, 'Fries', 1, 50),
        ]),
      )));
      await tester.pumpAndSettle();

      expect(find.text('Cancelled · Rung up by mistake'), findsOneWidget);
      expect(find.text('Cancelled 1 of 2 · We ran out'), findsOneWidget);

      final burger = tester.widget<Text>(find.text('Double burger'));
      expect(burger.style?.decoration, TextDecoration.lineThrough);
      final juice = tester.widget<Text>(find.text('Mango juice'));
      expect(juice.style?.decoration, isNot(TextDecoration.lineThrough));
      // What was rung up, struck; what is left of the other
      expect(find.text('2×'), findsOneWidget);
      expect(find.textContaining('330.00'), findsOneWidget);
      expect(find.textContaining('60.00'), findsOneWidget);

      final red = tester.widget<Text>(find.text('Cancelled 1 of 2 · We ran out'));
      expect(red.style?.color, tester.element(find.byType(SentLines)).theme.colors.destructive);
      expect(tester.takeException(), isNull);
    });
  });
}
