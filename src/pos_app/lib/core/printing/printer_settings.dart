import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

const _hostKey = 'pos.printer.host';
const _portKey = 'pos.printer.port';

/// Where this till's receipt printer lives. Per device, not per branch:
/// the tablet sits next to its printer.
class PrinterSettings {
  static const defaultPort = 9100;

  final String host;
  final int port;

  const PrinterSettings({this.host = '', this.port = defaultPort});

  bool get isConfigured => host.isNotEmpty;
}

PrinterSettings _initial = const PrinterSettings();

/// Read before `runApp`, like the locale, so the first settle can print
Future<void> initializePrinterSettings() async {
  final prefs = await SharedPreferences.getInstance();
  _initial = PrinterSettings(
    host: prefs.getString(_hostKey) ?? '',
    port: prefs.getInt(_portKey) ?? PrinterSettings.defaultPort,
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
  }
}

final printerSettingsProvider =
    NotifierProvider<PrinterSettingsNotifier, PrinterSettings>(PrinterSettingsNotifier.new);
