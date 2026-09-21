import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'core/brand/brand_provider.dart';
import 'core/providers/branch_provider.dart';
import 'core/providers/locale_provider.dart';
import 'core/router/app_router.dart';
import 'core/network/network_status.dart';
import 'core/offline/offline_queue.dart';
import 'core/services/chime_service.dart';
import 'core/services/kiosk_service.dart';
import 'core/services/signalr_service.dart';
import 'core/widgets/pos_toast.dart';
import 'l10n/app_localizations.dart';
import 'core/theme/app_theme.dart';
import 'core/auth/auth_service.dart';
import 'core/demo/demo.dart';
import 'features/catalog/providers/catalog_provider.dart';
import 'features/orders/providers/pending_orders_provider.dart';
import 'features/places/providers/places_provider.dart';
import 'features/service_requests/providers/service_requests_provider.dart';
import 'features/tickets/providers/tickets_provider.dart';

/// Global navigator key for dialogs shown from outside the widget tree
final rootNavigatorKey = GlobalKey<NavigatorState>();

class NinjaPosApp extends ConsumerStatefulWidget {
  const NinjaPosApp({super.key});

  @override
  ConsumerState<NinjaPosApp> createState() => _NinjaPosAppState();
}

class _NinjaPosAppState extends ConsumerState<NinjaPosApp> with WidgetsBindingObserver {
  final List<StreamSubscription> _signalRSubscriptions = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initializeApp();

    // Sales rung up offline replay the moment the network is back — and at
    // start, in case the till was restarted while some were still waiting
    ref.listenManual(onlineProvider, (previous, next) {
      if (next && previous == false) {
        ref.read(offlineQueueProvider.notifier).drain();
        // The hub may have given up while the network was out
        ref.read(signalRServiceProvider).reconnectIfNeeded();
      }
    });
    Future.microtask(() {
      if (ref.read(onlineProvider)) ref.read(offlineQueueProvider.notifier).drain();
    });

    // When the cashier signs in, load branches and connect SignalR
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
      ref.read(brandProvider.notifier).refresh();
      // Android drops immersive mode after some system UI; put it back
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
      // A till that asked to be pinned stays pinned
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

  /// Maps hub events to provider refreshes, the way pos_web's
  /// use-pos-notifications maps them to query invalidations.
  void _connectSignalR() {
    final signalR = ref.read(signalRServiceProvider);
    signalR.connect();

    void refreshTickets() => ref.read(openTicketsProvider.notifier).refresh();
    // An item marked sold out on another till, or a price change from admin
    void refreshCatalog() {
      ref.read(catalogItemsProvider.notifier).refresh();
      ref.invalidate(catalogCategoriesProvider);
    }

    void refreshOrders() => ref.read(pendingOrdersProvider.notifier).refresh();
    void refreshRequests() => ref.read(serviceRequestsProvider.notifier).refresh();
    void refreshRooms() => ref.read(placesProvider.notifier).refresh();
    // Events for another branch still refetch (the refetch carries
    // X-Branch-Id), but only this branch's ring the till
    bool forActiveBranch(Map<String, dynamic> event) {
      final branchId = event['branchId'];
      return branchId == null || branchId == ref.read(selectedBranchIdProvider);
    }

    void toast(PosToastType type, String Function(AppLocalizations l10n) message) {
      final context = rootNavigatorKey.currentContext;
      if (context == null || !context.mounted) return;
      showPosToast(context, type, message(AppLocalizations.of(context)!));
    }

    _signalRSubscriptions.add(signalR.onTicketUpdated.listen((_) => refreshTickets()));
    // Customer app orders wait for a cashier's tap, so the till gets the
    // alerts the admin board gets: a chime and a toast when one arrives, and
    // the backend's escalating reminders for anything left waiting (1/2/4/7/
    // 10 min) — from the third one on, ring rather than politely ping.
    _signalRSubscriptions.add(
      signalR.onOrderStatusChanged.listen((event) {
        refreshTickets();
        refreshOrders();
        if (!forActiveBranch(event)) return;
        final orderId = (event['orderId'] as num?)?.toInt() ?? 0;
        switch (event['type']) {
          case 'order_submitted':
            ref.read(chimeServiceProvider).play();
            final name = event['buyerName'] as String?;
            toast(PosToastType.info, (l10n) => name == null || name.isEmpty ? l10n.newOrderToast(orderId) : l10n.newOrderToastFrom(name, orderId));
          case 'order_reminder':
            final count = (event['reminderCount'] as num?)?.toInt() ?? 1;
            final minutes = (event['minutesPending'] as num?)?.toInt() ?? 0;
            ref.read(chimeServiceProvider).play(times: count >= 3 ? 3 : 1);
            toast(PosToastType.warning, (l10n) => l10n.orderWaitingToast(minutes, orderId));
        }
      }),
    );
    // A customer in a room asked for something — call a waiter, the bill,
    // a controller. Same alert a new order gets: chime + toast.
    _signalRSubscriptions.add(
      signalR.onServiceRequestCreated.listen((event) {
        refreshRequests();
        if (!forActiveBranch(event)) return;
        ref.read(chimeServiceProvider).play();
        toast(PosToastType.info, (l10n) => l10n.newServiceRequestToast);
      }),
    );
    _signalRSubscriptions.add(signalR.onRoomStatusChanged.listen((_) => refreshRooms()));
    _signalRSubscriptions.add(signalR.onCatalogChanged.listen((_) => refreshCatalog()));
    _signalRSubscriptions.add(
      signalR.onBranchSettingsChanged.listen((_) {
        ref.read(branchProvider.notifier).refresh();
        // The brand is edited on the same admin page as the branch settings
        ref.read(brandProvider.notifier).refresh();
      }),
    );
    _signalRSubscriptions.add(
      signalR.onReconnected.listen((_) {
        // New connection id: anything missed while offline is refetched
        networkStatus.reportSuccess();
        refreshTickets();
        refreshOrders();
        refreshRequests();
        refreshRooms();
        refreshCatalog();
        ref.read(branchProvider.notifier).refresh();
        ref.read(brandProvider.notifier).refresh();
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
      title: ref.watch(brandProvider).name.en.isEmpty ? 'POS' : '${ref.watch(brandProvider).name.en} POS',
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
