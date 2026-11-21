import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:pos_app/core/widgets/pos_dialog.dart';
import 'package:pos_app/features/orders/models/order.dart';
import 'package:pos_app/features/orders/services/order_service.dart';
import 'package:pos_app/features/orders/widgets/order_detail_dialog.dart';
import 'package:pos_app/features/shifts/widgets/trading_chip.dart';

import '../../support/phone.dart';

/// Where a till dialog sits: against the bottom edge of a phone at its whole
/// width, as pos_web's does, and in the middle of a tablet no wider than it
/// ever was.

class _Orders implements OrderRepository {
  @override
  Future<Order> getOrderDetails(int orderId) async => Order.fromJson({
        'id': orderId,
        'date': '2026-11-20T18:30:00Z',
        'status': 'Submitted',
        'total': 1385.5,
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

const _phone = Size(360, 780);
const _tablet = Size(1280, 800);

void _surface(WidgetTester tester, Size size) {
  tester.view.physicalSize = size;
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.reset);
}

Future<void> _plain(BuildContext context) => showPosDialog<void>(
      context,
      builder: (context) => Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Flexible(child: DialogScroll(child: Text('Are you sure?'))),
          Padding(
            padding: const EdgeInsets.all(24),
            child: DialogActions(
              children: [
                FButton(variant: FButtonVariant.outline, onPress: () {}, child: const Text('Back')),
                FButton(onPress: () {}, child: const Text('Confirm')),
              ],
            ),
          ),
        ],
      ),
    );

/// The three ways a dialog is opened: through [showPosDialog], and the two
/// that build their own, which the owner saw in the middle of a phone
final _dialogs = <String, ({Future<void> Function(BuildContext) open, double maxWidth})>{
  'showPosDialog': (open: _plain, maxWidth: 448),
  'an order\'s details': (open: (context) => showOrderDetailDialog(context, 5521), maxWidth: 448),
  'orders and reservations': (open: showTradingDialog, maxWidth: 448),
};

/// The sheet itself: the part of the panel that slides, not the screen it is laid over
Rect _sheet(WidgetTester tester) => tester.getRect(
      find.descendant(of: find.byType(DialogPanel), matching: find.byType(SlideTransition)).first,
    );

/// Forui's card, inside the screen-sized dialog that centres it
Rect _card(WidgetTester tester) => tester.getRect(
      find.descendant(of: find.byType(FDialog), matching: find.byType(DecoratedBox)).first,
    );

void main() {
  setUpAll(loadTillFonts);

  for (final locale in phoneLocales) {
    final lang = locale.languageCode;

    for (final MapEntry(key: name, value: dialog) in _dialogs.entries) {
      testWidgets('on a phone $name rises from the bottom edge at full width ($lang)', (tester) async {
        _surface(tester, _phone);
        await tester.pumpWidget(tillApp(
          opener(dialog.open),
          locale: locale,
          overrides: [orderRepositoryProvider.overrideWithValue(_Orders())],
        ));
        await tester.tap(find.text('open'));
        await tester.pumpAndSettle();
        expectFits(tester);

        expect(find.byType(FDialog), findsNothing);
        final sheet = _sheet(tester);
        expect(sheet.left, 0);
        expect(sheet.right, _phone.width);
        expect(sheet.bottom, _phone.height);
        expect(sheet.top, greaterThanOrEqualTo(24));

        // The dimmed screen above the sheet still dismisses it
        await tester.tapAt(const Offset(180, 8));
        await tester.pumpAndSettle();
        expect(find.byType(DialogPanel), findsNothing);
        expectFits(tester);
      });

      testWidgets('on a tablet $name stays a card in the middle ($lang)', (tester) async {
        _surface(tester, _tablet);
        await tester.pumpWidget(tillApp(
          opener(dialog.open),
          locale: locale,
          overrides: [orderRepositoryProvider.overrideWithValue(_Orders())],
        ));
        await tester.tap(find.text('open'));
        await tester.pumpAndSettle();
        expectFits(tester);

        final card = _card(tester);
        expect(card.width, lessThanOrEqualTo(dialog.maxWidth));
        expect(card.center.dx, moreOrLessEquals(_tablet.width / 2, epsilon: 0.5));
        expect(card.center.dy, moreOrLessEquals(_tablet.height / 2, epsilon: 0.5));
      });
    }
  }

  testWidgets('a phone\'s sheet rises above the keyboard at its own height', (tester) async {
    _surface(tester, _phone);
    await tester.pumpWidget(tillApp(opener(showTradingDialog)));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    final resting = _sheet(tester);

    tester.view.viewInsets = const FakeViewPadding(bottom: 300);
    await tester.pumpAndSettle();
    expectFits(tester);
    final raised = _sheet(tester);
    expect(raised.height, resting.height);
    expect(raised.bottom, _phone.height - 300);
  });

  testWidgets('a sheet as tall as its content allows stops short of the top of the screen', (tester) async {
    _surface(tester, _phone);
    await tester.pumpWidget(tillApp(opener(
      (context) => showPosDialog<void>(
        context,
        builder: (context) => DialogScroll(
          child: Column(children: [for (var i = 0; i < 60; i++) Text('Line $i')]),
        ),
      ),
    )));
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    expectFits(tester);

    final sheet = _sheet(tester);
    expect(sheet.top, 24);
    expect(sheet.bottom, _phone.height);
  });
}
