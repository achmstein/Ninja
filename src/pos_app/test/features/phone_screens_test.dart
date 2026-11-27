import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:ninja_app_core/network/network_status.dart';
import 'package:ninja_app_core/services/update_service.dart';
import 'package:pos_app/features/tickets/models/refund.dart';
import 'package:pos_app/features/receipts/widgets/receipt_pane.dart';
import 'package:pos_app/core/models/money.dart';
import 'package:pos_app/core/auth/auth_service.dart';
import 'package:pos_app/core/utils/bidi.dart';
import 'package:pos_app/core/offline/offline_queue.dart';
import 'package:pos_app/core/offline/offline_sale.dart';
import 'package:pos_app/features/availability/screens/availability_screen.dart';
import 'package:pos_app/features/catalog/models/catalog_item.dart';
import 'package:pos_app/features/catalog/services/catalog_service.dart';
import 'package:pos_app/features/receipt/receipt_preview_dialog.dart';
import 'package:pos_app/features/receipts/screens/receipts_screen.dart';
import 'package:pos_app/features/settings/screens/settings_screen.dart';
import 'package:pos_app/features/tickets/models/enums.dart';
import 'package:pos_app/features/tickets/models/settle.dart';
import 'package:pos_app/features/tickets/models/settled_ticket_summary.dart';
import 'package:pos_app/features/tickets/models/ticket_detail.dart';
import 'package:pos_app/features/tickets/providers/tickets_provider.dart';
import 'package:pos_app/features/tickets/services/tickets_service.dart';
import 'package:pos_app/l10n/app_localizations.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../support/phone.dart';

/// Receipts with six-figure totals, long names and money given back
class _Tickets implements TicketsRepository {
  @override
  Future<List<SettledTicketSummary>> getSettledTickets({int pageIndex = 0, int pageSize = 50, int? receiptNumber}) async => [
        for (var i = 0; i < 12; i++)
          SettledTicketSummary(
            id: i + 1,
            receiptNumber: 120481 - i,
            type: TicketType.values[i % 3],
            locationName: i.isEven ? const LocalizedText(en: 'PlayStation room 12', ar: 'غرفة بلايستيشن ١٢') : null,
            label: i.isEven ? null : 'Mohamed Abdelrahman Elsayed',
            settledAt: DateTime(2026, 11, 20, 23, 45),
            total: 142375.97,
            refundedTotal: i % 4 == 0 ? 1035.75 : 0,
          ),
      ];

  final refunded = <({int ticketId, RefundRequest request})>[];

  @override
  Future<RefundResult> refund(int id, RefundRequest request, {String? requestId}) async {
    refunded.add((ticketId: id, request: request));
    return const RefundResult(number: 7, amount: 60);
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

/// A closed bill of two lattes, as the receipts list's rows number them
TicketDetail _receipt(int id) => TicketDetail(
      id: id,
      type: TicketType.table,
      status: TicketStatus.settled,
      receiptNumber: 120482 - id,
      settledAt: DateTime(2026, 11, 20, 23, 45),
      settledBy: 'Mona',
      subtotal: 120,
      total: 120,
      lines: const [TicketLineView(id: 1, description: LocalizedText(en: 'Latte', ar: 'Latte'), qty: 2, unitPrice: 60, total: 120)],
      payments: const [PaymentView(id: 1, tender: PaymentTender.cash, amount: 120)],
    );

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
}

class _Catalog implements CatalogRepository {
  @override
  Future<List<CatalogCategory>> getCategories() async => const [
        CatalogCategory(id: 1, name: LocalizedText(en: 'Burgers and sandwiches', ar: 'برجر وساندوتشات')),
        CatalogCategory(id: 2, name: LocalizedText(en: 'Hot drinks', ar: 'مشروبات ساخنة'), displayOrder: 1),
        CatalogCategory(id: 3, name: LocalizedText(en: 'Cold drinks and smoothies', ar: 'مشروبات باردة وسموذي'), displayOrder: 2),
        CatalogCategory(id: 4, name: LocalizedText(en: 'Desserts', ar: 'حلويات'), displayOrder: 3),
      ];

  @override
  Future<List<CatalogItem>> getItems() async => [
        for (var i = 0; i < 6; i++)
          CatalogItem(
            id: i + 1,
            name: const LocalizedText(
              en: 'Double smoked brisket burger with truffle fries',
              ar: 'برجر بريسكت مدخن دبل مع بطاطس الكمأة',
            ),
            price: 1345.25,
            catalogTypeId: 1,
            isAvailable: i.isEven,
            displayOrder: i,
          ),
      ];

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

class _UpdateWaiting extends UpdateNotifier {
  @override
  UpdateState build() => const UpdateState(phase: UpdatePhase.needsPermission, installedVersion: '2026.11.20', installedBuild: 4812);
}

class _Online extends OnlineNotifier {
  @override
  bool build() => true;
}

/// One sale still waiting and one the server refused
class _Queue extends OfflineQueueNotifier {
  @override
  List<OfflineSale> build() => [
        for (final status in [OfflineSaleStatus.queued, OfflineSaleStatus.failed])
          OfflineSale(
            id: status.name,
            settleRequestId: status.name,
            placedAt: DateTime(2026, 11, 20, 21, 5),
            branchId: 1,
            provisionalReceiptNumber: 'OFF-20261120-0042',
            lines: const [],
            payments: const [SettlePayment(tender: PaymentTender.cash, amount: 142375.97)],
            subtotal: 124890.33,
            vat: 17485.64,
            total: 142375.97,
            change: 0,
            status: status,
            error: status == OfflineSaleStatus.failed ? 'The shift this sale was taken in has been closed' : null,
          ),
      ];
}

void main() {
  setUpAll(loadTillFonts);
  setUp(() => SharedPreferences.setMockInitialValues({}));

  Future<void> toTheFoot(WidgetTester tester) async {
    await tester.drag(find.byType(SingleChildScrollView).first, const Offset(0, -3000));
    await tester.pump(const Duration(milliseconds: 300));
    await tester.pumpAndSettle();
  }

  for (final locale in phoneLocales) {
    final lang = locale.languageCode;
    final l10n = lookupAppLocalizations(locale);

    testWidgets('the receipts fit a phone ($lang)', (tester) async {
      await usePhone(tester);
      await tester.pumpWidget(tillApp(
        const ReceiptsScreen(),
        locale: locale,
        overrides: [ticketsRepositoryProvider.overrideWithValue(_Tickets())],
      ));
      // The skeleton rows, then the receipts
      await tester.pump();
      expectFits(tester);
      await tester.pumpAndSettle();
      expectFits(tester);
      await toTheFoot(tester);
      expectFits(tester);
    });

    testWidgets('on a wide screen a receipt is worked on beside the list, across the whole width ($lang)', (tester) async {
      tester.view.physicalSize = const Size(1280, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      final tickets = _Tickets();
      await tester.pumpWidget(tillApp(
        const ReceiptsScreen(),
        locale: locale,
        overrides: [
          ticketsRepositoryProvider.overrideWithValue(tickets),
          authServiceProvider.overrideWith(_Owner.new),
          for (final id in [1, 3]) ticketProvider(id).overrideWith((ref) async => _receipt(id)),
        ],
      ));
      await tester.pumpAndSettle();
      expectFits(tester);

      // The newest receipt beside the list: what was on it, and what is done to it, in one place
      final pane = find.byType(ReceiptPane);
      Finder inPane(Finder what) => find.descendant(of: pane, matching: what);
      expect(pane, findsOneWidget);
      expect(inPane(find.text(l10n.receiptNumber(120481))), findsOneWidget);
      expect(inPane(find.text('Latte')), findsOneWidget);
      expect(inPane(find.widgetWithText(FButton, l10n.print)), findsOneWidget);
      expect(inPane(find.widgetWithText(FButton, l10n.refundTicket)), findsOneWidget);
      // Two panels and nothing else: the list at the start, the receipt across all the rest
      final rect = tester.getRect(pane);
      final list = 1280 - rect.width;
      expect(list, inInclusiveRange(320, 448));
      expect(locale.languageCode == 'ar' ? rect.left : rect.right, locale.languageCode == 'ar' ? 0 : 1280);
      // Its lines run the pane's width: the amount sits at the pane's far edge, not in a column held to the middle
      final amount = tester.getRect(inPane(find.text(money(tester.element(pane), 120))).first);
      expect(locale.languageCode == 'ar' ? amount.left - rect.left : rect.right - amount.right, lessThanOrEqualTo(24));

      // Another receipt is a tap on the list: it shows in the same place, the list staying where it was
      await tester.tap(find.text(hashNumber(120479)));
      await tester.pumpAndSettle();
      expectFits(tester);
      expect(inPane(find.text(l10n.receiptNumber(120479))), findsOneWidget);

      // A refund is made where the receipt is read: the pane turns to it, and back once it is made
      await tester.tap(inPane(find.widgetWithText(FButton, l10n.refundTicket)));
      await tester.pumpAndSettle();
      expectFits(tester);
      expect(inPane(find.text(l10n.refundTitle(120479))), findsOneWidget);
      // Nothing picked and no reason yet: nothing to give back
      Finder confirm() => inPane(find.widgetWithText(FButton, l10n.refundTicket));
      expect(tester.widget<FButton>(confirm()).onPress, isNull);
      await tester.tap(inPane(find.byIcon(FIcons.plus)).first);
      await tester.pump();
      expect(tester.widget<FButton>(confirm()).onPress, isNull, reason: 'a reason is the audit trail');
      await tester.tap(inPane(find.widgetWithText(FButton, l10n.refundReasonWrongOrder)));
      await tester.pump();
      expect(tester.widget<FButton>(confirm()).onPress, isNotNull);
      await tester.tap(confirm());
      await tester.pumpAndSettle();

      expect(tickets.refunded, hasLength(1));
      expect(tickets.refunded.single.ticketId, 3);
      expect(tickets.refunded.single.request.reason, l10n.refundReasonWrongOrder);
      expect(tickets.refunded.single.request.lines.single.qty, 1);
      // Back on the receipt, the list where it was
      expect(inPane(find.text(l10n.receiptNumber(120479))), findsOneWidget);
      expect(find.byType(ReceiptsScreen), findsOneWidget);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pump(const Duration(seconds: 10));
    });

    testWidgets('a cashier reads and prints a receipt beside the list, and gives nothing back ($lang)', (tester) async {
      tester.view.physicalSize = const Size(1024, 768);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      await tester.pumpWidget(tillApp(
        const ReceiptsScreen(),
        locale: locale,
        overrides: [
          ticketsRepositoryProvider.overrideWithValue(_Tickets()),
          ticketProvider(1).overrideWith((ref) async => _receipt(1)),
        ],
      ));
      await tester.pumpAndSettle();
      // A smaller tablet keeps the two panels: the list gives way, never the receipt under it
      expectFits(tester);
      final pane = find.byType(ReceiptPane);
      expect(pane, findsOneWidget);
      expect(find.descendant(of: pane, matching: find.widgetWithText(FButton, l10n.print)), findsOneWidget);
      expect(find.descendant(of: pane, matching: find.widgetWithText(FButton, l10n.refundTicket)), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
    });

    testWidgets('a receipt on screen fits a phone, with its three buttons ($lang)', (tester) async {
      await usePhone(tester);
      await tester.pumpWidget(tillApp(
        opener((context) => showReceiptPreview(context, 7)),
        locale: locale,
        overrides: [
          ticketProvider(7).overrideWith((ref) async => TicketDetail(
                id: 7,
                type: TicketType.table,
                status: TicketStatus.settled,
                receiptNumber: 120481,
                locationName: const LocalizedText(en: 'Terrace table 4', ar: 'طاولة التراس ٤'),
                settledAt: DateTime(2026, 11, 20, 23, 45),
                subtotal: 124890.33,
                vat: 17485.64,
                total: 142375.97,
                lines: const [
                  TicketLineView(
                    id: 1,
                    description: LocalizedText(en: 'Double smoked brisket burger with truffle fries', ar: 'برجر بريسكت مدخن دبل'),
                    qty: 3,
                    total: 142375.97,
                  ),
                ],
                payments: const [PaymentView(id: 1, tender: PaymentTender.cash, amount: 142375.97)],
              )),
        ],
      ));
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expectFits(tester);
      final print = tester.getRect(find.widgetWithText(FButton, l10n.print));
      final openBill = tester.getRect(find.widgetWithText(FButton, l10n.openBill));
      final close = tester.getRect(find.widgetWithText(FButton, l10n.close));
      expect(openBill.top, greaterThan(print.bottom));
      expect(openBill.top, close.top);
      expect(close.bottom, lessThanOrEqualTo(780));
    });

    testWidgets('what is sold out fits a phone ($lang)', (tester) async {
      await usePhone(tester);
      await tester.pumpWidget(tillApp(
        const AvailabilityScreen(),
        locale: locale,
        overrides: [catalogRepositoryProvider.overrideWithValue(_Catalog())],
      ));
      await tester.pump();
      expectFits(tester);
      await tester.pumpAndSettle();
      expectFits(tester);
      await toTheFoot(tester);
      expectFits(tester);
    });

    testWidgets('the settings fit a phone: the printers, the update, the offline sales ($lang)', (tester) async {
      await usePhone(tester);
      await tester.pumpWidget(tillApp(
        const SettingsScreen(),
        locale: locale,
        overrides: [
          updateProvider.overrideWith(_UpdateWaiting.new),
          onlineProvider.overrideWith(_Online.new),
          offlineQueueProvider.overrideWith(_Queue.new),
        ],
      ));
      await tester.pumpAndSettle();
      expectFits(tester);
      await toTheFoot(tester);
      expectFits(tester);
    });
  }
}
