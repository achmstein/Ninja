import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_printing/ninja_printing.dart';

const _labels = KitchenTicketLabels(
  counter: 'Counter',
  pickup: 'Pickup',
  reprint: 'REPRINT',
  test: 'TEST',
  testBody: "This station's printer works",
);

KitchenTicket _ticket({bool isTest = false}) => KitchenTicket(
      jobId: 1,
      stationId: 3,
      stationName: const TicketText('Shisha', 'الشيشة'),
      printerHost: '10.0.0.9',
      createdAt: DateTime.utc(2026, 9, 24, 20),
      isTest: isTest,
      orderNumber: isTest ? null : 3121,
      source: 'Customer',
      placeName: const TicketText('Table 4', 'ترابيزة ٤'),
      customerNote: 'Birthday',
      lines: const [
        KitchenTicketLine(name: TicketText('Mint', 'نعناع'), units: 2, instructions: 'Extra ice'),
        KitchenTicketLine(name: TicketText('Grape', 'عنب'), units: 1, customizations: TicketText('Double apple', 'تفاحتين')),
      ],
    );

void main() {
  for (final language in const ['en', 'ar']) {
    testWidgets('a ticket goes out as one printable job at paper width ($language)', (tester) async {
      // Snapshotting runs on the real engine, outside the test's fake clock
      await tester.runAsync(() async {
        final sheet = KitchenTicketSheet(ticket: _ticket(), labels: _labels, languageCode: language, fontFamily: 'Roboto');
        final image = await rasterizeWidget(sheet, width: ticketWidth);
        expect(image.width, ticketWidth.toInt());
        expect(image.height, greaterThan(300));

        final job = await sheetJob(sheet);
        expect(job.sublist(0, 2), [0x1B, 0x40], reason: 'reset first');
        expect(job.sublist(job.length - 3), [0x1D, 0x56, 0x01], reason: 'cut last');
      });
    });
  }

  testWidgets('a test page is shorter than an order and still prints', (tester) async {
    await tester.runAsync(() async {
      final order = await rasterizeWidget(
        KitchenTicketSheet(ticket: _ticket(), labels: _labels, languageCode: 'en', fontFamily: 'Roboto'),
        width: ticketWidth,
      );
      final test = await rasterizeWidget(
        KitchenTicketSheet(ticket: _ticket(isTest: true), labels: _labels, languageCode: 'en', fontFamily: 'Roboto'),
        width: ticketWidth,
      );
      expect(test.height, lessThan(order.height));
      expect(test.height, greaterThan(50));
    });
  });
}
