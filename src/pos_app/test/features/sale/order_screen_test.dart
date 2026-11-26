import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:pos_app/core/auth/auth_service.dart';
import 'package:pos_app/core/models/money.dart';
import 'package:pos_app/core/printing/kitchen_printing.dart';
import 'package:pos_app/core/sending/sending.dart';
import 'package:pos_app/core/utils/bidi.dart';
import 'package:pos_app/features/call_centre/call_centre_mode.dart';
import 'package:pos_app/features/catalog/models/catalog_item.dart';
import 'package:pos_app/features/catalog/providers/catalog_provider.dart';
import 'package:pos_app/features/deliveries/models/delivery_order.dart';
import 'package:pos_app/features/deliveries/providers/deliveries_provider.dart';
import 'package:pos_app/features/orders/models/order.dart';
import 'package:pos_app/features/orders/services/order_service.dart';
import 'package:pos_app/features/places/models/place.dart';
import 'package:pos_app/features/places/providers/places_provider.dart';
import 'package:pos_app/features/places/widgets/stay_strip.dart';
import 'package:pos_app/features/sale/models/pos_order_request.dart';
import 'package:pos_app/features/sale/providers/sale_provider.dart';
import 'package:pos_app/features/sale/screens/sale_pad_screen.dart';
import 'package:pos_app/features/sale/widgets/cart_line_row.dart';
import 'package:pos_app/features/sale/widgets/customer_field.dart';
import 'package:pos_app/features/sale/widgets/item_tile.dart';
import 'package:pos_app/features/sale/widgets/order_type_switch.dart';
import 'package:pos_app/features/sale/widgets/part_payment_sheet.dart';
import 'package:pos_app/features/sale/widgets/pay_who_sheet.dart';
import 'package:pos_app/features/sale/widgets/sale_order_panel.dart';
import 'package:pos_app/features/sale/widgets/send_sheet.dart';
import 'package:pos_app/features/sale/widgets/sent_lines.dart';
import 'package:pos_app/features/shifts/models/shift.dart';
import 'package:pos_app/features/shifts/services/shifts_service.dart';
import 'package:pos_app/features/tables/models/dining_table.dart';
import 'package:pos_app/features/tables/services/tables_service.dart';
import 'package:pos_app/features/ticket/dialogs/move_target_dialog.dart';
import 'package:pos_app/features/tickets/models/enums.dart';
import 'package:pos_app/features/tickets/models/online_payment.dart';
import 'package:pos_app/features/tickets/models/pricing.dart';
import 'package:pos_app/features/tickets/models/ticket_detail.dart';
import 'package:pos_app/features/tickets/providers/pricing_provider.dart';
import 'package:pos_app/features/tickets/providers/tickets_provider.dart';
import 'package:pos_app/features/tickets/models/ticket_summary.dart';
import 'package:pos_app/features/tickets/services/online_payments_service.dart';
import 'package:pos_app/features/tickets/services/tickets_service.dart';
import 'package:pos_app/l10n/app_localizations.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/phone.dart';

/// The order screen on an open bill: what is on it under what is being rung
/// up, nobody asked for a name until Send, and Settle when nothing is new.

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

class _Items extends CatalogItemsNotifier {
  @override
  Future<List<CatalogItem>> build() => SynchronousFuture([
        for (var i = 1; i <= 4; i++)
          CatalogItem(id: i, name: LocalizedText(en: 'Item number $i', ar: 'صنف رقم $i'), price: 40.0 + i, catalogTypeId: 1, displayOrder: i),
      ]);
}

class _Pricing extends PricingNotifier {
  @override
  Future<PricingView> build() async => const PricingView();
}

/// Ordering takes every round, and remembers what it was told
class _Orders implements OrderRepository {
  final List<PosOrderRequest> placed = [];

  @override
  Future<List<Order>> getPendingOrders() async => [];

  @override
  Future<int> createPosOrder(PosOrderRequest request, {required String requestId}) async {
    placed.add(request);
    return 900 + placed.length;
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

/// Sales, for what is done to a bill from its order screen: it remembers the part payments it took
class _Tickets implements TicketsRepository {
  final List<({int ticketId, double amount, String? payerName, List<int> lineIds})> taken = [];

  @override
  Future<List<TicketSummary>> getOpenTickets() async =>
      const [TicketSummary(id: 55, type: TicketType.counter, label: 'Karim Mostafa', total: 80)];

  @override
  Future<PartPaymentResult> takePartPayment(
    int ticketId, {
    required PaymentTender tender,
    required double amount,
    String? payerName,
    List<int> lineIds = const [],
    String? requestId,
  }) async {
    taken.add((ticketId: ticketId, amount: amount, payerName: payerName, lineIds: lineIds));
    return const PartPaymentResult(partPaymentIds: [1]);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

class _Tables implements TablesRepository {
  @override
  Future<List<DiningTable>> getTables() async => const [];
}

class _Shifts implements ShiftsRepository {
  @override
  Future<ShiftView?> getCurrentShift() async => null;

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

/// A room's stay while its clock runs: three people, one with an Arabic name
final _stay = Stay(
  id: 9,
  placeId: 12,
  placeName: const LocalizedText(en: 'PlayStation room 12', ar: 'غرفة بلايستيشن ١٢'),
  createdAt: DateTime(2026, 11, 20, 18),
  startedAt: DateTime(2026, 11, 20, 18),
  status: StayStatus.running,
  members: [
    StayMember(customerId: 'a', customerName: 'Mohamed Abdelrahman Elsayed', joinedAt: DateTime(2026, 11, 20, 18), role: 'Owner'),
    StayMember(customerId: 'b', customerName: 'Karim Mostafa', joinedAt: DateTime(2026, 11, 20, 18, 5), role: 'Member'),
    StayMember(customerId: 'c', customerName: 'منى عادل', joinedAt: DateTime(2026, 11, 20, 18, 9), role: 'Member'),
  ],
);

const _room = TicketDetail(
  id: 1,
  type: TicketType.room,
  sessionId: 9,
  placeId: 12,
  locationName: LocalizedText(en: 'PlayStation room 12', ar: 'غرفة بلايستيشن ١٢'),
  subtotal: 290,
  total: 290,
  lines: [
    TicketLineView(
      id: 1,
      orderId: 7,
      description: LocalizedText(en: 'Double smoked brisket burger with truffle fries', ar: 'برجر بريسكت مدخن دبل'),
      qty: 1,
      unitPrice: 100,
      total: 100,
      customerId: 'a',
      customerName: 'Mohamed Abdelrahman Elsayed',
    ),
    TicketLineView(
      id: 2,
      orderId: 8,
      description: LocalizedText(en: 'Double smoked brisket burger with truffle fries', ar: 'برجر بريسكت مدخن دبل'),
      qty: 1,
      unitPrice: 100,
      total: 100,
      customerId: 'a',
      customerName: 'Mohamed Abdelrahman Elsayed',
    ),
    TicketLineView(id: 3, orderId: 8, description: LocalizedText(en: 'Flat white', ar: 'فلات وايت'), qty: 2, unitPrice: 45, total: 90),
  ],
);

/// A table two people and the table itself ordered at, with service on top; one line is paid already
const _shared = TicketDetail(
  id: 3,
  type: TicketType.table,
  placeId: 5,
  locationName: LocalizedText(en: 'Terrace table 5', ar: 'طاولة التراس ٥'),
  subtotal: 260,
  serviceCharge: 26,
  serviceChargeRate: 0.1,
  total: 286,
  partPaid: 66,
  lines: [
    TicketLineView(id: 1, orderId: 7, description: LocalizedText(en: 'Burger', ar: 'برجر'), qty: 1, unitPrice: 100, total: 100, customerId: 'a', customerName: 'Mohamed Abdelrahman Elsayed'),
    TicketLineView(id: 2, orderId: 8, description: LocalizedText(en: 'Flat white', ar: 'فلات وايت'), qty: 2, unitPrice: 20, total: 40),
    TicketLineView(id: 3, orderId: 8, description: LocalizedText(en: 'Tea', ar: 'شاي'), qty: 1, unitPrice: 60, total: 60, customerName: 'منى عادل'),
    TicketLineView(id: 4, orderId: 9, description: LocalizedText(en: 'Cake', ar: 'كيك'), qty: 1, unitPrice: 60, total: 60, customerName: 'Karim Mostafa', paid: true),
  ],
);

const _emptyTable = TicketDetail(
  id: 2,
  type: TicketType.table,
  placeId: 4,
  locationName: LocalizedText(en: 'Terrace table 4', ar: 'طاولة التراس ٤'),
);

Widget _screen(TicketDetail? bill, {Locale locale = const Locale('en'), _Orders? orders, _Tickets? tickets}) => tillApp(
      SalePadScreen(ticketId: bill?.id),
      locale: locale,
      overrides: [
        authServiceProvider.overrideWith(_Owner.new),
        catalogItemsProvider.overrideWith(_Items.new),
        catalogCategoriesProvider
            .overrideWith((ref) async => const [CatalogCategory(id: 1, name: LocalizedText(en: 'Hot drinks', ar: 'مشروبات ساخنة'))]),
        pricingProvider.overrideWith(_Pricing.new),
        tillDeliveryTermsProvider.overrideWith((ref) async => const TillDeliveryQuote(delivers: true, fee: 20)),
        callCentreModeProvider.overrideWithValue(false),
        orderRepositoryProvider.overrideWithValue(orders ?? _Orders()),
        branchPrintsKitchenTicketsProvider.overrideWith((ref) async => false),
        ticketsRepositoryProvider.overrideWithValue(tickets ?? _Tickets()),
        tablesRepositoryProvider.overrideWithValue(_Tables()),
        shiftsRepositoryProvider.overrideWithValue(_Shifts()),
        if (bill != null) ...[
          ticketProvider(bill.id).overrideWith((ref) async => bill),
          onlinePaymentsProvider(bill.id).overrideWith((ref) async => const <OnlinePaymentView>[]),
          stayProvider(9).overrideWith((ref) async => _stay),
        ],
      ],
    );

void _tablet(WidgetTester tester) {
  tester.view.physicalSize = const Size(1280, 800);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}

/// The room's clock and a send on its way never settle: a few frames instead
Future<void> _frames(WidgetTester tester) async {
  await tester.pump();
  await tester.pump(const Duration(milliseconds: 400));
  await tester.pump(const Duration(milliseconds: 400));
}

void main() {
  setUpAll(loadTillFonts);
  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await initializeSale();
    await initializeSending();
  });

  for (final locale in phoneLocales) {
    final l10n = lookupAppLocalizations(locale);
    final lang = locale.languageCode;

    testWidgets('a room\'s bill is one list under its name, with its clock on one line and Settle at the foot ($lang)',
        (tester) async {
      _tablet(tester);
      await tester.pumpWidget(_screen(_room, locale: locale));
      await _frames(tester);
      expectFits(tester);

      final panel = find.byType(SaleOrderPanel);
      Finder inPanel(Finder what) => find.descendant(of: panel, matching: what);

      // Its head: the place and the bill's number, and the rest it can do
      expect(inPanel(find.text(_room.locationName!.getText(locale))), findsOneWidget);
      expect(inPanel(find.text(hashNumber(1))), findsOneWidget);
      expect(inPanel(find.byIcon(FIcons.ellipsis)), findsOneWidget);
      expect(inPanel(find.byIcon(FIcons.trash2)), findsNothing, reason: 'nothing new to clear');

      // The clock, one line; nobody is asked for a name while ringing up
      expect(inPanel(find.byType(StayStrip)), findsOneWidget);
      expect(find.byType(ChooseCustomerButton), findsNothing);
      expect(find.byType(SelectedCustomerChip), findsNothing);
      expect(find.byType(OrderTypeSwitch), findsNothing);
      expect(find.text(l10n.whoseRound), findsNothing);

      // What was sent: the same item for the same person is one line, saying whose under it in full
      expect(inPanel(find.byType(SentLines)), findsOneWidget);
      expect(inPanel(find.text('2×')), findsNWidgets(2));
      final name = inPanel(find.text('Mohamed Abdelrahman Elsayed'));
      expect(name, findsOneWidget);
      final item = tester.getRect(inPanel(find.text(_room.lines.first.description!.getText(locale))));
      final whose = tester.getRect(name);
      expect(whose.top, greaterThanOrEqualTo(item.bottom), reason: 'on its own line under the item');
      // Under its item at the line's start, whatever script it is written in
      if (lang == 'ar') {
        expect(whose.right, item.right);
      } else {
        expect(whose.left, item.left);
      }
      // Never run into the price
      final price = tester.getRect(inPanel(find.text(money(tester.element(panel), 200))).first);
      expect(lang == 'ar' ? whose.left >= price.right : whose.right <= price.left, isTrue);

      // The whole bill, and with nothing new the button takes the money
      expect(inPanel(find.text(l10n.total)), findsOneWidget);
      final settle = inPanel(find.widgetWithText(FButton, l10n.settleAction));
      expect(settle, findsOneWidget);
      expect(tester.widget<FButton>(settle).onPress, isNotNull);
      expect(inPanel(find.byType(FTextField)), findsNothing, reason: 'no note with nothing new');

      // The strip opens the rest of the room under it
      await tester.tap(find.byType(StayStrip));
      await _frames(tester);
      expectFits(tester);
      expect(inPanel(find.text(l10n.endSessionButton)), findsOneWidget);

      await tester.pumpWidget(const SizedBox.shrink());
    });

    testWidgets('what is new sits on top, and Send asks who it is for ($lang)', (tester) async {
      _tablet(tester);
      final orders = _Orders();
      await tester.pumpWidget(_screen(_room, locale: locale, orders: orders));
      await _frames(tester);

      await tester.tap(find.byType(ItemTile).at(0));
      await tester.pump();
      await tester.tap(find.byType(ItemTile).at(1));
      await _frames(tester);
      expectFits(tester);

      final panel = find.byType(SaleOrderPanel);
      Finder inPanel(Finder what) => find.descendant(of: panel, matching: what);
      expect(inPanel(find.text(l10n.newItems.toUpperCase())), findsOneWidget);
      expect(inPanel(find.text(l10n.sentItems.toUpperCase())), findsOneWidget);
      expect(inPanel(find.byType(CartLineRow)), findsNWidgets(2));
      expect(tester.getRect(inPanel(find.byType(CartLineRow)).last).bottom,
          lessThanOrEqualTo(tester.getRect(inPanel(find.byType(SentLines))).top));
      // The whole bill with what is new: 290 + 41 + 42
      expect(inPanel(find.text(money(tester.element(panel), 373))), findsOneWidget);

      // The button sends what is new, and says what that comes to
      final send = inPanel(find.widgetWithText(FButton, l10n.sendNewItems(2)));
      expect(send, findsOneWidget);
      expect(find.descendant(of: send, matching: find.text(money(tester.element(panel), 83))), findsOneWidget);
      await tester.tap(send);
      await _frames(tester);
      expectFits(tester);

      // Everyone the bill knows, by their whole name; anyone else; and nobody, said outright
      final sheet = find.byType(SendSheet);
      expect(sheet, findsOneWidget);
      for (final name in ['Mohamed Abdelrahman Elsayed', 'Karim Mostafa', 'منى عادل']) {
        expect(find.descendant(of: sheet, matching: find.widgetWithText(FButton, name)), findsOneWidget);
      }
      expect(find.descendant(of: sheet, matching: find.text(l10n.sendWhoAnother)), findsOneWidget);
      expect(find.descendant(of: sheet, matching: find.text(l10n.sendWhoNobody)), findsOneWidget);
      expect(find.descendant(of: sheet, matching: find.byIcon(FIcons.check)), findsNWidgets(2), reason: 'everything new is ticked');

      // The second item is someone else's: unticked, it stays for the next name
      await tester.tap(find.descendant(of: sheet, matching: find.text(const LocalizedText(en: 'Item number 2', ar: 'صنف رقم 2').getText(locale))));
      await tester.pump();
      await tester.tap(find.descendant(of: sheet, matching: find.widgetWithText(FButton, 'Karim Mostafa')));
      await _frames(tester);
      expectFits(tester);

      expect(orders.placed, hasLength(1));
      expect(orders.placed.single.ticketId, 1);
      expect(orders.placed.single.customer?.id, 'b');
      expect([for (final line in orders.placed.single.lines) line.productId], [1]);
      // The sheet stays for what is left, and the till stays on this screen
      expect(find.byType(SendSheet), findsOneWidget);
      expect(find.byType(SalePadScreen), findsOneWidget);
      expect(inPanel(find.byType(CartLineRow)), findsOneWidget);

      // The rest for nobody: the round is gone, and so is the sheet
      await tester.tap(find.descendant(of: find.byType(SendSheet), matching: find.text(l10n.sendWhoNobody)));
      await _frames(tester);
      await _frames(tester);
      expectFits(tester);
      expect(orders.placed, hasLength(2));
      expect(orders.placed.last.customer, isNull);
      expect([for (final line in orders.placed.last.lines) line.productId], [2]);
      expect(find.byType(SendSheet), findsNothing);
      expect(inPanel(find.byType(CartLineRow)), findsNothing);
      // Lines on their way hold the payment
      final foot = inPanel(find.widgetWithText(FButton, l10n.confirming));
      expect(foot, findsOneWidget);
      expect(tester.widget<FButton>(foot).onPress, isNull);

      await tester.pumpWidget(const SizedBox.shrink());
    });

    testWidgets('a phone opens a bill with lines on its order ($lang)', (tester) async {
      await usePhone(tester);
      await tester.pumpWidget(_screen(_room, locale: locale));
      await _frames(tester);
      await _frames(tester);
      expectFits(tester);

      final panel = find.byType(SaleOrderPanel);
      expect(panel, findsOneWidget, reason: 'the order, over the menu');
      expect(find.descendant(of: panel, matching: find.byType(SentLines)), findsOneWidget);
      expect(find.descendant(of: panel, matching: find.widgetWithText(FButton, l10n.settleAction)), findsOneWidget);
      for (final icon in const [FIcons.ellipsis, FIcons.x]) {
        final button = find.ancestor(of: find.descendant(of: panel, matching: find.byIcon(icon)), matching: find.byType(FButton));
        expect(tester.getSize(button.first).height, greaterThanOrEqualTo(48), reason: '$icon');
      }

      await tester.pumpWidget(const SizedBox.shrink());
    });

    testWidgets('split or move turns the sent lines into boxes to tick, with two things to do with them ($lang)',
        (tester) async {
      _tablet(tester);
      await tester.pumpWidget(_screen(_room, locale: locale));
      await _frames(tester);
      final panel = find.byType(SaleOrderPanel);
      Finder inPanel(Finder what) => find.descendant(of: panel, matching: what);

      await tester.tap(inPanel(find.byIcon(FIcons.ellipsis)));
      await _frames(tester);
      await tester.tap(find.text(l10n.splitOrMove));
      await _frames(tester);
      expectFits(tester);

      // Each sent line stands alone, and nothing is ticked yet
      expect(inPanel(find.text('1×')), findsNWidgets(2));
      expect(inPanel(find.text('2×')), findsOneWidget);
      expect(inPanel(find.byIcon(FIcons.check)), findsNothing);
      expect(inPanel(find.widgetWithText(FButton, l10n.settleAction)), findsNothing);
      expect(inPanel(find.text(l10n.selectedLinesCount(0))), findsOneWidget);
      // Two buttons side by side at one width, waiting for a line
      final assign = inPanel(find.widgetWithText(FButton, l10n.assignCustomer));
      final move = inPanel(find.widgetWithText(FButton, l10n.moveItems));
      expect(tester.getSize(assign), tester.getSize(move));
      expect(tester.getRect(assign).top, tester.getRect(move).top);
      expect(tester.widget<FButton>(assign).onPress, isNull);
      expect(tester.widget<FButton>(move).onPress, isNull);

      // A tap ticks a line; Cancel puts the order back as it was
      final flatWhite = inPanel(find.text(_room.lines.last.description!.getText(locale)));
      await tester.tap(flatWhite);
      await tester.pump();
      expect(inPanel(find.byIcon(FIcons.check)), findsOneWidget);
      expect(inPanel(find.text(l10n.selectedLinesCount(1))), findsOneWidget);
      expect(tester.widget<FButton>(move).onPress, isNotNull);
      await tester.tap(inPanel(find.widgetWithText(FButton, l10n.cancel)));
      await tester.pump();
      expect(inPanel(find.widgetWithText(FButton, l10n.settleAction)), findsOneWidget);
      expect(inPanel(find.text('2×')), findsNWidgets(2), reason: 'merged again');

      // Picked again, Move is one dialog over the order: the till stays on this screen
      await tester.tap(inPanel(find.byIcon(FIcons.ellipsis)));
      await _frames(tester);
      await tester.tap(find.text(l10n.splitOrMove));
      await _frames(tester);
      await tester.tap(inPanel(find.text(_room.lines.last.description!.getText(locale))));
      await tester.pump();
      await tester.tap(inPanel(find.widgetWithText(FButton, l10n.moveItems)));
      await _frames(tester);
      expectFits(tester);
      expect(find.byType(MoveTargetList), findsOneWidget);
      expect(find.text(l10n.moveItemsTitle(1)), findsOneWidget);
      expect(find.text('Karim Mostafa'), findsOneWidget, reason: 'the open tab they can go to');
      expect(find.text(l10n.moveSecondBillHint), findsNothing, reason: 'a room never gets a second bill');
      expect(find.byType(SalePadScreen), findsOneWidget);

      await tester.pumpWidget(const SizedBox.shrink());
    });

    testWidgets('a bill that is more than one person\'s asks who is paying, and takes one part ($lang)', (tester) async {
      _tablet(tester);
      final tickets = _Tickets();
      await tester.pumpWidget(_screen(_shared, locale: locale, tickets: tickets));
      await _frames(tester);
      expectFits(tester);
      final panel = find.byType(SaleOrderPanel);
      Finder inPanel(Finder what) => find.descendant(of: panel, matching: what);
      final context = tester.element(panel);

      // What was paid and what is left, at the order's foot
      expect(inPanel(find.text(l10n.partPaidSoFar(money(context, 66)))), findsOneWidget);
      expect(inPanel(find.text(l10n.leftToPay(money(context, 220)))), findsOneWidget);
      expect(inPanel(find.text(l10n.paidTag)), findsOneWidget);

      await tester.tap(inPanel(find.widgetWithText(FButton, l10n.settleAction)));
      await _frames(tester);
      expectFits(tester);
      final who = find.byType(PayWhoSheet);
      Finder inWho(Finder what) => find.descendant(of: who, matching: what);
      expect(who, findsOneWidget);
      // The rest in one payment, then whoever still has something to pay: never the one who paid
      expect(inWho(find.text(l10n.payTheRest)), findsOneWidget);
      expect(inWho(find.text(money(context, 220))), findsOneWidget);
      expect(inWho(find.text('Mohamed Abdelrahman Elsayed')), findsOneWidget);
      expect(inWho(find.text(_shared.locationName!.getText(locale))), findsOneWidget, reason: 'the lines that were nobody\'s');
      expect(inWho(find.text('منى عادل')), findsOneWidget);
      expect(inWho(find.text('Karim Mostafa')), findsNothing);

      // One person's part: their items with their share of the service
      await tester.tap(inWho(find.text('منى عادل')));
      await _frames(tester);
      expectFits(tester);
      expect(find.byType(PayWhoSheet), findsNothing);
      final part = find.byType(PartPaymentSheet);
      expect(part, findsOneWidget);
      expect(find.descendant(of: part, matching: find.textContaining('منى عادل')), findsOneWidget);
      final take = find.descendant(of: part, matching: find.widgetWithText(FButton, l10n.partPayTake(money(context, 66))));
      expect(take, findsOneWidget);
      await tester.tap(take);
      await _frames(tester);

      expect(tickets.taken, hasLength(1));
      expect(tickets.taken.single.ticketId, 3);
      expect(tickets.taken.single.amount, 66);
      expect(tickets.taken.single.payerName, 'منى عادل');
      expect(tickets.taken.single.lineIds, [3]);
      // The bill stays open, and the till on its order
      expect(find.byType(PartPaymentSheet), findsNothing);
      expect(find.byType(SalePadScreen), findsOneWidget);
      expect(find.text(l10n.partPaymentTaken(money(context, 66))), findsOneWidget);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(seconds: 10));
    });
  }

  testWidgets('a new bill starts on the menu, and says how to start', (tester) async {
    await usePhone(tester);
    await tester.pumpWidget(_screen(_emptyTable));
    await _frames(tester);
    expectFits(tester);
    expect(find.byType(SaleOrderPanel), findsNothing, reason: 'nothing on it: the menu first');

    _tablet(tester);
    await tester.pumpWidget(_screen(_emptyTable));
    await _frames(tester);
    expectFits(tester);
    final l10n = lookupAppLocalizations(const Locale('en'));
    expect(find.text(l10n.orderEmptyHint), findsOneWidget);
    final settle = find.widgetWithText(FButton, l10n.settleAction);
    expect(tester.widget<FButton>(settle).onPress, isNull, reason: 'nothing to pay for');

    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('a new sale has one optional customer under a counter or delivery switch', (tester) async {
    _tablet(tester);
    final l10n = lookupAppLocalizations(const Locale('en'));
    await tester.pumpWidget(_screen(null));
    await tester.pumpAndSettle();
    expectFits(tester);

    final panel = find.byType(SaleOrderPanel);
    final type = find.descendant(of: panel, matching: find.byType(OrderTypeSwitch));
    final customer = find.descendant(of: panel, matching: find.byType(ChooseCustomerButton));
    expect(type, findsOneWidget);
    expect(customer, findsOneWidget);
    expect(tester.getRect(type).bottom, lessThanOrEqualTo(tester.getRect(customer).top));
    // Counter is what it is until Delivery is asked for
    final counter = find.descendant(of: type, matching: find.widgetWithText(FButton, l10n.orderTypeCounter));
    final delivery = find.descendant(of: type, matching: find.widgetWithText(FButton, l10n.deliverIt));
    expect(tester.getSize(counter).width, tester.getSize(delivery).width);
    expect(find.descendant(of: panel, matching: find.text(hashNumber(1))), findsNothing);
    expect(find.descendant(of: panel, matching: find.byIcon(FIcons.ellipsis)), findsNothing);
    expect(find.descendant(of: panel, matching: find.widgetWithText(FButton, l10n.chargeAction)), findsOneWidget);
  });
}
