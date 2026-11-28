import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:pos_app/core/auth/auth_service.dart';
import 'package:pos_app/core/printing/kitchen_printing.dart';
import 'package:pos_app/core/theme/type_roles.dart';
import 'package:pos_app/core/utils/bidi.dart';
import 'package:pos_app/features/customers/models/customer_card.dart';
import 'package:pos_app/features/customers/providers/customer_providers.dart';
import 'package:pos_app/features/orders/models/order.dart';
import 'package:pos_app/features/orders/services/order_service.dart';
import 'package:pos_app/features/orders/widgets/order_detail_dialog.dart';
import 'package:pos_app/features/places/models/place.dart';
import 'package:pos_app/features/places/providers/places_provider.dart';
import 'package:pos_app/features/tables/models/dining_table.dart';
import 'package:pos_app/features/tables/services/tables_service.dart';
import 'package:pos_app/features/ticket/dialogs/breakdown_dialog.dart';
import 'package:pos_app/features/ticket/dialogs/change_tender_dialog.dart';
import 'package:pos_app/features/ticket/dialogs/discard_dialog.dart';
import 'package:pos_app/features/ticket/dialogs/discount_dialog.dart';
import 'package:pos_app/features/ticket/dialogs/kitchen_reprint_dialog.dart';
import 'package:pos_app/features/ticket/dialogs/move_target_dialog.dart';
import 'package:pos_app/features/ticket/dialogs/refund_dialog.dart';
import 'package:pos_app/features/ticket/dialogs/void_dialog.dart';
import 'package:pos_app/features/ticket/screens/settle_screen.dart';
import 'package:pos_app/features/ticket/screens/ticket_screen.dart';
import 'package:pos_app/features/ticket/tenders.dart';
import 'package:pos_app/features/tickets/models/enums.dart';
import 'package:pos_app/features/tickets/models/online_payment.dart';
import 'package:pos_app/features/tickets/models/ticket_detail.dart';
import 'package:pos_app/features/tickets/models/ticket_summary.dart';
import 'package:pos_app/features/tickets/providers/tickets_provider.dart';
import 'package:pos_app/features/tickets/services/online_payments_service.dart';
import 'package:pos_app/features/tickets/services/tickets_service.dart';
import 'package:pos_app/l10n/app_localizations.dart';

import '../../support/phone.dart';

/// A busy floor: bills of every kind, with long names and large totals
class _Tickets implements TicketsRepository {
  @override
  Future<List<TicketSummary>> getOpenTickets() async => [
        const TicketSummary(
          id: 1041,
          type: TicketType.room,
          locationName: LocalizedText(en: 'PlayStation room 12', ar: 'غرفة بلايستيشن ١٢'),
          total: 12480.5,
        ),
        const TicketSummary(id: 1042, type: TicketType.room, locationName: LocalizedText(en: 'VIP', ar: 'كبار الزوار'), total: 90),
        const TicketSummary(
          id: 1043,
          type: TicketType.table,
          locationName: LocalizedText(en: 'Terrace table 4', ar: 'طاولة التراس ٤'),
          total: 765,
        ),
        const TicketSummary(id: 1044, type: TicketType.counter, label: 'Mohamed Abdelrahman', total: 104250.75),
        const TicketSummary(id: 1045, type: TicketType.counter, total: 35),
      ];

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

class _Tables implements TablesRepository {
  @override
  Future<List<DiningTable>> getTables() async => [
        for (var i = 1; i <= 9; i++) DiningTable(id: i, name: LocalizedText(en: 'Terrace table $i', ar: 'طاولة التراس $i')),
      ];
}

class _Orders implements OrderRepository {
  @override
  Future<Order> getOrderDetails(int orderId) async => Order.fromJson({
        'id': orderId,
        'date': '2026-11-20T18:30:00Z',
        'status': 'Submitted',
        'total': 1385.5,
        'loyaltyDiscount': 25,
        'customerNote': 'Please ring the bell twice and leave it with the doorman if nobody answers',
        'guestName': 'Mohamed Abdelrahman',
        'placeId': 4,
        'placeName': {'en': 'Terrace table 4', 'ar': 'طاولة التراس ٤'},
        'orderItems': [
          {
            'productId': 1,
            'productName': {'en': 'Double smoked brisket burger with truffle fries', 'ar': 'برجر بريسكت مدخن دبل مع بطاطس الكمأة'},
            'unitPrice': 345.25,
            'units': 3,
            'specialInstructions': 'No onions, extra sauce on the side',
          },
          {
            'productId': 2,
            'productName': {'en': 'Flat white', 'ar': 'فلات وايت'},
            'unitPrice': 95,
            'units': 2,
          },
        ],
      });

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

TicketDetail _bill({TicketStatus status = TicketStatus.open, double refunded = 0}) => TicketDetail(
      id: 104233,
      type: TicketType.table,
      status: status,
      receiptNumber: status == TicketStatus.settled ? 20481 : null,
      locationName: const LocalizedText(en: 'Terrace table 4', ar: 'طاولة التراس ٤'),
      subtotal: 123900,
      discount: 12390,
      discountRate: 0.1,
      serviceCharge: 13381.2,
      vat: 17484.77,
      total: 142375.97,
      refundedTotal: refunded,
      lines: const [
        TicketLineView(
          id: 1,
          orderId: 7,
          description: LocalizedText(en: 'Double smoked brisket burger with truffle fries', ar: 'برجر بريسكت مدخن دبل'),
          qty: 3,
          unitPrice: 345.25,
          total: 1035.75,
          customerId: 'a',
          customerName: 'Mohamed Abdelrahman',
        ),
        TicketLineView(id: 2, orderId: 7, description: LocalizedText(en: 'Flat white', ar: 'فلات وايت'), qty: 2, total: 190),
      ],
    );

final _stay = Stay(
  id: 1,
  placeId: 1,
  placeName: const LocalizedText(en: 'PlayStation room 12', ar: 'غرفة بلايستيشن ١٢'),
  createdAt: DateTime(2026, 11, 20, 18),
  startedAt: DateTime(2026, 11, 20, 18),
  status: StayStatus.running,
);

Widget _bar(TicketDetail ticket, {bool selecting = false, bool confirming = false, bool canRefund = false, Stay? stay}) =>
    Align(
      alignment: Alignment.bottomCenter,
      child: TicketActionBar(
        ticket: ticket,
        activeSession: stay,
        selecting: selecting,
        selectedCount: 2,
        busy: false,
        canRefund: canRefund,
        paidOnline: 500,
        total: ticket.total,
        confirming: confirming,
        onSettle: () {},
        onPrint: () {},
        onRefund: () {},
        onAssign: () {},
        onMove: () {},
      ),
    );

Widget _header(TicketDetail ticket, {bool selecting = false}) => Align(
      alignment: Alignment.topCenter,
      child: SizedBox(
        height: 64,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
          child: TicketHeader(
            ticket: ticket,
            title: 'Terrace table 4',
            backTo: '/',
            selecting: selecting,
            canSelect: true,
            canDiscard: false,
            canVoid: true,
            onToggleSelecting: () {},
            onDiscard: () {},
            onVoid: () {},
            onDiscount: () {},
          ),
        ),
      ),
    );

void main() {
  setUpAll(loadTillFonts);
  _wholeBillTests();
  _billDialogTests();

  for (final locale in phoneLocales) {
    final l10n = lookupAppLocalizations(locale);
    final lang = locale.languageCode;

    testWidgets('the bill\'s bar puts its actions under the total on a phone ($lang)', (tester) async {
      await usePhone(tester);

      // Settle alone: the whole width
      await tester.pumpWidget(tillApp(_bar(_bill(), stay: _stay), locale: locale));
      await tester.pumpAndSettle();
      expectFits(tester);
      expect(tester.getSize(find.widgetWithText(FButton, l10n.settleAction)).width, 360 - 32);
      expect(tester.getTopLeft(find.widgetWithText(FButton, l10n.settleAction)).dy,
          greaterThan(tester.getBottomLeft(find.text(l10n.total)).dy));

      // Lines picked: whose they are and where they go, side by side at one width
      await tester.pumpWidget(tillApp(_bar(_bill(), selecting: true), locale: locale));
      await tester.pumpAndSettle();
      expectFits(tester);
      final assign = tester.getRect(find.widgetWithText(FButton, l10n.assignCustomer));
      final move = tester.getRect(find.widgetWithText(FButton, l10n.moveItems));
      expect(move.top, assign.top);
      expect(move.width, assign.width);
      for (final rect in [assign, move]) {
        expect(rect.height, greaterThanOrEqualTo(48));
      }
      for (final label in [l10n.assignCustomer, l10n.moveItems]) {
        expectWhole(tester, label);
      }

      // Paid: print and the owner's refund side by side
      await tester.pumpWidget(tillApp(_bar(_bill(status: TicketStatus.settled), canRefund: true), locale: locale));
      await tester.pumpAndSettle();
      expectFits(tester);
      expect(tester.getRect(find.widgetWithText(FButton, l10n.print)).top,
          tester.getRect(find.widgetWithText(FButton, l10n.refundTicket)).top);
      expectWhole(tester, l10n.print);
      expectWhole(tester, l10n.refundTicket);

      // Lines still on their way
      await tester.pumpWidget(tillApp(_bar(_bill(), confirming: true), locale: locale));
      await tester.pump();
      expectFits(tester);
      // The spinner never settles: the tree goes before the test ends
      await tester.pumpWidget(const SizedBox.shrink());
    });

    testWidgets('the bill\'s header keeps icons for Add items and Select on a phone ($lang)', (tester) async {
      await usePhone(tester);
      final overrides = [branchPrintsKitchenTicketsProvider.overrideWith((ref) async => true)];

      await tester.pumpWidget(tillApp(_header(_bill()), locale: locale, overrides: overrides));
      await tester.pumpAndSettle();
      expectFits(tester);
      // No words, but each button still says what it is and is a full finger wide
      expect(find.text(l10n.addItems), findsNothing);
      expect(find.text(l10n.selectLines), findsNothing);
      for (final label in [l10n.addItems, l10n.selectLines]) {
        expect(tester.getSize(find.byTooltip(label)), const Size(48, 48));
      }

      await tester.pumpWidget(tillApp(_header(_bill(status: TicketStatus.settled)), locale: locale, overrides: overrides));
      await tester.pumpAndSettle();
      expectFits(tester);
    });

    testWidgets('the bill\'s header and bar are the tablet\'s from 640 dp up ($lang)', (tester) async {
      tester.view.physicalSize = const Size(1280, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(tillApp(
        Column(children: [_header(_bill()), const Spacer(), _bar(_bill(), selecting: true)]),
        locale: locale,
        overrides: [branchPrintsKitchenTicketsProvider.overrideWith((ref) async => true)],
      ));
      await tester.pumpAndSettle();
      expectFits(tester);
      expect(find.text(l10n.addItems), findsOneWidget);
      expect(find.text(l10n.selectLines), findsOneWidget);
      // One row: the total, then the two things done with picked lines, at one width
      final assign = tester.getRect(find.widgetWithText(FButton, l10n.assignCustomer));
      final move = tester.getRect(find.widgetWithText(FButton, l10n.moveItems));
      expect(assign.top, move.top);
      expect(assign.width, move.width);
    });

    testWidgets('moving lines to another bill fits a phone ($lang)', (tester) async {
      await usePhone(tester);
      final overrides = [
        ticketsRepositoryProvider.overrideWithValue(_Tickets()),
        tablesRepositoryProvider.overrideWithValue(_Tables()),
      ];

      // One dialog, no modes: every place the lines can go in one list
      await tester.pumpWidget(tillApp(
        opener((context) => showMoveTargetDialog(context,
            ticket: _bill(), count: 2, allSelected: false, suggestedName: 'Mohamed Abdelrahman')),
        locale: locale,
        overrides: overrides,
      ));
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expectFits(tester);
      expect(find.text(l10n.moveItemsTitle(2)), findsOneWidget);
      for (final caption in [l10n.moveNamedBill, l10n.moveOpenBills, l10n.moveFreeTable]) {
        expect(find.text(labelCase(caption)), findsOneWidget);
      }
      // An open bill is a row: its kind and number under its name
      expect(find.text('${l10n.room} · ${hashNumber(1041)}'), findsOneWidget);
      // The lines' one customer is a name to tap, said why
      expect(find.text(bidiIsolate('Mohamed Abdelrahman')), findsOneWidget);
      expect(find.text(l10n.moveNamedTheirs), findsOneWidget);
      // Free tables are tiles of one size, two across on a phone
      Rect tile(int n) => tester.getRect(find
          .ancestor(
              of: find.text(LocalizedText(en: 'Terrace table $n', ar: 'طاولة التراس $n').getText(locale)),
              matching: find.byWidgetPredicate((w) => w is FTappable))
          .first);
      final first = tile(1);
      final second = tile(2);
      expect(first.top, second.top);
      expect(first.size, second.size);
      expect((first.left - second.left).abs(), closeTo((360 - 48 - 2 - 32 - 8) / 2 + 8, 40));

      // A new name is typed in the box, and offered as a bill at once
      await tester.enterText(find.byType(FTextField), 'Nour El Din Abdelrahman');
      await tester.pumpAndSettle();
      expectFits(tester);
      expect(find.text(l10n.moveNewNamed(bidiIsolate('Nour El Din Abdelrahman'))), findsOneWidget);
      await tester.pumpWidget(const SizedBox.shrink());
    });

    testWidgets('an order\'s details fit a phone, cancelling too ($lang)', (tester) async {
      await usePhone(tester);
      await tester.pumpWidget(tillApp(
        opener((context) => showOrderDetailDialog(context, 5521)),
        locale: locale,
        overrides: [orderRepositoryProvider.overrideWithValue(_Orders())],
      ));
      await tester.tap(find.text('open'));
      // The skeleton first, then the order
      await tester.pump();
      expectFits(tester);
      await tester.pumpAndSettle();
      expectFits(tester);

      await tester.ensureVisible(find.widgetWithText(FButton, l10n.cancelOrder));
      await tester.tap(find.widgetWithText(FButton, l10n.cancelOrder));
      await tester.pumpAndSettle();
      expectFits(tester);
      expect(find.text(l10n.nobodyAtTheTable), findsOneWidget);
    });

    testWidgets('settling fits a phone: the tenders, the keypad, a payment and the foot ($lang)', (tester) async {
      await usePhone(tester);
      await tester.pumpWidget(tillApp(
        opener((context) => showSettle(context, _bill(), title: 'Terrace table 4', onlinePaid: 500)),
        locale: locale,
        overrides: [
          ticketsRepositoryProvider.overrideWithValue(_Tickets()),
          tabAccountProvider('a').overrideWith((ref) async => const TabAccount(customerId: 'a', balance: 12480.5)),
        ],
      ));
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expectFits(tester);

      // On account: whose tab, with what they owe and their share of this bill
      await tester.tap(find.widgetWithText(FButton, tenderLabel(l10n, PaymentTender.account)));
      await tester.pumpAndSettle();
      expectFits(tester);
      expect(find.text(l10n.whoseAccount), findsOneWidget);
      await tester.tap(find.widgetWithText(FButton, tenderLabel(l10n, PaymentTender.cash)));
      await tester.pumpAndSettle();

      // Nothing typed: the one button takes all that is left in cash, and says so
      expect(find.textContaining(l10n.settleTake(tenderLabel(l10n, PaymentTender.cash))), findsOneWidget);

      // Every key a finger's size
      for (final key in ['1', '00', '.']) {
        final size = tester.getSize(find.widgetWithText(FButton, key));
        expect(size.width, greaterThanOrEqualTo(48));
        expect(size.height, greaterThanOrEqualTo(48));
      }

      // Part of it in cash: the payment's row, and the foot with what is left
      for (final key in ['1', '00']) {
        await tester.ensureVisible(find.widgetWithText(FButton, key));
        await tester.pumpAndSettle();
        await tester.tap(find.widgetWithText(FButton, key));
        await tester.pumpAndSettle();
      }
      // Less than what is left is typed: the same button adds it as one payment of several
      final add = find.textContaining(l10n.settleAddPayment(tenderLabel(l10n, PaymentTender.cash)));
      expect(add, findsOneWidget);
      await tester.ensureVisible(add);
      await tester.tap(add);
      await tester.pumpAndSettle();
      expectFits(tester);
      expect(find.text(l10n.noPaymentsYet), findsNothing);
      await tester.drag(find.byType(SingleChildScrollView).first, const Offset(0, -600));
      await tester.pumpAndSettle();
      expectFits(tester);
      // With a payment taken the button is back to taking the rest
      expect(find.textContaining(l10n.settleTake(tenderLabel(l10n, PaymentTender.cash))), findsOneWidget);
    });
  }
}

class _Owner extends AuthService {
  @override
  AuthState build() => const AuthState(
        isInitializing: false,
        isAuthenticated: true,
        mayUseApp: true,
        userId: 'owner',
        name: 'Mohamed Abdelrahman',
        roles: ['Owner'],
        branches: [1],
      );

  @override
  Future<void> initialize() async {}
}

class _NoPending implements OrderRepository {
  @override
  Future<List<Order>> getPendingOrders() async => [];

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

/// A room's stay while its clock runs: two rates, three people
final _roomStay = Stay(
  id: 9,
  placeId: 12,
  placeName: const LocalizedText(en: 'PlayStation room 12', ar: 'غرفة بلايستيشن ١٢'),
  createdAt: DateTime(2026, 11, 20, 18),
  startedAt: DateTime(2026, 11, 20, 18),
  status: StayStatus.running,
  currentOptionCode: 'multi',
  currentOptionName: const LocalizedText(en: 'Multiplayer', ar: 'جماعي'),
  options: const [
    RateOption(code: 'single', name: LocalizedText(en: 'Single', ar: 'فردي'), hourlyRate: 60),
    RateOption(code: 'multi', name: LocalizedText(en: 'Multiplayer', ar: 'جماعي'), hourlyRate: 90),
  ],
  members: [
    StayMember(customerId: 'a', customerName: 'Mohamed Abdelrahman Elsayed', joinedAt: DateTime(2026, 11, 20, 18), role: 'Owner'),
    StayMember(customerId: 'b', customerName: 'Karim Mostafa', joinedAt: DateTime(2026, 11, 20, 18, 5), role: 'Member'),
    StayMember(customerId: 'c', customerName: 'منى عادل', joinedAt: DateTime(2026, 11, 20, 18, 9), role: 'Member'),
  ],
);

TicketDetail _whole(int id) => switch (id) {
      // A room's open bill
      1 => TicketDetail(
          id: 1,
          type: TicketType.room,
          sessionId: 9,
          placeId: 12,
          locationName: const LocalizedText(en: 'PlayStation room 12', ar: 'غرفة بلايستيشن ١٢'),
          openedAt: DateTime(2026, 11, 20, 18),
          subtotal: 123900,
          discount: 12390,
          discountRate: 0.1,
          serviceCharge: 13381.2,
          vat: 17484.77,
          total: 142375.97,
          lines: _bill().lines,
        ),
      // A table's, paid, with a refund against it
      _ => TicketDetail(
          id: 2,
          type: TicketType.table,
          status: TicketStatus.settled,
          placeId: 4,
          locationName: const LocalizedText(en: 'Terrace table 4', ar: 'طاولة التراس ٤'),
          openedAt: DateTime(2026, 11, 20, 18),
          settledAt: DateTime(2026, 11, 20, 19, 30),
          settledBy: 'Mohamed Abdelrahman Elsayed',
          receiptNumber: 20481,
          subtotal: 123900,
          vat: 17484.77,
          total: 142375.97,
          refundedTotal: 1035.75,
          change: 124.03,
          lines: _bill().lines,
          payments: [
            PaymentView(id: 1, tender: PaymentTender.cash, amount: 100000, recordedAt: DateTime(2026, 11, 20, 19, 30)),
            PaymentView(
              id: 2,
              tender: PaymentTender.account,
              amount: 42375.97,
              customerId: 'a',
              customerName: 'Mohamed Abdelrahman Elsayed',
              recordedAt: DateTime(2026, 11, 20, 19, 30),
            ),
          ],
          refunds: [
            RefundView(
              id: 1,
              number: 31,
              amount: 1035.75,
              reason: 'The burger came out cold and the guest sent all three of them back',
              tender: PaymentTender.cash,
              refundedBy: 'Mohamed Abdelrahman Elsayed',
              refundedAt: DateTime(2026, 11, 20, 19, 45),
              lines: const [
                RefundLineView(
                  ticketLineId: 1,
                  description: LocalizedText(en: 'Double smoked brisket burger with truffle fries', ar: 'برجر بريسكت مدخن دبل'),
                  qty: 3,
                  amount: 1035.75,
                ),
              ],
            ),
          ],
        ),
    };

void _wholeBillTests() {
  for (final locale in phoneLocales) {
    final l10n = lookupAppLocalizations(locale);
    final lang = locale.languageCode;

    for (final (id, what) in [(1, 'the open bill of a room'), (2, 'a paid bill with a refund')]) {
      testWidgets('$what fits a phone from its header to its bar ($lang)', (tester) async {
        await usePhone(tester);
        await tester.pumpWidget(tillApp(
          TicketScreen(ticketId: id),
          locale: locale,
          overrides: [
            authServiceProvider.overrideWith(_Owner.new),
            ticketProvider(id).overrideWith((ref) async => _whole(id)),
            onlinePaymentsProvider(id).overrideWith((ref) async => const <OnlinePaymentView>[]),
            stayProvider(9).overrideWith((ref) async => _roomStay),
            orderRepositoryProvider.overrideWithValue(_NoPending()),
            branchPrintsKitchenTicketsProvider.overrideWith((ref) async => true),
          ],
        ));
        await tester.pump();
        await tester.pump(const Duration(milliseconds: 600));
        expectFits(tester);
        expect(find.byType(TicketActionBar), findsOneWidget);
        if (id == 1) expect(find.textContaining('Karim Mostafa'), findsWidgets);

        // Select mode on the open bill: the lines grow their checkboxes, the bar its two actions
        if (id == 1) {
          await tester.tap(find.byTooltip(l10n.selectLines));
          await tester.pump(const Duration(milliseconds: 600));
          expectFits(tester);
          expect(find.widgetWithText(FButton, l10n.assignCustomer), findsOneWidget);
          expect(find.widgetWithText(FButton, l10n.moveItems), findsOneWidget);
        }

        await tester.drag(find.byType(SingleChildScrollView).first, const Offset(0, -3000));
        await tester.pump(const Duration(milliseconds: 600));
        expectFits(tester);
        // The clock of the room ticks on: the tree goes before the test ends
        await tester.pumpWidget(const SizedBox.shrink());
      });
    }
  }
}

/// Ordering says each order was made, so a void asks what becomes of the food
class _Made implements OrderRepository {
  @override
  Future<Order> getOrderDetails(int orderId) async =>
      Order(id: orderId, date: DateTime(2026, 11, 20), status: OrderStatus.confirmed, total: 50, wasPrepared: true);

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

void _billDialogTests() {
  for (final locale in phoneLocales) {
    final lang = locale.languageCode;
    final paid = _whole(2);
    final dialogs = <String, Future<void> Function(BuildContext)>{
      'the breakdown': (context) => showBreakdownDialog(context, _bill()),
      'a discount': (context) => showDiscountDialog(context, _bill()),
      'a discard': (context) => showDiscardDialog(context, 7),
      'a void': (context) => showVoidDialog(context, 7, orderIds: [7, 8]),
      'the kitchen tickets': (context) => showKitchenReprint(context, _bill()),
      'a refund': (context) => showRefundDialog(context, paid),
      'a change of tender': (context) => showChangeTenderDialog(context, paid, paid.payments.first),
    };

    for (final MapEntry(key: what, value: open) in dialogs.entries) {
      testWidgets('$what fits a phone ($lang)', (tester) async {
        await usePhone(tester);
        await tester.pumpWidget(tillApp(
          opener(open),
          locale: locale,
          overrides: [
            authServiceProvider.overrideWith(_Owner.new),
            ticketsRepositoryProvider.overrideWithValue(_Tickets()),
            orderRepositoryProvider.overrideWithValue(_Made()),
          ],
        ));
        await tester.tap(find.text('open'));
        await tester.pumpAndSettle();
        expectFits(tester, reason: what);
        // To the foot of a dialog taller than the phone
        final scrolls = find.byType(SingleChildScrollView);
        if (scrolls.evaluate().isNotEmpty) {
          await tester.drag(scrolls.last, const Offset(0, -2000));
          // (a drag that starts on a button leaves its press timer running)
          await tester.pump(const Duration(milliseconds: 300));
          await tester.pumpAndSettle();
          expectFits(tester, reason: what);
        }
      });
    }
  }
}
