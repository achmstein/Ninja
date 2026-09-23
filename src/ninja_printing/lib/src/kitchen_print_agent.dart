import 'dart:ui' as ui;
import 'package:flutter/widgets.dart';
import 'escpos_builder.dart';
import 'image_raster.dart';
import 'kitchen_ticket.dart';
import 'network_escpos_printer.dart';
import 'widget_rasterizer.dart';

/// The server's side of the kitchen's print queue, as the app reaches it.
abstract class KitchenPrintQueue {
  /// The branch's unprinted tickets, oldest first
  Future<List<KitchenTicket>> pending();

  /// Take a ticket for this device; false when another device has it or it is printed
  Future<bool> claim(int jobId, String deviceId);

  Future<void> printed(int jobId);

  /// The printer refused; the claim goes back so any device can try again
  Future<void> failed(int jobId, String error);
}

/// A widget drawn to dots and wrapped as one ESC/POS job: reset, (kick),
/// image, feed, cut — what every printed sheet in the shop is.
Future<List<int>> sheetJob(Widget sheet, {double width = 576, bool kickDrawer = false}) async {
  final image = await rasterizeWidget(sheet, width: width);
  final rgba = await image.toByteData(format: ui.ImageByteFormat.rawRgba);
  final raster = packMonochrome(rgba!.buffer.asUint8List(), image.width, image.height);
  image.dispose();
  final builder = EscPosBuilder().init();
  // The drawer first: the cashier reaches for change while the paper moves
  if (kickDrawer) builder.kickDrawer();
  return builder.alignCenter().raster(raster).feed(4).cut().toBytes();
}

/// One device in the shop printing the kitchen's tickets: it takes each
/// waiting ticket from the queue, prints it on its station's printer and
/// says how that went. Several devices may do this at once — the claim is
/// what keeps a ticket from printing twice. A drain already running is not
/// started again; the next nudge finds whatever arrived meanwhile.
class KitchenPrintAgent {
  final KitchenPrintQueue queue;
  final String deviceId;

  /// The ticket as printer bytes, in the app's language and font
  final Future<List<int>> Function(KitchenTicket ticket) render;

  /// Where a ticket's bytes go; the network printer unless a test says otherwise
  final EscPosPrinter Function(String host, int port) printerFor;

  final DateTime Function() now;

  KitchenPrintAgent({
    required this.queue,
    required this.deviceId,
    required this.render,
    EscPosPrinter Function(String host, int port)? printerFor,
    DateTime Function()? now,
  })  : printerFor = printerFor ?? ((host, port) => NetworkEscPosPrinter(host, port)),
        now = now ?? (() => DateTime.now().toUtc());

  bool _draining = false;

  /// Print everything waiting that no other device holds. Returns how many
  /// tickets reached paper.
  Future<int> drain() async {
    if (_draining) return 0;
    _draining = true;
    var printed = 0;
    try {
      for (final ticket in await queue.pending()) {
        if (ticket.printerHost == null || ticket.claimedByAnother(now())) continue;
        if (!await queue.claim(ticket.jobId, deviceId)) continue;
        try {
          await printerFor(ticket.printerHost!, ticket.printerPort).send(await render(ticket));
        } catch (e) {
          await queue.failed(ticket.jobId, e is PrinterException ? e.message : '$e');
          continue;
        }
        await queue.printed(ticket.jobId);
        printed++;
      }
    } finally {
      _draining = false;
    }
    return printed;
  }
}
