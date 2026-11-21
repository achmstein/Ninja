import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:forui/forui.dart';
import 'package:pos_app/core/sending/sending.dart';
import 'package:pos_app/core/sending/sending_ticket_screen.dart';
import 'package:pos_app/features/sale/models/sale_line.dart';
import 'package:pos_app/features/tickets/services/tickets_service.dart';
import 'package:pos_app/l10n/app_localizations.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../support/phone.dart';

class _Sends extends SendingNotifier {
  final Sending waiting;
  _Sends(this.waiting);

  @override
  List<Sending> build() => [waiting];
}

/// No pricing rules to fetch: the till prices the sale with none
class _Tickets implements TicketsRepository {
  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

Sending _sale({required SendStatus status, bool offline = false}) => Sending(
      requestId: 'r1',
      ticketId: null,
      branchId: 1,
      lines: const [
        SaleLine(
          productId: 1,
          nameEn: 'Double smoked brisket burger with truffle fries',
          nameAr: 'برجر بريسكت مدخن دبل مع بطاطس الكمأة',
          price: 34525.25,
          quantity: 3,
          specialInstructions: 'No onions, extra sauce on the side',
        ),
        SaleLine(productId: 2, nameEn: 'Flat white', nameAr: 'فلات وايت', price: 95, quantity: 2),
      ],
      status: status,
      offline: offline,
      error: offline ? 'No connection' : null,
      startedAt: DateTime.now(),
    );

void main() {
  setUpAll(loadTillFonts);
  setUp(() => SharedPreferences.setMockInitialValues({}));

  for (final locale in phoneLocales) {
    final l10n = lookupAppLocalizations(locale);
    final lang = locale.languageCode;

    Widget app(Sending send) => tillApp(
          const SendingTicketScreen(requestId: 'r1'),
          locale: locale,
          overrides: [
            sendingProvider.overrideWith(() => _Sends(send)),
            ticketsRepositoryProvider.overrideWithValue(_Tickets()),
          ],
        );

    testWidgets('a charge that did not get in fits a phone: the total over its three ways on ($lang)', (tester) async {
      await usePhone(tester);
      await tester.pumpWidget(app(_sale(status: SendStatus.failed, offline: true)));
      await tester.pumpAndSettle();
      expectFits(tester);

      final back = tester.getRect(find.widgetWithText(FButton, l10n.backToSale));
      final offline = tester.getRect(find.widgetWithText(FButton, l10n.sellOffline));
      final retry = tester.getRect(find.widgetWithText(FButton, l10n.retrySync).last);
      expect(back.width, 360 - 24);
      expect(back.top, greaterThan(tester.getRect(find.text(l10n.total)).bottom));
      expect(offline.top, greaterThan(back.bottom));
      expect(offline.top, retry.top);
      expect(retry.bottom, lessThanOrEqualTo(780));
      for (final rect in [back, offline, retry]) {
        expect(rect.height, greaterThanOrEqualTo(48));
      }

      // The lines scroll clear of the taller bar
      await tester.drag(find.byType(SingleChildScrollView).first, const Offset(0, -2000));
      await tester.pumpAndSettle();
      expectFits(tester);
    });

    testWidgets('a refused charge has two ways on, side by side, and one being confirmed has none ($lang)',
        (tester) async {
      await usePhone(tester);
      await tester.pumpWidget(app(_sale(status: SendStatus.failed)));
      await tester.pumpAndSettle();
      expectFits(tester);
      expect(find.text(l10n.sellOffline), findsNothing);
      expect(tester.getRect(find.widgetWithText(FButton, l10n.backToSale)).top,
          tester.getRect(find.widgetWithText(FButton, l10n.retrySync).last).top);

      await tester.pumpWidget(const SizedBox.shrink());
      await tester.pumpWidget(app(_sale(status: SendStatus.sending)));
      await tester.pump();
      expectFits(tester);
      expect(tester.getSize(find.widgetWithText(FButton, l10n.confirming)).width, 360 - 24);
      // The spinner never settles: the tree goes before the test ends
      await tester.pumpWidget(const SizedBox.shrink());
    });

    testWidgets('the charge\'s bar is one row from 640 dp up ($lang)', (tester) async {
      tester.view.physicalSize = const Size(1280, 800);
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);
      await tester.pumpWidget(app(_sale(status: SendStatus.failed, offline: true)));
      await tester.pumpAndSettle();
      expectFits(tester);
      final tops = {
        for (final label in [l10n.backToSale, l10n.sellOffline, l10n.retrySync])
          tester.getRect(find.widgetWithText(FButton, label).last).top,
      };
      expect(tops, hasLength(1));
      expect(tester.getSize(find.widgetWithText(FButton, l10n.retrySync).last).height, 56);
    });
  }
}
