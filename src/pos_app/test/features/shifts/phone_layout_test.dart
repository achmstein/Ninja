import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:pos_app/features/shifts/dialogs/close_shift_dialog.dart';
import 'package:pos_app/features/shifts/dialogs/movement_dialog.dart';
import 'package:pos_app/features/shifts/dialogs/open_shift_dialog.dart';
import 'package:pos_app/features/shifts/models/shift.dart';
import 'package:pos_app/features/shifts/screens/shift_detail_screen.dart';
import 'package:pos_app/features/shifts/screens/shift_history_screen.dart';
import 'package:pos_app/features/shifts/screens/shift_screen.dart';
import 'package:pos_app/features/shifts/services/shifts_service.dart';
import 'package:pos_app/features/shifts/services/till_picks_service.dart';
import 'package:pos_app/l10n/app_localizations.dart';

import '../../support/phone.dart';

/// A busy day's figures, large enough to fill their rows
Map<String, dynamic> _figures(int id, {bool closed = false}) => {
      'id': id,
      'status': closed ? 'Closed' : 'Open',
      'openedAt': '2026-11-20T09:00:00Z',
      if (closed) 'closedAt': '2026-11-20T23:45:00Z',
      'openedBy': 'Mohamed Abdelrahman Elsayed',
      'openingFloat': 500,
      'ticketsSettled': 138,
      'salesTotal': 142375.97,
      'grossSales': 142375.97,
      'netSales': 139220.5,
      'discounts': 3085,
      'tenderTotals': [
        {'tender': 'Cash', 'amount': 81960, 'count': 82, 'tendered': 92105},
        {'tender': 'Card', 'amount': 42310, 'count': 37},
        {'tender': 'InstaPay', 'amount': 18105.97, 'count': 19},
      ],
      'cashTendered': 92105,
      'changeGiven': 10145,
      'refundsTotal': 1250,
      'cashRefunds': 1250,
      'payInsTotal': 2000,
      'payOutsTotal': 13300,
      'cashTabPayments': 1150,
      'expectedInDrawer': 71060,
      if (closed) ...{'closingCount': 71040, 'expectedCash': 71000, 'overShort': -1240.5, 'lateCash': 60, 'adjustedOverShort': -20},
    };

class _Shifts implements ShiftsRepository {
  @override
  Future<ShiftView?> getCurrentShift() async => ShiftView.fromJson(_figures(1041));

  @override
  Future<ShiftView> getShift(int id) async => ShiftView.fromJson(_figures(id, closed: true));

  @override
  Future<List<ShiftView>> getClosedShifts({int pageIndex = 0, int pageSize = 20}) async =>
      [for (var i = 0; i < pageSize; i++) ShiftView.fromJson(_figures(1040 - i, closed: true))];

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

class _Picks implements TillPicksRepository {
  @override
  Future<List<TillPick>> employees() async => [
        TillPick.named(1, 'Mohamed Abdelrahman Elsayed', balance: 12320),
        TillPick.named(2, 'كريم مصطفى', balance: -1250.5),
        TillPick.named(3, 'منى عادل'),
      ];

  @override
  Future<List<TillPick>> suppliers() async => [TillPick.named(1, 'Beanery Coffee Roasters and Trading', balance: 103400)];

  @override
  Future<List<TillPick>> partners() async => [TillPick.named(1, 'Omar')];

  @override
  Future<List<TillPick>> categories() async =>
      [const TillPick(id: 1, name: LocalizedText(en: 'Electricity', ar: 'كهرباء'))];
}

void main() {
  setUpAll(loadTillFonts);

  final overrides = [
    shiftsRepositoryProvider.overrideWithValue(_Shifts()),
    tillPicksRepositoryProvider.overrideWithValue(_Picks()),
  ];

  for (final locale in phoneLocales) {
    final l10n = lookupAppLocalizations(locale);
    final lang = locale.languageCode;

    testWidgets('the open shift fits a phone: the history as an icon, the close on a row of its own ($lang)',
        (tester) async {
      await usePhone(tester);
      await tester.pumpWidget(tillApp(const ShiftScreen(), locale: locale, overrides: overrides));
      await tester.pumpAndSettle();
      expectFits(tester);

      expect(find.text(l10n.shiftHistory), findsNothing);
      expect(tester.getSize(find.byTooltip(l10n.shiftHistory)), const Size(48, 48));

      final payIn = tester.getRect(find.widgetWithText(FButton, l10n.payIn));
      final payOut = tester.getRect(find.widgetWithText(FButton, l10n.payOut));
      final close = tester.getRect(find.widgetWithText(FButton, l10n.closeShiftAction));
      expect(payIn.top, payOut.top);
      expect(payIn.width, payOut.width);
      expect(close.top, greaterThan(payIn.bottom));
      expect(close.width, 360 - 24);
      for (final rect in [payIn, payOut, close]) {
        expect(rect.height, greaterThanOrEqualTo(48));
      }
      expect(tester.getRect(find.byType(ShiftActionBar)).bottom, 780);

      // The report's last row clears the taller bar
      await tester.drag(find.byType(SingleChildScrollView).first, const Offset(0, -3000));
      await tester.pumpAndSettle();
      expectFits(tester);
    });

    testWidgets('the open shift keeps its three across from 640 dp up ($lang)', (tester) async {
      tester.view.physicalSize = const Size(1280, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(tillApp(const ShiftScreen(), locale: locale, overrides: overrides));
      await tester.pumpAndSettle();
      expectFits(tester);
      expect(find.text(l10n.shiftHistory), findsOneWidget);
      final tops = {
        for (final label in [l10n.payIn, l10n.payOut, l10n.closeShiftAction])
          tester.getRect(find.widgetWithText(FButton, label)).top,
      };
      expect(tops, hasLength(1));
      expect(tester.getSize(find.byType(ShiftActionBar)).height, 80);
      expect(tester.getSize(find.widgetWithText(FButton, l10n.payIn)).height, 56);
    });

    testWidgets('a closed shift and the history fit a phone ($lang)', (tester) async {
      await usePhone(tester);
      await tester.pumpWidget(tillApp(const ShiftDetailScreen(shiftId: 1040), locale: locale, overrides: overrides));
      await tester.pumpAndSettle();
      expectFits(tester);
      expect(tester.getSize(find.byTooltip(l10n.print)), const Size(48, 48));
      await tester.drag(find.byType(SingleChildScrollView).first, const Offset(0, -3000));
      await tester.pumpAndSettle();
      expectFits(tester);

      await tester.pumpWidget(tillApp(const ShiftHistoryScreen(), locale: locale, overrides: overrides));
      await tester.pumpAndSettle();
      expectFits(tester);
      await tester.drag(find.byType(SingleChildScrollView).first, const Offset(0, -3000));
      await tester.pumpAndSettle();
      expectFits(tester);
      expect(find.text(l10n.nextPage), findsOneWidget);
    });

    testWidgets('a pay-out stacks what it is for over how much on a phone ($lang)', (tester) async {
      await usePhone(tester);
      await tester.pumpWidget(tillApp(
        opener((context) => showMovementDialog(context, 7, CashMovementType.payOut)),
        locale: locale,
        overrides: overrides,
      ));
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expectFits(tester);

      // The kinds over the keypad, each the dialog's full width
      final kinds = tester.getRect(find.text(l10n.payOutFor));
      final seven = tester.getRect(find.widgetWithText(FButton, '7'));
      expect(seven.top, greaterThan(kinds.bottom));
      expect(seven.width, greaterThanOrEqualTo(48));
      expect(seven.height, greaterThanOrEqualTo(48));

      // Every kind named whole
      for (final kind in [
        l10n.payOutSupplier,
        l10n.payOutWage,
        l10n.payOutAdvance,
        l10n.payOutExpense,
        l10n.payOutPartner,
        l10n.payOutOther,
      ]) {
        expectWhole(tester, kind);
      }

      // Every kind's list, with a balance at the row's end
      for (final kind in [l10n.payOutWage, l10n.payOutSupplier, l10n.payOutExpense]) {
        await tester.ensureVisible(find.text(kind));
        await tester.tap(find.text(kind));
        await tester.pumpAndSettle();
        expectFits(tester, reason: kind);
      }

      await tester.ensureVisible(find.widgetWithText(FButton, l10n.payOut));
      await tester.pumpAndSettle();
      expectFits(tester);
    });

    testWidgets('a pay-out keeps its two columns from 640 dp up ($lang)', (tester) async {
      tester.view.physicalSize = const Size(1280, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(tillApp(
        opener((context) => showMovementDialog(context, 7, CashMovementType.payOut)),
        locale: locale,
        overrides: overrides,
      ));
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expectFits(tester);
      expect(tester.getRect(find.text(l10n.payOutFor)).top, tester.getRect(find.text(l10n.amount)).top);
    });

    testWidgets('opening and closing a shift fit a phone ($lang)', (tester) async {
      await usePhone(tester);
      await tester.pumpWidget(tillApp(opener((context) => showOpenShiftDialog(context)), locale: locale, overrides: overrides));
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expectFits(tester);
      await tester.pumpWidget(const SizedBox.shrink());

      await tester.pumpWidget(tillApp(
        opener((context) => showCloseShiftDialog(context, ShiftView.fromJson(_figures(1041)))),
        locale: locale,
        overrides: overrides,
      ));
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expectFits(tester);
    });
  }
}
