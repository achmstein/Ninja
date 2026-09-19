import '../brand/brand_provider.dart';
import '../providers/branch_provider.dart';
import 'dart:ui' as ui;
import 'package:flutter/widgets.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../features/receipt/receipt_sheet.dart';
import '../../features/receipt/tab_payment_sheet.dart';
import '../../features/shifts/models/shift.dart';
import '../../features/shifts/widgets/shift_report_sheet.dart';
import '../../features/tickets/models/ticket_detail.dart';
import '../../l10n/app_localizations.dart';
import 'brand_logo.dart';
import 'escpos_builder.dart';
import 'image_raster.dart';
import 'network_escpos_printer.dart';
import 'printer_settings.dart';
import 'widget_rasterizer.dart';

/// This till has no printer address yet
class PrinterNotConfigured implements Exception {
  const PrinterNotConfigured();
}

/// The one line the cashier sees when printing fails
String describePrintError(Object error, AppLocalizations l10n) {
  if (error is PrinterNotConfigured) return l10n.printerNotConfigured;
  if (error is PrinterException) return l10n.printerUnreachable;
  return l10n.somethingWentWrong;
}

/// Receipts and the drawer. Every job renders a sheet widget to dots and
/// sends one ESC/POS stream: reset, (kick), image, feed, cut. The sheet is
/// given the language explicitly because it is painted outside the app's
/// widget tree.
class PrintService {
  final Ref _ref;

  PrintService(this._ref);

  bool get isConfigured => _ref.read(printerSettingsProvider).isConfigured;

  EscPosPrinter _printer() {
    final settings = _ref.read(printerSettingsProvider);
    if (!settings.isConfigured) throw const PrinterNotConfigured();
    return NetworkEscPosPrinter(settings.host, settings.port);
  }

  Future<void> printReceipt(
    TicketDetail ticket, {
    required AppLocalizations l10n,
    required Locale locale,
    List<ReceiptPayment>? paymentsOverride,
    int? receiptNumberOverride,
    String? provisionalReceiptNumber,
    bool kickDrawer = false,
  }) async {
    final printer = _printer();
    final sheet = ReceiptSheet(
      ticket: ticket,
      l10n: l10n,
      locale: locale,
      brandName: _brandName(locale),
      logo: await _logo(),
      branch: _ref.read(branchProvider).selectedBranch,
      paymentsOverride: paymentsOverride,
      receiptNumberOverride: receiptNumberOverride,
      provisionalReceiptNumber: provisionalReceiptNumber,
    );
    await printer.send(await _job(sheet, kickDrawer: kickDrawer));
  }

  Future<void> printTabPayment(TabPaymentSlip slip, {required AppLocalizations l10n, required Locale locale, bool kickDrawer = false}) async {
    final printer = _printer();
    await printer.send(await _job(
      TabPaymentSheet(slip: slip, l10n: l10n, locale: locale, brandName: _brandName(locale), logo: await _logo()),
      kickDrawer: kickDrawer,
    ));
  }

  Future<void> printShiftReport(ShiftView shift, {required AppLocalizations l10n, required Locale locale}) async {
    final printer = _printer();
    await printer.send(await _job(ShiftReportSheet(shift: shift, l10n: l10n, locale: locale, brandName: _brandName(locale))));
  }

  Future<void> testPrint({required AppLocalizations l10n, required Locale locale}) async {
    final printer = _printer();
    await printer.send(await _job(TestSheet(l10n: l10n, locale: locale, brandName: _brandName(locale), logo: await _logo())));
  }

  Future<void> kickDrawer() => _printer().send(EscPosBuilder().init().kickDrawer().toBytes());

  /// The tenant's name in the sheet's language: what prints when there is
  /// no logo, and the top line of the shift report either way
  String _brandName(Locale locale) => _ref.read(brandProvider).displayName(locale);

  /// The tenant's logo, or nothing when there is none or it cannot be
  /// fetched: the sheet falls back to the name in text rather than the
  /// receipt not printing
  Future<ui.Image?> _logo() => brandLogo(_ref.read(brandProvider).receiptImageUrl);

  Future<List<int>> _job(Widget sheet, {bool kickDrawer = false}) async {
    final image = await rasterizeWidget(sheet, width: receiptWidth);
    final rgba = await image.toByteData(format: ui.ImageByteFormat.rawRgba);
    final raster = packMonochrome(rgba!.buffer.asUint8List(), image.width, image.height);
    image.dispose();
    final builder = EscPosBuilder().init();
    // The drawer first: the cashier reaches for change while the paper moves
    if (kickDrawer) builder.kickDrawer();
    return builder.alignCenter().raster(raster).feed(4).cut().toBytes();
  }
}

final printServiceProvider = Provider<PrintService>((ref) => PrintService(ref));
