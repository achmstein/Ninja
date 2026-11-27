import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:pos_app/core/widgets/numeric_keypad.dart';
import 'package:pos_app/core/models/money.dart';
import 'package:pos_app/features/sale/bill_lines.dart';
import 'package:pos_app/features/sale/bill_payers.dart';
import 'package:pos_app/features/sale/widgets/part_payment_sheet.dart';
import 'package:pos_app/features/sale/widgets/pay_who_sheet.dart';
import 'package:pos_app/features/shifts/models/shift.dart';
import 'package:pos_app/features/shifts/services/shifts_service.dart';
import 'package:pos_app/features/tickets/models/enums.dart';
import 'package:pos_app/features/tickets/models/ticket_detail.dart';
import 'package:pos_app/features/tickets/models/ticket_summary.dart';
import 'package:pos_app/features/tickets/services/tickets_service.dart';
import 'package:pos_app/l10n/app_localizations.dart';

import '../../support/phone.dart';

/// Who can pay their own part of a bill and what it comes to, which call
/// names a picked line, and the two sheets the payment is asked through.

TicketLineView _line(
  int id,
  String item, {
  int? orderId,
  double total = 50,
  String? customerId,
  String? customerName,
  bool paid = false,
  String source = 'Order',
}) =>
    TicketLineView(
      id: id,
      orderId: orderId ?? id,
      source: source,
      description: LocalizedText(en: item, ar: item),
      qty: 1,
      unitPrice: total,
      total: total,
      customerId: customerId,
      customerName: customerName,
      paid: paid,
    );

/// Sales takes the part payment, and remembers what it was asked
class _Tickets implements TicketsRepository {
  final List<({int ticketId, PaymentTender tender, double amount, String? payerName, List<int> lineIds, String? requestId})> taken = [];

  @override
  Future<PartPaymentResult> takePartPayment(
    int ticketId, {
    required PaymentTender tender,
    required double amount,
    String? payerName,
    List<int> lineIds = const [],
    String? requestId,
  }) async {
    taken.add((ticketId: ticketId, tender: tender, amount: amount, payerName: payerName, lineIds: lineIds, requestId: requestId));
    return const PartPaymentResult(partPaymentIds: [1]);
  }

  @override
  Future<List<TicketSummary>> getOpenTickets() async => const [];

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

class _Shifts implements ShiftsRepository {
  @override
  Future<ShiftView?> getCurrentShift() async => null;

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

void main() {
  setUpAll(loadTillFonts);

  group('who can pay their own part', () {
    final lines = [
      _line(1, 'Burger', total: 100, customerId: 'a', customerName: 'Mona'),
      _line(2, 'Latte', total: 40),
      _line(3, 'Tea', total: 20, customerName: 'Karim'),
      _line(4, 'Fries', total: 30, customerId: 'a', customerName: 'Mona'),
      _line(5, 'Water', total: 10),
    ];

    test('each person something was sent for, and the lines that were nobody\'s as the bill\'s own', () {
      final payers = payersOf(lines);
      expect([for (final p in payers) p.key], ['id:a', '', 'name:Karim']);
      expect([for (final p in payers) p.name], ['Mona', null, 'Karim']);
      expect(payers[0].lineIds, [1, 4]);
      expect(payers[0].subtotal, 130);
      expect(payers[1].lineIds, [2, 5]);
      expect(payers[1].subtotal, 50);
      expect(payers[2].subtotal, 20);
    });

    test('an account and a bare name of the same spelling are two people', () {
      final payers = payersOf([
        _line(1, 'Tea', customerId: 'a', customerName: 'Mona'),
        _line(2, 'Tea', customerName: 'Mona'),
      ]);
      expect(payers, hasLength(2));
    });

    test('the room\'s time is never one person\'s, and what is paid is done', () {
      final payers = payersOf([
        ...lines,
        _line(6, 'Room time', total: 200, source: 'SessionTime'),
        _line(7, 'Cake', total: 60, customerName: 'Karim', paid: true),
        _line(8, 'Juice', total: 35, customerId: 'z', customerName: 'Zein', paid: true),
      ]);
      expect([for (final p in payers) p.key], ['id:a', '', 'name:Karim']);
      expect(payers[2].lineIds, [3]);
      expect(payers.expand((p) => p.lineIds), isNot(contains(6)));
    });

    test('a payer\'s share carries their part of the service, tax and discount', () {
      final payers = payersOf(lines);
      // 200 of lines come to 228 with service and tax
      expect(payerShare(payers[0], lines, 228), 148.2);
      expect(payerShare(payers[1], lines, 228), 57);
      // A discount scales it down the same way; halves round to the piastre
      expect(payerShare(payers[2], lines, 180), 18);
      expect(payerShare(payers[2], lines, 133.33), 13.33);
      // Nothing to share a bill with no lines by
      expect(payerShare(payers[0], const [], 228), 0);
    });

    test('what is left is the bill less what was taken in parts, never under nothing', () {
      expect(billLeftToPay(const TicketDetail(id: 1, total: 228, partPaid: 148.2)), 79.8);
      expect(billLeftToPay(const TicketDetail(id: 1, total: 228)), 228);
      expect(billLeftToPay(const TicketDetail(id: 1, total: 50, partPaid: 60)), 0);
    });

    test('a part is at least their items and less than the whole, but any amount under a running clock', () {
      expect(partAmountProblem(70, 70, 190, clockRunning: false), PartAmountProblem.none);
      expect(partAmountProblem(100, 70, 190, clockRunning: false), PartAmountProblem.none);
      expect(partAmountProblem(50, 70, 190, clockRunning: false), PartAmountProblem.belowItems);
      expect(partAmountProblem(0, 0, 190, clockRunning: true), PartAmountProblem.empty);
      expect(partAmountProblem(190, 70, 190, clockRunning: false), PartAmountProblem.paysAll);
      // The room's time is still to come: past what the bill holds, and on a bill that holds nothing
      expect(partAmountProblem(200, 70, 190, clockRunning: true), PartAmountProblem.none);
      expect(partAmountProblem(50, 0, 0, clockRunning: true), PartAmountProblem.none);
    });
  });

  group('picked lines', () {
    // Order 7 is one line, order 8 is two, order 9 is three; line 20 is the room's time
    final lines = [
      _line(1, 'Burger', orderId: 7),
      _line(2, 'Latte', orderId: 8),
      _line(3, 'Tea', orderId: 8),
      _line(4, 'Fries', orderId: 9),
      _line(5, 'Water', orderId: 9),
      _line(6, 'Cake', orderId: 9, paid: true),
      const TicketLineView(id: 20, source: 'SessionTime', qty: 1, unitPrice: 200, total: 200),
    ];

    test('a whole order is named through the order, part of one through its lines', () {
      final calls = assignCalls(lines, {1, 2, 4, 5});
      expect(calls.orderIds, [7]);
      expect(calls.lineIds, [2, 4, 5]);

      final whole = assignCalls(lines, {2, 3});
      expect(whole.orderIds, [8]);
      expect(whole.lineIds, isEmpty);
    });

    test('a line with no order behind it is nobody\'s to name', () {
      final calls = assignCalls(lines, {20});
      expect(calls.orderIds, isEmpty);
      expect(calls.lineIds, isEmpty);
    });

    test('the room\'s time and what is paid cannot be picked', () {
      expect([for (final line in lines) if (pickableLine(line)) line.id], [1, 2, 3, 4, 5]);
    });

    test('a new tab opens under the one customer every picked line is for', () {
      expect(oneCustomer([_line(1, 'Tea', customerId: 'a', customerName: 'Mona'), _line(2, 'Tea', customerId: 'a', customerName: 'Mona')]),
          'Mona');
      expect(oneCustomer([_line(1, 'Tea', customerId: 'a', customerName: 'Mona'), _line(2, 'Tea', customerName: 'Karim')]), isNull);
      expect(oneCustomer([_line(1, 'Tea', customerName: 'Mona'), _line(2, 'Tea')]), isNull);
      expect(oneCustomer(const []), isNull);
    });
  });

  for (final locale in phoneLocales) {
    final l10n = lookupAppLocalizations(locale);
    final lang = locale.languageCode;
    final payers = payersOf([
      _line(1, 'Double smoked brisket burger', total: 100, customerId: 'a', customerName: 'Mohamed Abdelrahman Elsayed Mahmoud'),
      _line(2, 'Flat white', total: 40),
      _line(3, 'Tea', total: 20, customerName: 'منى عادل'),
    ]);

    for (final phone in [false, true]) {
      testWidgets('who is paying: everything first, then a row for each payer (${phone ? 'phone' : 'tablet'}, $lang)',
          (tester) async {
        if (phone) {
          await usePhone(tester);
        } else {
          tester.view.physicalSize = const Size(1280, 800);
          tester.view.devicePixelRatio = 1;
          addTearDown(tester.view.reset);
        }
        PayChoice? picked;
        await tester.pumpWidget(tillApp(
          opener((context) async => picked =
              await showPayWho(context, title: 'Terrace table 4', total: 182.4, payers: payers, partPaid: false)),
          locale: locale,
        ));
        await tester.tap(find.text('open'));
        await tester.pumpAndSettle();
        expectFits(tester);

        final sheet = find.byType(PayWhoSheet);
        Finder inSheet(Finder what) => find.descendant(of: sheet, matching: what);
        final context = tester.element(sheet);
        expect(inSheet(find.text(l10n.payWhoTitle)), findsOneWidget);
        expect(inSheet(find.text(l10n.payEverything)), findsOneWidget);
        expect(inSheet(find.text(l10n.payTheRest)), findsNothing);
        expect(inSheet(find.text(money(context, 182.4))), findsOneWidget);
        // Each payer by their whole name; the lines that were nobody's under the bill's own
        final names = ['Mohamed Abdelrahman Elsayed Mahmoud', 'Terrace table 4', 'منى عادل'];
        for (final name in names) {
          expect(inSheet(find.text(name)), findsOneWidget);
        }
        expect(inSheet(find.text('1× Flat white')), findsOneWidget);
        expect(inSheet(find.text(money(context, 100))), findsOneWidget);
        // Everything is the first row, the payers under it in the order they came
        final tops = [
          tester.getRect(inSheet(find.text(l10n.payEverything))).top,
          for (final name in names) tester.getRect(inSheet(find.text(name))).top,
        ];
        expect(tops, [...tops]..sort());
        // A name in either script sits where the row starts
        final everything = tester.getRect(inSheet(find.text(l10n.payEverything)));
        for (final name in names) {
          final rect = tester.getRect(inSheet(find.text(name)));
          expect(lang == 'ar' ? rect.right : rect.left, lang == 'ar' ? everything.right : everything.left, reason: name);
        }

        await tester.tap(inSheet(find.text('منى عادل')));
        await tester.pumpAndSettle();
        expect(find.byType(PayWhoSheet), findsNothing);
        expect(picked?.payer?.key, 'name:منى عادل');
        await tester.pumpWidget(const SizedBox.shrink());
      });
    }

    testWidgets('with a part paid already, everything is the rest ($lang)', (tester) async {
      PayChoice? picked;
      await tester.pumpWidget(tillApp(
        opener((context) async =>
            picked = await showPayWho(context, title: 'Terrace table 4', total: 60, payers: payers, partPaid: true)),
        locale: locale,
      ));
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expect(find.text(l10n.payEverything), findsNothing);
      await tester.tap(find.text(l10n.payTheRest));
      await tester.pumpAndSettle();
      expect(picked, isNotNull);
      expect(picked!.payer, isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    });

    testWidgets('under a running clock everything stops it, and someone leaving can pay an amount on account ($lang)',
        (tester) async {
      await usePhone(tester);
      PayChoice? picked;
      await tester.pumpWidget(tillApp(
        opener((context) async => picked =
            await showPayWho(context, title: 'Room 3', total: 190, payers: payers, clockRunning: true)),
        locale: locale,
      ));
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expectFits(tester);
      final sheet = find.byType(PayWhoSheet);
      final context = tester.element(sheet);
      // The time is still to come: the sum so far is not shown as the whole
      expect(find.text(l10n.payEverythingClock), findsOneWidget);
      expect(find.descendant(of: sheet, matching: find.text(money(context, 190))), findsNothing);
      await tester.tap(find.text(l10n.partPayOnAccount));
      await tester.pumpAndSettle();
      expect(picked, isNotNull);
      expect(picked!.onAccount, isTrue);
      expect(picked!.payer, isNull);
      await tester.pumpWidget(const SizedBox.shrink());
    });

    testWidgets('an amount on account is typed and taken with no items of its own ($lang)', (tester) async {
      await usePhone(tester);
      final tickets = _Tickets();
      await tester.pumpWidget(tillApp(
        opener((context) async => showPartPayment(
              context,
              ticketId: 12,
              title: 'Room 3',
              part: (name: null, lineIds: const <int>[], amount: 0),
              left: 0,
              clockRunning: true,
            )),
        locale: locale,
        overrides: [
          ticketsRepositoryProvider.overrideWithValue(tickets),
          shiftsRepositoryProvider.overrideWithValue(_Shifts()),
        ],
      ));
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expectFits(tester);
      final sheet = find.byType(PartPaymentSheet);
      Finder inSheet(Finder what) => find.descendant(of: sheet, matching: what);
      expect(inSheet(find.text(l10n.partPayOnAccount)), findsOneWidget);
      expect(inSheet(find.text(l10n.partPayItems)), findsNothing);
      expect(inSheet(find.text(l10n.partPayHintClock)), findsOneWidget);
      // Nothing to take until an amount is typed; the keypad is already there
      final take = inSheet(find.widgetWithText(FButton, l10n.partPayTakeWith(l10n.cash)));
      expect(tester.widget<FButton>(take).onPress, isNull);
      for (final key in ['8', '0']) {
        final button = inSheet(find.widgetWithText(FButton, key));
        await tester.ensureVisible(button);
        await tester.pump();
        await tester.tap(button);
        await tester.pump();
      }
      expect(tester.widget<FButton>(take).onPress, isNotNull);
      await tester.ensureVisible(take);
      await tester.pump();
      await tester.tap(take);
      await tester.pumpAndSettle();
      expect(tickets.taken.single.amount, 80);
      expect(tickets.taken.single.lineIds, isEmpty);
      expect(tickets.taken.single.payerName, isNull);
      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(seconds: 10));
    });

    testWidgets('a part is taken once, in the way picked, and the bill stays open ($lang)', (tester) async {
      await usePhone(tester);
      final tickets = _Tickets();
      bool? taken;
      await tester.pumpWidget(tillApp(
        opener((context) async => taken = await showPartPayment(
              context,
              ticketId: 12,
              title: 'Terrace table 4',
              part: (name: 'Mohamed Abdelrahman Elsayed Mahmoud', lineIds: [1, 4], amount: 148.2),
              left: 400,
            )),
        locale: locale,
        overrides: [
          ticketsRepositoryProvider.overrideWithValue(tickets),
          shiftsRepositoryProvider.overrideWithValue(_Shifts()),
        ],
      ));
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expectFits(tester);

      final sheet = find.byType(PartPaymentSheet);
      Finder inSheet(Finder what) => find.descendant(of: sheet, matching: what);
      final context = tester.element(sheet);
      expect(inSheet(find.textContaining('Mohamed Abdelrahman Elsayed Mahmoud')), findsOneWidget);
      // Their items, what they pay, and the button: the same sum until they choose to pay more
      expect(inSheet(find.text(money(context, 148.2))), findsNWidgets(3));
      expect(inSheet(find.text(l10n.partPayHint)), findsOneWidget);
      // The three ways to pay, the same width
      final widths = {
        for (final label in [l10n.cash, l10n.card, l10n.instapay]) tester.getSize(inSheet(find.widgetWithText(FButton, label))).width,
      };
      expect(widths, hasLength(1));
      // They pay for what they had; nothing else is offered but the way to another amount
      final split = l10n.partPaySplit(money(context, 148.2), money(context, 51.8));
      expect(inSheet(find.text(split)), findsNothing);
      expect(inSheet(find.byType(NumericKeypad)), findsNothing);
      expect(inSheet(find.text(l10n.partPayExact)), findsNothing);
      Future<void> key(String label) async {
        final button = inSheet(find.widgetWithText(FButton, label));
        await tester.ensureVisible(button);
        await tester.pump();
        await tester.tap(button);
        await tester.pump();
      }

      await key(l10n.partPayOther);
      expectFits(tester);
      // Under their items is not taken
      await key('9');
      expect(inSheet(find.text(l10n.partPayBelowItems(money(context, 148.2)))), findsOneWidget);
      // More than their items: the amount on the sheet is the amount taken, and the rest is said to be on account
      await key(l10n.partPayItemsOnly);
      await key(l10n.partPayOther);
      await key('2');
      await key('00');
      expect(inSheet(find.text(split)), findsOneWidget);
      expect(inSheet(find.text(money(context, 200))), findsNWidgets(2));
      // The same button goes back to just their items, and puts the keypad away
      await key(l10n.partPayItemsOnly);
      expect(inSheet(find.text(split)), findsNothing);
      expect(inSheet(find.byType(NumericKeypad)), findsNothing);

      await tester.tap(inSheet(find.widgetWithText(FButton, l10n.card)));
      await tester.pump();
      expectFits(tester);

      final took = l10n.partPaymentTaken(money(context, 148.2));
      final take = inSheet(find.widgetWithText(FButton, l10n.partPayTakeWith(l10n.card)));
      expect(take, findsOneWidget);
      await tester.tap(take);
      await tester.pumpAndSettle();

      expect(tickets.taken, hasLength(1));
      final call = tickets.taken.single;
      expect(call.ticketId, 12);
      expect(call.tender, PaymentTender.card);
      expect(call.amount, 148.2);
      expect(call.payerName, 'Mohamed Abdelrahman Elsayed Mahmoud');
      expect(call.lineIds, [1, 4]);
      expect(call.requestId, isNotEmpty);
      expect(taken, isTrue);
      expect(find.byType(PartPaymentSheet), findsNothing);
      expect(find.text(took), findsOneWidget);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(seconds: 10));
    });
  }
}
