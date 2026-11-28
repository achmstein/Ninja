import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:pos_app/core/models/money.dart';
import 'package:pos_app/core/theme/type_roles.dart';
import 'package:pos_app/core/utils/bidi.dart';
import 'package:pos_app/features/tables/models/dining_table.dart';
import 'package:pos_app/features/tables/services/tables_service.dart';
import 'package:pos_app/features/ticket/dialogs/move_target_dialog.dart';
import 'package:pos_app/features/tickets/models/enums.dart';
import 'package:pos_app/features/tickets/models/move_lines.dart';
import 'package:pos_app/features/tickets/models/ticket_detail.dart';
import 'package:pos_app/features/tickets/models/ticket_summary.dart';
import 'package:pos_app/features/tickets/services/tickets_service.dart';
import 'package:pos_app/l10n/app_localizations.dart';

import '../../support/phone.dart';

/// Moving picked lines: one dialog, one list of every place they can go.

const _roomName = LocalizedText(en: 'PlayStation room 12', ar: 'غرفة بلايستيشن ١٢');

class _Tickets implements TicketsRepository {
  @override
  Future<List<TicketSummary>> getOpenTickets() async => const [
        // The bill the lines are on: never a place to move them to
        TicketSummary(id: 7, type: TicketType.table, placeId: 4, locationName: LocalizedText(en: 'Terrace table 4', ar: 'طاولة التراس ٤'), total: 300),
        TicketSummary(id: 1041, type: TicketType.room, locationName: _roomName, total: 12480.5),
        TicketSummary(id: 1044, type: TicketType.counter, label: 'Mohamed Abdelrahman', total: 250),
        TicketSummary(id: 1045, type: TicketType.table, placeId: 2, locationName: LocalizedText(en: 'Garden 2', ar: 'الحديقة ٢'), total: 35),
      ];

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

class _Tables implements TablesRepository {
  @override
  Future<List<DiningTable>> getTables() async => const [
        DiningTable(id: 1, name: LocalizedText(en: 'Garden 1', ar: 'الحديقة ١')),
        // Taken: a bill is open on it
        DiningTable(id: 2, name: LocalizedText(en: 'Garden 2', ar: 'الحديقة ٢')),
        DiningTable(id: 3, name: LocalizedText(en: 'Window booth by the door', ar: 'ركن النافذة بجوار الباب')),
        DiningTable(id: 5, name: LocalizedText(en: 'Old table', ar: 'طاولة قديمة'), isActive: false),
      ];
}

const _table = TicketDetail(
  id: 7,
  type: TicketType.table,
  placeId: 4,
  locationName: LocalizedText(en: 'Terrace table 4', ar: 'طاولة التراس ٤'),
  total: 300,
);

const _room = TicketDetail(id: 7, type: TicketType.room, sessionId: 9, locationName: _roomName, total: 300);

void main() {
  setUpAll(loadTillFonts);

  for (final locale in phoneLocales) {
    final l10n = lookupAppLocalizations(locale);
    final lang = locale.languageCode;

    Future<MoveTarget? Function()> open(WidgetTester tester, {TicketDetail ticket = _table, bool allSelected = false, String? name}) async {
      tester.view.physicalSize = const Size(1280, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.reset);
      MoveTarget? picked;
      await tester.pumpWidget(tillApp(
        opener((context) async => picked =
            await showMoveTargetDialog(context, ticket: ticket, count: 2, allSelected: allSelected, suggestedName: name)),
        locale: locale,
        overrides: [
          ticketsRepositoryProvider.overrideWithValue(_Tickets()),
          tablesRepositoryProvider.overrideWithValue(_Tables()),
        ],
      ));
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expectFits(tester);
      return () => picked;
    }

    testWidgets('every place the lines can go is one list: a bill by name, open bills, a free table ($lang)', (tester) async {
      final picked = await open(tester);
      final dialog = find.byType(MoveTargetList);
      final context = tester.element(dialog);
      expect(tester.getSize(dialog).width, lessThanOrEqualTo(512));
      expect(find.text(l10n.moveItemsTitle(2)), findsOneWidget);
      expect(find.text(l10n.moveItemsHint(bidiIsolate(_table.locationName!.getText(locale)))), findsOneWidget);

      // The search is on the top row, and nothing is typed into until asked
      final search = find.byType(FTextField);
      expect(search, findsOneWidget);
      expect(find.text(l10n.moveFind), findsOneWidget);
      expect(FocusManager.instance.primaryFocus?.context?.findAncestorWidgetOfExactType<FTextField>(), isNull);

      // The parts, in their order
      final captions = [l10n.moveNamedBill, l10n.moveOpenBills, l10n.moveFreeTable].map(labelCase).toList();
      final tops = [for (final caption in captions) tester.getRect(find.text(caption)).top];
      expect(tops, [...tops]..sort());
      expect(tester.getRect(search).bottom, lessThanOrEqualTo(tops.first));

      // An open bill: its name, its kind and number under it, its total
      expect(find.text(_roomName.getText(locale)), findsOneWidget);
      expect(find.text('${l10n.room} · ${hashNumber(1041)}'), findsOneWidget);
      expect(find.text(money(context, 12480.5)), findsOneWidget);
      expect(find.text('Mohamed Abdelrahman'), findsOneWidget);
      expect(find.text('${l10n.counter} · ${hashNumber(1044)}'), findsOneWidget);
      expect(find.text('${l10n.table} · ${hashNumber(7)}'), findsNothing, reason: 'not the bill they are on');

      // A bill by name: nobody is on this one yet, so only the way to another name; and a second bill for the same place
      expect(find.text(l10n.moveAnotherName), findsOneWidget);
      expect(find.text(l10n.moveSecondBill(_table.locationName!.getText(locale))), findsOneWidget);
      expect(find.text(l10n.moveSecondBillHint), findsOneWidget);

      // Free tables only, as tiles of one size
      final free = [for (final id in const [1, 3]) (await _Tables().getTables()).firstWhere((t) => t.id == id).name.getText(locale)];
      expect(find.text(const LocalizedText(en: 'Old table', ar: 'طاولة قديمة').getText(locale)), findsNothing);
      final tiles = [
        for (final name in free) tester.getSize(find.ancestor(of: find.text(name), matching: find.byWidgetPredicate((w) => w is FTappable)).first),
      ];
      expect(tiles.toSet(), hasLength(1));

      // One tap moves
      await tester.tap(find.text(_roomName.getText(locale)));
      await tester.pumpAndSettle();
      expect(find.byType(MoveTargetList), findsNothing);
      expect(picked(), isA<MoveToTicket>().having((t) => t.ticketId, 'ticketId', 1041));
      await tester.pumpWidget(const SizedBox.shrink());
    });

    testWidgets('what is typed narrows the bills and tables, and is offered as a new bill\'s name ($lang)', (tester) async {
      final picked = await open(tester);
      final garden = const LocalizedText(en: 'Garden', ar: 'الحديقة').getText(locale);
      await tester.enterText(find.byType(FTextField), garden);
      await tester.pumpAndSettle();
      expectFits(tester);
      // The bill on Garden 2 and the free Garden 1; nothing else
      expect(find.text('${l10n.table} · ${hashNumber(1045)}'), findsOneWidget);
      expect(find.text(_roomName.getText(locale)), findsNothing);
      expect(find.text(l10n.moveNewNamed(bidiIsolate(garden))), findsOneWidget);
      expect(find.text(l10n.moveAnotherName), findsNothing);
      expect(find.text(l10n.moveSecondBillHint), findsNothing);
      expect(find.text(labelCase(l10n.moveFreeTable)), findsOneWidget);
      final free = const LocalizedText(en: 'Garden 1', ar: 'الحديقة ١').getText(locale);
      expect(find.text(free), findsOneWidget);

      // A bill's number finds it too
      await tester.enterText(find.byType(FTextField), '1044');
      await tester.pumpAndSettle();
      expect(find.text('Mohamed Abdelrahman'), findsOneWidget);
      expect(find.text(labelCase(l10n.moveFreeTable)), findsNothing);

      await tester.enterText(find.byType(FTextField), 'zzzz');
      await tester.pumpAndSettle();
      expect(find.text(l10n.moveNewNamed(bidiIsolate('zzzz'))), findsOneWidget);
      expect(find.text(labelCase(l10n.moveOpenBills)), findsNothing);

      // Back to a free table: one tap moves there
      await tester.enterText(find.byType(FTextField), garden);
      await tester.pumpAndSettle();
      await tester.tap(find.text(free));
      await tester.pumpAndSettle();
      expect(picked(), isA<MoveToTable>().having((t) => t.placeId, 'placeId', 1));
      await tester.pumpWidget(const SizedBox.shrink());
    });

    testWidgets('the lines\' own customer is a name to tap for a bill of their own ($lang)', (tester) async {
      final picked = await open(tester, name: 'Karim Mostafa');
      expect(find.text(bidiIsolate('Karim Mostafa')), findsOneWidget);
      expect(find.text(l10n.moveNamedTheirs), findsOneWidget);
      await tester.tap(find.text(bidiIsolate('Karim Mostafa')));
      await tester.pumpAndSettle();
      expect(find.byType(MoveTargetList), findsNothing);
      expect(picked(), isA<MoveToCounter>().having((t) => t.label, 'label', 'Karim Mostafa'));
      await tester.pumpWidget(const SizedBox.shrink());
    });

    testWidgets('a new name is typed in the box and taken with one tap ($lang)', (tester) async {
      final picked = await open(tester, name: 'Karim Mostafa');
      // Another name: the box is what is typed into next
      await tester.tap(find.text(l10n.moveAnotherName));
      await tester.pumpAndSettle();
      expect(FocusManager.instance.primaryFocus?.context?.findAncestorWidgetOfExactType<FTextField>(), isNotNull);
      await tester.enterText(find.byType(FTextField), 'Nour');
      await tester.pumpAndSettle();
      expectFits(tester);
      expect(find.text(bidiIsolate('Karim Mostafa')), findsNothing, reason: 'narrowed by what is typed');
      await tester.tap(find.text(l10n.moveNewNamed(bidiIsolate('Nour'))));
      await tester.pumpAndSettle();
      expect(picked(), isA<MoveToCounter>().having((t) => t.label, 'label', 'Nour'));
      await tester.pumpWidget(const SizedBox.shrink());
    });

    testWidgets('a room never gets a second bill, nor a bill whose every line is picked ($lang)', (tester) async {
      await open(tester, ticket: _room);
      expect(find.text(l10n.moveAnotherName), findsOneWidget);
      expect(find.text(l10n.moveSecondBillHint), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());

      final picked = await open(tester, allSelected: true);
      expect(find.text(l10n.moveSecondBillHint), findsNothing);
      await tester.pumpWidget(const SizedBox.shrink());
      expect(picked(), isNull);
    });

    testWidgets('a second bill for the same place is one tap ($lang)', (tester) async {
      final picked = await open(tester);
      await tester.tap(find.text(l10n.moveSecondBillHint));
      await tester.pumpAndSettle();
      expect(picked(), isA<MoveToSplit>());
      await tester.pumpWidget(const SizedBox.shrink());
    });
  }
}
