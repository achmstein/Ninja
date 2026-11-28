import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:pos_app/core/auth/auth_service.dart';
import 'package:pos_app/core/models/money.dart';
import 'package:pos_app/core/printing/kitchen_printing.dart';
import 'package:pos_app/core/sending/sending.dart';
import 'package:pos_app/core/utils/bidi.dart';
import 'package:pos_app/features/call_centre/call_centre_mode.dart';
import 'package:pos_app/features/catalog/models/catalog_item.dart';
import 'package:pos_app/features/catalog/providers/catalog_provider.dart';
import 'package:pos_app/features/customers/screens/customer_search_screen.dart';
import 'package:pos_app/features/customers/services/customer_search_service.dart';
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
import 'package:pos_app/features/sale/widgets/item_tile.dart';
import 'package:pos_app/features/sale/widgets/order_type_switch.dart';
import 'package:pos_app/features/sale/widgets/part_payment_sheet.dart';
import 'package:pos_app/features/sale/widgets/pay_who_sheet.dart';
import 'package:pos_app/features/sale/widgets/bill_people_row.dart';
import 'package:pos_app/features/sale/widgets/sale_order_panel.dart';
import 'package:pos_app/core/brand/brand_provider.dart' show compactTillItemsProvider;
import 'package:pos_app/features/sale/widgets/bill_menu.dart';
import 'package:pos_app/features/sale/widgets/sent_lines.dart';
import 'package:pos_app/features/shifts/models/shift.dart';
import 'package:pos_app/features/shifts/services/shifts_service.dart';
import 'package:pos_app/features/tables/models/dining_table.dart';
import 'package:pos_app/features/tables/services/tables_service.dart';
import 'package:pos_app/features/ticket/dialogs/move_target_dialog.dart';
import 'package:pos_app/features/tickets/models/enums.dart';
import 'package:pos_app/features/tickets/models/move_lines.dart';
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
        isOwner: true,
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

  /// Whole orders told whose they are
  final List<({int orderId, String? customerId, String name})> named = [];

  @override
  Future<void> assignOrderCustomer(int orderId,
      {String? customerUserId, required String customerName, String? requestId}) async {
    named.add((orderId: orderId, customerId: customerUserId, name: customerName));
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

  /// Part payments given back, lines moved and lines told whose they are
  final List<({int ticketId, int partPaymentId})> returned = [];
  final List<({int ticketId, MoveLinesRequest request})> moved = [];
  final List<({int ticketId, List<int> lineIds, String? customerId, String name})> named = [];

  @override
  Future<PartPaymentResult> returnPartPayment(int ticketId, int partPaymentId, {String? requestId}) async {
    returned.add((ticketId: ticketId, partPaymentId: partPaymentId));
    return PartPaymentResult(partPaymentIds: [partPaymentId]);
  }

  @override
  Future<int> moveLines(int id, MoveLinesRequest request, {String? requestId}) async {
    moved.add((ticketId: id, request: request));
    final target = request.target;
    return target is MoveToTicket ? target.ticketId : 77;
  }

  @override
  Future<void> assignLinesCustomer(int id,
      {required List<int> lineIds, String? customerId, required String customerName, String? requestId}) async {
    named.add((ticketId: id, lineIds: lineIds, customerId: customerId, name: customerName));
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

/// Nobody in the directory: the room's own people are offered first
class _Customers implements CustomerSearchService {
  @override
  Future<List<IdentityUser>> search(String term, {int max = 20}) async => const [];
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
  partPayments: [PartPayment(id: 4, tender: PaymentTender.cash, amount: 66, payerName: 'Karim Mostafa', lineIds: [4])],
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
      overrides: _overrides(bill, orders: orders, tickets: tickets),
    );

/// The bill on the till's router, with a plain page wherever else it may go
Widget _routed(TicketDetail bill, {_Orders? orders, _Tickets? tickets}) => tillRouterApp(
      GoRouter(
        initialLocation: '/order/${bill.id}',
        routes: [
          GoRoute(path: '/', builder: (_, _) => const Scaffold(body: Text('the floor'))),
          GoRoute(
            path: '/order/:id',
            builder: (_, state) => Scaffold(
              body: state.pathParameters['id'] == '${bill.id}'
                  ? SalePadScreen(ticketId: bill.id)
                  : Text('bill ${state.pathParameters['id']}'),
            ),
          ),
        ],
      ),
      overrides: _overrides(bill, orders: orders, tickets: tickets),
    );

List _overrides(TicketDetail? bill, {_Orders? orders, _Tickets? tickets}) => [
        customerSearchServiceProvider.overrideWithValue(_Customers()),
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
      ];

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
      expect(find.byType(OrderTypeSwitch), findsNothing);
      expect(find.text(l10n.whoseRound), findsNothing);

      // What was sent: the same item for the same person is one line, saying whose under it in full
      expect(inPanel(find.byType(SentLines)), findsOneWidget);
      expect(inPanel(find.text('2×')), findsNWidgets(2));
      final name = find.descendant(of: find.byType(SentLines), matching: find.text('Mohamed Abdelrahman Elsayed'));
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

    testWidgets('a name is tapped first, each new line says whose it is, and Send asks nothing ($lang)', (tester) async {
      _tablet(tester);
      final orders = _Orders();
      await tester.pumpWidget(_screen(_room, locale: locale, orders: orders));
      await _frames(tester);

      final panel = find.byType(SaleOrderPanel);
      Finder inPanel(Finder what) => find.descendant(of: panel, matching: what);
      // Everyone the bill knows, by their whole name, over the order; and the way to add one more
      // By their first names, so the row holds them; the whole name stays on the order's lines
      final row = find.byType(BillPeopleRow);
      for (final name in ['Mohamed', 'Karim', 'منى']) {
        expect(find.descendant(of: row, matching: find.text(name)), findsOneWidget);
      }
      // With names in it, the way to add another is a square button at the row's end
      expect(find.descendant(of: row, matching: find.byIcon(FIcons.userPlus)), findsOneWidget);
      expect(find.descendant(of: row, matching: find.text(l10n.anotherCustomer)), findsNothing);
      // The room's people are these names: its details no longer list them
      await tester.tap(find.byType(StayStrip));
      await _frames(tester);
      expect(inPanel(find.text(l10n.inTheRoom.toUpperCase())), findsNothing);
      await tester.tap(find.byType(StayStrip));
      await _frames(tester);

      // Nobody tapped: the first item is nobody's
      await tester.tap(find.byType(ItemTile).at(0));
      await tester.pump();
      // Karim tapped: the next is his, and says so on its line
      // The names are one row that swipes: his is brought into view, as a finger would
      await tester.ensureVisible(find.descendant(of: row, matching: find.text('Karim')));
      await tester.pump();
      await tester.tap(find.descendant(of: row, matching: find.text('Karim')));
      await _frames(tester);
      await tester.tap(find.byType(ItemTile).at(1));
      await _frames(tester);
      expectFits(tester);

      expect(inPanel(find.text(l10n.newItems.toUpperCase())), findsOneWidget);
      expect(inPanel(find.text(l10n.sentItems.toUpperCase())), findsOneWidget);
      expect(inPanel(find.byType(CartLineRow)), findsNWidgets(2));
      expect(find.descendant(of: inPanel(find.byType(CartLineRow)).first, matching: find.text('Karim Mostafa')), findsNothing);
      expect(find.descendant(of: inPanel(find.byType(CartLineRow)).last, matching: find.text('Karim Mostafa')), findsOneWidget);
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
      await _frames(tester);
      expectFits(tester);

      // Nothing was asked: each person's lines went as their own round, and the till stays on this screen
      expect(orders.placed, hasLength(2));
      expect(orders.placed.every((order) => order.ticketId == 1), isTrue);
      final nobodys = orders.placed.singleWhere((order) => order.customer == null);
      final karims = orders.placed.singleWhere((order) => order.customer?.id == 'b');
      expect([for (final line in nobodys.lines) line.productId], [1]);
      expect([for (final line in karims.lines) line.productId], [2]);
      expect(find.byType(SalePadScreen), findsOneWidget);
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

      // A tap ticks a line; Back puts the order back as it was
      final flatWhite = inPanel(find.text(_room.lines.last.description!.getText(locale)));
      await tester.tap(flatWhite);
      await tester.pump();
      expect(inPanel(find.byIcon(FIcons.check)), findsOneWidget);
      expect(inPanel(find.text(l10n.selectedLinesCount(1))), findsOneWidget);
      expect(tester.widget<FButton>(move).onPress, isNotNull);
      // An owner can also cancel the ticked item, the bill staying open
      final cancelItems = inPanel(find.widgetWithText(FButton, l10n.cancelItemsAction(1)));
      expect(tester.widget<FButton>(cancelItems).onPress, isNotNull);
      expectFits(tester);
      await tester.tap(inPanel(find.widgetWithText(FButton, l10n.goBack)));
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
      expect(find.descendant(of: find.byType(MoveTargetList), matching: find.text('Karim Mostafa')), findsOneWidget,
          reason: 'the open tab they can go to');
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
      final take = find.descendant(of: part, matching: find.widgetWithText(FButton, l10n.partPayTakeWith(l10n.cash)));
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

  /// Split or move, then the sent lines with these words ticked
  Future<void> pick(WidgetTester tester, AppLocalizations l10n, List<Finder> lines) async {
    final panel = find.byType(SaleOrderPanel);
    await tester.tap(find.descendant(of: panel, matching: find.byIcon(FIcons.ellipsis)));
    await _frames(tester);
    await tester.tap(find.text(l10n.splitOrMove));
    await _frames(tester);
    for (final line in lines) {
      await tester.tap(find.descendant(of: panel, matching: line).first);
      await tester.pump();
    }
  }

  testWidgets('moving picked lines to an open bill is one tap, and the till follows them there', (tester) async {
    _tablet(tester);
    final l10n = lookupAppLocalizations(const Locale('en'));
    final tickets = _Tickets();
    await tester.pumpWidget(_routed(_room, tickets: tickets));
    await _frames(tester);
    expectFits(tester);

    await pick(tester, l10n, [find.text('Flat white')]);
    await tester.tap(find.widgetWithText(FButton, l10n.moveItems));
    await _frames(tester);
    await tester.tap(find.descendant(of: find.byType(MoveTargetList), matching: find.text('Karim Mostafa')));
    await _frames(tester);
    await _frames(tester);
    expectFits(tester);

    expect(tickets.moved, hasLength(1));
    expect(tickets.moved.single.ticketId, 1);
    expect(tickets.moved.single.request.lineIds, [3]);
    expect(tickets.moved.single.request.target, isA<MoveToTicket>().having((t) => t.ticketId, 'ticketId', 55));
    expect(find.byType(MoveTargetList), findsNothing);
    expect(find.text('bill 55'), findsOneWidget, reason: 'on the bill the lines went to');
    expect(find.byType(SalePadScreen), findsNothing);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 10));
  });

  testWidgets('picked lines are told whose they are: a whole order through Ordering, part of one on its lines',
      (tester) async {
    _tablet(tester);
    final l10n = lookupAppLocalizations(const Locale('en'));
    final orders = _Orders();
    final tickets = _Tickets();
    await tester.pumpWidget(_screen(_room, orders: orders, tickets: tickets));
    await _frames(tester);
    final panel = find.byType(SaleOrderPanel);

    // The first burger is all of its order; the flat white shares its order with the other burger
    await pick(tester, l10n, [find.text(_room.lines.first.description!.getText(const Locale('en'))),find.text('Flat white')]);
    await tester.tap(find.widgetWithText(FButton, l10n.assignCustomer));
    await _frames(tester);
    await _frames(tester);
    expectFits(tester);

    // The whole-screen search, the room's own people before anyone else
    final search = find.byType(CustomerSearchScreen);
    expect(search, findsOneWidget);
    await tester.tap(find.descendant(of: search, matching: find.text('Karim Mostafa')).first);
    await _frames(tester);
    await _frames(tester);
    expectFits(tester);

    expect(find.byType(CustomerSearchScreen), findsNothing);
    expect(orders.named, [(orderId: 7, customerId: 'b', name: 'Karim Mostafa')]);
    expect(tickets.named, hasLength(1));
    expect(tickets.named.single.ticketId, 1);
    expect(tickets.named.single.lineIds, [3]);
    expect(tickets.named.single.customerId, 'b');
    expect(tickets.named.single.name, 'Karim Mostafa');
    // Said, and the order is back as it was
    expect(find.text(l10n.customerAssigned), findsOneWidget);
    expect(find.descendant(of: panel, matching: find.widgetWithText(FButton, l10n.settleAction)), findsOneWidget);
    expect(find.byType(SalePadScreen), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 10));
  });

  testWidgets('an owner gives a part payment back from the menu of the bill, once sure', (tester) async {
    _tablet(tester);
    final l10n = lookupAppLocalizations(const Locale('en'));
    final tickets = _Tickets();
    await tester.pumpWidget(_screen(_shared, tickets: tickets));
    await _frames(tester);
    final panel = find.byType(SaleOrderPanel);
    final amount = money(tester.element(panel), 66);

    await tester.tap(find.descendant(of: panel, matching: find.byIcon(FIcons.ellipsis)));
    await _frames(tester);
    // Whose it was, beside what it was
    final row = find.textContaining(l10n.partGiveBack(amount));
    expect(row, findsOneWidget);
    await tester.tap(row);
    await _frames(tester);
    expectFits(tester);

    // Asked first: nothing is given back until it is said again
    expect(find.text(l10n.partGiveBackHint), findsOneWidget);
    expect(tickets.returned, isEmpty);
    await tester.tap(find.widgetWithText(FButton, l10n.partGiveBack(amount)));
    await _frames(tester);
    await _frames(tester);
    expectFits(tester);

    expect(tickets.returned, [(ticketId: 3, partPaymentId: 4)]);
    expect(find.text(l10n.partGivenBack), findsOneWidget);
    expect(find.byType(SalePadScreen), findsOneWidget);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 10));
  });

  testWidgets('paying the rest of a shared bill goes on to the payment page, for what is left', (tester) async {
    _tablet(tester);
    final l10n = lookupAppLocalizations(const Locale('en'));
    final tickets = _Tickets();
    await tester.pumpWidget(_screen(_shared, tickets: tickets));
    await _frames(tester);
    final panel = find.byType(SaleOrderPanel);
    final left = money(tester.element(panel), 220);

    await tester.tap(find.descendant(of: panel, matching: find.widgetWithText(FButton, l10n.settleAction)));
    await _frames(tester);
    await tester.tap(find.descendant(of: find.byType(PayWhoSheet), matching: find.text(l10n.payTheRest)));
    await _frames(tester);
    await _frames(tester);
    expectFits(tester);

    expect(find.byType(PayWhoSheet), findsNothing);
    expect(find.byType(PartPaymentSheet), findsNothing);
    final page = find.byWidgetPredicate((widget) => '${widget.runtimeType}' == '_SettleScreen');
    expect(page, findsOneWidget);
    // What was paid in parts is not asked for again
    expect(find.descendant(of: page, matching: find.textContaining(left)), findsWidgets);
    expect(tickets.taken, isEmpty);

    await tester.pumpWidget(const SizedBox.shrink());
    await tester.pump(const Duration(seconds: 10));
  });

  testWidgets('the rule under the head of the menu and the one under the head of the order meet in one line on a bill', (tester) async {
    _tablet(tester);
    // Text tiles: the menu's head is the search, always in view
    await tester.pumpWidget(tillApp(
      SalePadScreen(ticketId: _room.id),
      locale: const Locale('ar'),
      overrides: [..._overrides(_room, tickets: _Tickets()), compactTillItemsProvider.overrideWithValue(true)],
    ));
    await _frames(tester);
    // Each head is a box with a rule under it: the search's on the menu side, the bill's menu's on the order side
    double headBottom(Finder inside) =>
        tester.getBottomLeft(find.ancestor(of: inside, matching: find.byType(Container)).first).dy;
    final menuSide = headBottom(find.byIcon(FIcons.arrowLeft).first);
    final orderSide = headBottom(find.byType(BillMenu));
    expect(orderSide, menuSide);
    await tester.pumpWidget(const SizedBox.shrink());
  });

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
    // The customer is the same row a bill names its people on: with nobody yet, the way to add one
    final customer = find.descendant(of: panel, matching: find.byType(BillPeopleRow));
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
