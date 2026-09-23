import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:mobile_scanner/mobile_scanner.dart';

import '../../core/brand/brand_mark.dart';
import '../../core/config/app_config.dart';
import '../../core/config/tenant_connection.dart';
import '../../core/providers/locale_provider.dart';
import '../../core/theme/app_theme.dart';
import '../../l10n/app_localizations.dart';

/// The wall before the app: until this tablet knows which café it serves,
/// the connect screen is all there is. Once it does, [child] (the whole
/// Riverpod app) is built fresh, so every client reads the new host; when
/// the café is changed from settings, the app is torn down the same way.
class ConnectGate extends StatelessWidget {
  final Widget Function() child;

  /// True when this build never asks (pinned, or the design-time demo)
  final bool skip;

  const ConnectGate({super.key, required this.child, this.skip = false});

  @override
  Widget build(BuildContext context) => ValueListenableBuilder<TenantConnection?>(
        valueListenable: TenantConnection.current,
        builder: (context, connection, _) {
          if (skip || AppConfig.isConnected) {
            // A new key per connection: nothing of the last café survives
            return KeyedSubtree(key: ValueKey(connection?.apiUrl), child: child());
          }
          return const _ConnectApp();
        },
      );
}

/// The connect screen as its own app: the platform's look (the café is not
/// known yet), the device's saved language, and the same fonts.
class _ConnectApp extends StatefulWidget {
  const _ConnectApp();

  @override
  State<_ConnectApp> createState() => _ConnectAppState();
}

class _ConnectAppState extends State<_ConnectApp> {
  late Locale _locale = initialLocale;

  @override
  void initState() {
    super.initState();
    // main() holds the native splash until the app has signed in; a tablet
    // not yet connected never gets that far, so the connect screen lifts it
    FlutterNativeSplash.remove();
  }

  @override
  Widget build(BuildContext context) => MaterialApp(
        title: platformName,
        debugShowCheckedModeBanner: false,
        locale: _locale,
        supportedLocales: AppLocalizations.supportedLocales,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        theme: ThemeData(
          brightness: Brightness.dark,
          colorScheme: const ColorScheme.dark(primary: Color(0xFFFAFAFA), surface: Color(0xFF18181B)),
          scaffoldBackgroundColor: const Color(0xFF18181B),
          fontFamily: getFontFamily(_locale),
          useMaterial3: true,
        ),
        home: ConnectScreen(
          onLanguage: (locale) {
            setState(() => _locale = locale);
            persistLocale(locale);
          },
        ),
      );
}

/// "Which café is this?": the address as the café's admin shows it, typed or
/// scanned from the QR code on its Apps page.
class ConnectScreen extends StatefulWidget {
  final ValueChanged<Locale>? onLanguage;

  const ConnectScreen({super.key, this.onLanguage});

  @override
  State<ConnectScreen> createState() => _ConnectScreenState();
}

class _ConnectScreenState extends State<ConnectScreen> {
  final _address = TextEditingController();
  bool _busy = false;
  ConnectFailure? _failure;

  @override
  void dispose() {
    _address.dispose();
    super.dispose();
  }

  Future<void> _connect(String input) async {
    if (_busy) return;
    setState(() {
      _busy = true;
      _failure = null;
    });
    try {
      final connection = await TenantConnection.probe(input);
      await TenantConnection.save(connection);
    } on ConnectException catch (e) {
      if (mounted) setState(() => _failure = e.failure);
    } catch (_) {
      if (mounted) setState(() => _failure = ConnectFailure.unreachable);
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _scan() async {
    final code = await Navigator.of(context).push<String>(
      MaterialPageRoute(builder: (_) => const _ScanScreen(), fullscreenDialog: true),
    );
    if (code == null || !mounted) return;
    _address.text = code;
    await _connect(code);
  }

  String _failureText(AppLocalizations l10n, ConnectFailure failure) => switch (failure) {
        ConnectFailure.invalidAddress => l10n.connectInvalidAddress,
        ConnectFailure.unreachable => l10n.connectUnreachable,
        ConnectFailure.notACafe => l10n.connectNotACafe,
        ConnectFailure.paused => l10n.connectPaused,
      };

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    final locale = Localizations.localeOf(context);
    const ink = Color(0xFFFAFAFA);
    const muted = Color(0xFFA1A1AA);

    return Scaffold(
      body: SafeArea(
        child: Stack(
          children: [
            // The other language, top end: a new tablet starts in English
            if (widget.onLanguage != null)
              PositionedDirectional(
                top: 8,
                end: 8,
                child: TextButton(
                  onPressed: () => widget.onLanguage!(locale.languageCode == 'ar' ? const Locale('en') : const Locale('ar')),
                  child: Text(
                    locale.languageCode == 'ar' ? 'English' : 'العربية',
                    style: const TextStyle(color: muted, fontFamily: 'Cairo'),
                  ),
                ),
              ),
            Center(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 420),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const Center(child: PlatformWordmark(size: 56, color: ink)),
                      const SizedBox(height: 28),
                      Text(
                        l10n.connectTitle,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: ink, fontSize: 22, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        l10n.connectHint,
                        textAlign: TextAlign.center,
                        style: const TextStyle(color: muted, fontSize: 14, height: 1.5),
                      ),
                      const SizedBox(height: 28),
                      TextField(
                        controller: _address,
                        enabled: !_busy,
                        autocorrect: false,
                        keyboardType: TextInputType.url,
                        textInputAction: TextInputAction.go,
                        textDirection: TextDirection.ltr,
                        onSubmitted: _connect,
                        style: const TextStyle(color: ink),
                        decoration: InputDecoration(
                          labelText: l10n.cafeAddress,
                          hintText: 'api.cafe.example.com',
                          hintStyle: const TextStyle(color: Color(0xFF52525B)),
                          labelStyle: const TextStyle(color: muted),
                          errorText: _failure == null ? null : _failureText(l10n, _failure!),
                          errorMaxLines: 3,
                          filled: true,
                          fillColor: const Color(0xFF27272A),
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(color: Color(0xFF3F3F46)),
                          ),
                          enabledBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(color: Color(0xFF3F3F46)),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      SizedBox(
                        height: 48,
                        child: FilledButton(
                          onPressed: _busy ? null : () => _connect(_address.text),
                          style: FilledButton.styleFrom(
                            backgroundColor: ink,
                            foregroundColor: const Color(0xFF18181B),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          child: _busy
                              ? const SizedBox.square(
                                  dimension: 20,
                                  child: CircularProgressIndicator(strokeWidth: 2, color: Color(0xFF18181B)),
                                )
                              : Text(l10n.connect, style: const TextStyle(fontWeight: FontWeight.w600)),
                        ),
                      ),
                      const SizedBox(height: 10),
                      SizedBox(
                        height: 48,
                        child: OutlinedButton.icon(
                          onPressed: _busy ? null : _scan,
                          style: OutlinedButton.styleFrom(
                            foregroundColor: ink,
                            side: const BorderSide(color: Color(0xFF3F3F46)),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          ),
                          icon: const Icon(Icons.qr_code_scanner, size: 20),
                          label: Text(l10n.scanConnectCode),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// The camera on the QR code from the admin's Apps page; pops with what it read
class _ScanScreen extends StatefulWidget {
  const _ScanScreen();

  @override
  State<_ScanScreen> createState() => _ScanScreenState();
}

class _ScanScreenState extends State<_ScanScreen> {
  final _controller = MobileScannerController();
  bool _done = false;

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onDetect(BarcodeCapture capture) {
    if (_done) return;
    final value = capture.barcodes.firstOrNull?.rawValue;
    if (value == null || value.isEmpty) return;
    _done = true;
    Navigator.of(context).pop(value);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Scaffold(
      appBar: AppBar(
        backgroundColor: const Color(0xFF18181B),
        title: Text(l10n.scanConnectCode),
      ),
      body: Stack(
        fit: StackFit.expand,
        children: [
          MobileScanner(controller: _controller, onDetect: _onDetect),
          Center(
            child: Container(
              width: 240,
              height: 240,
              decoration: BoxDecoration(
                border: Border.all(color: Colors.white70, width: 2),
                borderRadius: BorderRadius.circular(16),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
