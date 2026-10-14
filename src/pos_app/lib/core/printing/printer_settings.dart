import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _hostKey = 'pos.printer.host';
const _portKey = 'pos.printer.port';
const _kitchenHostKey = 'pos.printer.kitchen.host';
const _kitchenPortKey = 'pos.printer.kitchen.port';

/// Where this till's receipt printer lives. Per device, not per branch:
/// the tablet sits next to its printer.
class PrinterSettings {
  static const defaultPort = 9100;

  final String host;
  final int port;

  /// Where a sale rung up offline sends its kitchen chit — the server's
  /// kitchen tickets cannot reach the shop then. Empty: the receipt printer.
  final String kitchenHost;
  final int kitchenPort;

  const PrinterSettings({
    this.host = '',
    this.port = defaultPort,
    this.kitchenHost = '',
    this.kitchenPort = defaultPort,
  });

  bool get isConfigured => host.isNotEmpty;

  /// The offline kitchen chit's printer: its own when set, else the receipt's
  (String, int)? get offlineKitchenPrinter => kitchenHost.isNotEmpty
      ? (kitchenHost, kitchenPort)
      : isConfigured
          ? (host, port)
          : null;
}

PrinterSettings _initial = const PrinterSettings();

/// Read before `runApp`, like the locale, so the first settle can print
Future<void> initializePrinterSettings() async {
  final prefs = await SharedPreferences.getInstance();
  _initial = PrinterSettings(
    host: prefs.getString(_hostKey) ?? '',
    port: prefs.getInt(_portKey) ?? PrinterSettings.defaultPort,
    kitchenHost: prefs.getString(_kitchenHostKey) ?? '',
    kitchenPort: prefs.getInt(_kitchenPortKey) ?? PrinterSettings.defaultPort,
  );
}

class PrinterSettingsNotifier extends Notifier<PrinterSettings> {
  @override
  PrinterSettings build() => _initial;

  Future<void> save(PrinterSettings settings) async {
    state = settings;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_hostKey, settings.host);
    await prefs.setInt(_portKey, settings.port);
    await prefs.setString(_kitchenHostKey, settings.kitchenHost);
    await prefs.setInt(_kitchenPortKey, settings.kitchenPort);
  }
}

final printerSettingsProvider =
    NotifierProvider<PrinterSettingsNotifier, PrinterSettings>(PrinterSettingsNotifier.new);
