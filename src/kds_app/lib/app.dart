import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'core/providers/branch_provider.dart';
import 'core/providers/locale_provider.dart';
import 'core/router/app_router.dart';
import 'core/network/network_status.dart';
import 'core/services/chime_service.dart';
import 'core/services/kiosk_service.dart';
import 'core/services/signalr_service.dart';
import 'core/widgets/kds_toast.dart';
import 'l10n/app_localizations.dart';
import 'core/theme/app_theme.dart';
import 'core/auth/auth_service.dart';
import 'core/demo/demo.dart';
import 'features/kitchen/providers/kitchen_orders_provider.dart';

/// Global navigator key for dialogs shown from outside the widget tree
final rootNavigatorKey = GlobalKey<NavigatorState>();

class ChillaxKdsApp extends ConsumerStatefulWidget {
  const ChillaxKdsApp({super.key});

  @override
  ConsumerState<ChillaxKdsApp> createState() => _ChillaxKdsAppState();
}

class _ChillaxKdsAppState extends ConsumerState<ChillaxKdsApp> with WidgetsBindingObserver {
  final List<StreamSubscription> _signalRSubscriptions = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initializeApp();

    // When the kitchen signs in, load branches and connect SignalR
    ref.listenManual(authServiceProvider, (previous, next) {
      if (previous != null && !previous.isAuthenticated && next.isAuthenticated) {
        _connectSignalR();
        ref.read(branchProvider.notifier).loadBranches();
      }
    });
  }

  @override
  void dispose() {
    for (final sub in _signalRSubscriptions) {
      sub.cancel();
    }
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      final authService = ref.read(authServiceProvider.notifier);
      authService.refreshToken();
      ref.read(signalRServiceProvider).reconnectIfNeeded();
      // Whatever was confirmed while the screen was away
      _refreshBoard();
      // Android drops immersive mode after some system UI; put it back
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
      // A display that asked to be pinned stays pinned
      ref.read(kioskServiceProvider).reapply();
    }
  }

  Future<void> _initializeApp() async {
    // Initialize auth service
    await ref.read(authServiceProvider.notifier).initialize();
    // Remove the native splash screen after auth is initialized
    FlutterNativeSplash.remove();

    // Connect SignalR and load branches if authenticated
    final authState = ref.read(authServiceProvider);
    if (authState.isAuthenticated) {
      if (!kDemoMode) _connectSignalR();
      ref.read(branchProvider.notifier).loadBranches();
    }
  }

  void _refreshBoard() => ref.read(kitchenOrdersProvider.notifier).refresh();

  /// Maps hub events to provider refreshes, the way kds_web's
  /// use-kitchen-notifications maps them to query invalidations.
  void _connectSignalR() {
    final signalR = ref.read(signalRServiceProvider);
    signalR.connect();

    // Events for another branch still refetch (the refetch carries
    // X-Branch-Id), but only this branch's ring the kitchen. An event with
    // no branch id is for everyone.
    bool forActiveBranch(Map<String, dynamic> event) {
      final branchId = event['branchId'];
      return branchId == null || branchId == ref.read(selectedBranchIdProvider);
    }

    void toast(KdsToastType type, String Function(AppLocalizations l10n) message) {
      final context = rootNavigatorKey.currentContext;
      if (context == null || !context.mounted) return;
      showKdsToast(context, type, message(AppLocalizations.of(context)!));
    }

    // Every order event moves something on the board — a confirmation lands
    // a card, a Ready or Bring back on another screen moves one, a
    // cancellation removes one. Only a confirmation is worth a sound.
    _signalRSubscriptions.add(
      signalR.onOrderStatusChanged.listen((event) {
        _refreshBoard();
        if (!forActiveBranch(event)) return;
        if (event['type'] != 'order_confirmed') return;
        final orderId = (event['orderId'] as num?)?.toInt() ?? 0;
        final name = event['buyerName'] as String?;
        ref.read(chimeServiceProvider).play();
        toast(KdsToastType.info, (l10n) => name == null || name.isEmpty ? l10n.newOrderToast(orderId) : l10n.newOrderToastFrom(name, orderId));
      }),
    );
    _signalRSubscriptions.add(
      signalR.onBranchSettingsChanged.listen((_) {
        ref.read(branchProvider.notifier).refresh();
      }),
    );
    _signalRSubscriptions.add(
      signalR.onReconnected.listen((_) {
        // New connection id: anything missed while offline is refetched
        networkStatus.reportSuccess();
        _refreshBoard();
        ref.read(branchProvider.notifier).refresh();
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);
    final locale = ref.watch(localeProvider);
    final themeState = ref.watch(themeProvider);

    ThemeData materialTheme(Brightness brightness) => ThemeData(
          colorScheme: ColorScheme.fromSeed(
            seedColor: const Color(0xFF0F172A), // slate-900
            brightness: brightness,
          ),
          useMaterial3: true,
          fontFamily: getFontFamily(locale),
          splashFactory: NoSplash.splashFactory,
          highlightColor: Colors.transparent,
        );

    return MaterialApp.router(
      title: 'Chillax Kitchen',
      debugShowCheckedModeBanner: false,
      locale: locale,
      supportedLocales: AppLocalizations.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      themeMode: themeState.materialThemeMode,
      theme: materialTheme(Brightness.light),
      darkTheme: materialTheme(Brightness.dark),
      routerConfig: router,
      builder: (context, child) {
        return FTheme(
          data: themeState.getForuiTheme(context, locale: locale),
          child: FToaster(
            child: child ?? const SizedBox.shrink(),
          ),
        );
      },
    );
  }
}
