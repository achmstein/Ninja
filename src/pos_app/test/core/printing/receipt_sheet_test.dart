import 'dart:ui' as ui;
import 'package:flutter/widgets.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:pos_app/core/models/localized_text.dart';
import 'package:pos_app/core/printing/escpos_builder.dart';
import 'package:pos_app/core/printing/image_raster.dart';
import 'package:pos_app/core/printing/widget_rasterizer.dart';
import 'package:pos_app/features/receipt/receipt_sheet.dart';
import 'package:pos_app/features/tickets/models/enums.dart';
import 'package:pos_app/features/tickets/models/ticket_detail.dart';
import 'package:pos_app/l10n/app_localizations.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  final ticket = TicketDetail(
    id: 7,
    type: TicketType.table,
    status: TicketStatus.settled,
    locationName: LocalizedText.parse({'en': 'Table 2', 'ar': 'ترابيزة 2'}),
    settledAt: DateTime(2026, 9, 5, 18, 30),
    receiptNumber: 1042,
    subtotal: 100,
    serviceCharge: 12,
    serviceChargeRate: 0.12,
    vat: 14,
    vatRate: 0.14,
    total: 126,
    lines: [
      TicketLineView(id: 1, description: LocalizedText.parse({'en': 'Latte', 'ar': 'لاتيه'}), details: 'Oat milk', qty: 2, unitPrice: 50, total: 100),
    ],
    payments: const [PaymentView(id: 1, tender: PaymentTender.cash, amount: 150)],
  );

  for (final locale in const [Locale('en'), Locale('ar')]) {
    testWidgets('the receipt rasterizes to paper width with ink on it (${locale.languageCode})', (tester) async {
      // Snapshotting runs on the real engine, outside the test's fake clock
      await tester.runAsync(() async {
        // The app's localizations delegate does this at startup
        await initializeDateFormatting(locale.toString());
        final l10n = await AppLocalizations.delegate.load(locale);
        final image = await rasterizeWidget(
          ReceiptSheet(ticket: ticket, l10n: l10n, locale: locale),
          width: receiptWidth,
        );
        expect(image.width, receiptWidth.toInt());
        expect(image.height, greaterThan(300));

        final rgba = await image.toByteData(format: ui.ImageByteFormat.rawRgba);
        final raster = packMonochrome(rgba!.buffer.asUint8List(), image.width, image.height);
        final inked = raster.rows.where((b) => b != 0).length;
        expect(inked, greaterThan(100));

        // And it goes out as one printable job: reset first, cut last
        final job = EscPosBuilder().init().raster(raster).feed(4).cut().toBytes();
        expect(job.sublist(0, 2), [0x1B, 0x40]);
        expect(job.sublist(job.length - 3), [0x1D, 0x56, 0x01]);
      });
    });
  }
}
