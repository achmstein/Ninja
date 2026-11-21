import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:pos_app/features/deliveries/models/delivery_board.dart';
import 'package:pos_app/features/deliveries/models/delivery_order.dart';
import 'package:pos_app/features/deliveries/screens/deliveries_board_screen.dart';
import 'package:pos_app/features/deliveries/services/delivery_service.dart';
import 'package:pos_app/features/deliveries/widgets/delivery_card.dart';
import 'package:pos_app/features/deliveries/widgets/delivery_dialog.dart';
import 'package:pos_app/l10n/app_localizations.dart';

import '../../support/phone.dart';

Map<String, dynamic> _delivery(int number, String stage, {String? rider}) => {
      'orderNumber': number,
      'confirmedAt': '2026-11-20T18:00:00Z',
      'customerName': 'Mohamed Abdelrahman Elsayed',
      'customerNote': 'Please ring the bell twice and leave it with the doorman if nobody answers',
      'takenByName': 'Karim Mostafa',
      'total': 142375.97,
      'items': [
        {
          'productName': {'en': 'Double smoked brisket burger with truffle fries', 'ar': 'برجر بريسكت مدخن دبل مع بطاطس الكمأة'},
          'units': 3,
          'customizationsDescription': {'en': 'No onions, extra sauce on the side', 'ar': 'بدون بصل، صوص إضافي'},
        },
      ],
      'delivery': {
        'address': '14 Mohamed Mazhar Street, Zamalek, beside the old bookshop',
        'building': '14',
        'floor': '3',
        'apartment': '12',
        'directions': 'The green gate after the pharmacy',
        'phone': '+201001234567',
        'fee': 45,
        'stage': stage,
        'zoneName': {'en': 'Zamalek and Gezira island', 'ar': 'الزمالك وجزيرة الجزيرة'},
        if (rider != null) ...{'riderUserId': rider, 'riderName': 'Abdelrahman Emam Elsayed'},
        if (stage == 'Failed') 'failureReason': 'Nobody answered the door or the phone after three calls',
      },
    };

/// Every lane with something in it, and three riders to hand an order to
class _Deliveries implements DeliveryRepository {
  @override
  Future<List<DeliveryOrder>> getDeliveries() async => [
        DeliveryOrder.fromJson(_delivery(5521, 'Waiting')),
        DeliveryOrder.fromJson(_delivery(5522, 'OnTheWay', rider: 'r1')),
        DeliveryOrder.fromJson(_delivery(5523, 'Failed', rider: 'r1')),
        DeliveryOrder.fromJson(_delivery(5524, 'Delivered', rider: 'r1')),
        DeliveryOrder.fromJson(_delivery(5525, 'Delivered', rider: 'r1')),
      ];

  @override
  Future<List<TillRider>> getRiders() async => const [
        TillRider(userId: 'r1', name: 'Abdelrahman Emam Elsayed', onDuty: true, out: 3),
        TillRider(userId: 'r2', name: 'كريم مصطفى', onDuty: true),
        TillRider(userId: 'r3', name: 'Omar', signedIn: false),
      ];

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

void main() {
  setUpAll(loadTillFonts);

  for (final locale in phoneLocales) {
    final l10n = lookupAppLocalizations(locale);
    final lang = locale.languageCode;
    final overrides = [
      deliveryRepositoryProvider.overrideWithValue(_Deliveries()),
      // The board's own clock would tick on past the test's end
      deliveriesClockProvider.overrideWith((ref) => Stream.value(DateTime.utc(2026, 11, 20, 18, 40))),
    ];

    testWidgets('the delivery board fits a phone, a lane at a time ($lang)', (tester) async {
      await usePhone(tester);
      await tester.pumpWidget(tillApp(const DeliveriesBoardScreen(), locale: locale, overrides: overrides));
      await tester.pumpAndSettle();
      expectFits(tester);

      // Every lane in turn, by its chip (the row of chips scrolls sideways)
      for (final lane in BoardLane.values) {
        final chip = find.widgetWithText(FButton, '${lane.label(l10n)} · ${lane == BoardLane.cashDue ? 2 : 1}');
        await tester.ensureVisible(chip);
        await tester.pumpAndSettle();
        await tester.tap(chip);
        await tester.pumpAndSettle();
        expectFits(tester, reason: lane.name);
        expect(find.byType(DeliveryCard), findsNWidgets(lane == BoardLane.cashDue ? 2 : 1));
      }

      // The cash lane is showing: what its rider brings back
      await tester.tap(find.widgetWithText(FButton, l10n.riderCashTake));
      await tester.pumpAndSettle();
      expectFits(tester);
      await tester.drag(find.byType(SingleChildScrollView).last, const Offset(0, -2000));
      await tester.pump(const Duration(milliseconds: 300));
      await tester.pumpAndSettle();
      expectFits(tester);
    });

    for (final (number, what) in [(5521, 'waiting for a rider'), (5522, 'on its way'), (5523, 'coming back'), (5524, 'delivered')]) {
      testWidgets('a delivery $what fits a phone ($lang)', (tester) async {
        await usePhone(tester);
        await tester.pumpWidget(tillApp(
          opener((context) => showDeliveryDialog(context, number)),
          locale: locale,
          overrides: overrides,
        ));
        await tester.tap(find.text('open'));
        await tester.pumpAndSettle();
        expectFits(tester);
        await tester.drag(find.byType(SingleChildScrollView).last, const Offset(0, -2000));
        await tester.pump(const Duration(milliseconds: 300));
        await tester.pumpAndSettle();
        expectFits(tester);
      });
    }

    testWidgets('taking the cash in fits a phone ($lang)', (tester) async {
      await usePhone(tester);
      await tester.pumpWidget(tillApp(
        opener((context) => showCashInDialog(context, order: DeliveryOrder.fromJson(_delivery(5524, 'Delivered', rider: 'r1')))),
        locale: locale,
        overrides: overrides,
      ));
      await tester.tap(find.text('open'));
      await tester.pumpAndSettle();
      expectFits(tester);
    });
  }
}
