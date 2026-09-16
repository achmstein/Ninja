import 'dart:async';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'core/widgets/app_text.dart';
import 'core/providers/branch_provider.dart';
import 'core/providers/locale_provider.dart';
import 'core/router/app_router.dart';
import 'core/services/signalr_service.dart';
import 'core/theme/app_theme.dart';
import 'core/auth/auth_service.dart';
import 'core/services/battery_optimization_service.dart';
import 'features/service_requests/providers/service_requests_provider.dart';
import 'features/orders/providers/orders_provider.dart';
import 'features/places/providers/places_provider.dart';
import 'l10n/app_localizations.dart';

/// Global navigator key for showing dialogs from FCM handlers
final rootNavigatorKey = GlobalKey<NavigatorState>();

class ChillaxAdminApp extends ConsumerStatefulWidget {
  const ChillaxAdminApp({super.key});

  @override
  ConsumerState<ChillaxAdminApp> createState() => _ChillaxAdminAppState();
}

class _ChillaxAdminAppState extends ConsumerState<ChillaxAdminApp> with WidgetsBindingObserver {
  final List<StreamSubscription> _signalRSubscriptions = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initializeApp();
    _setupFCMHandlers();

    // When user logs in, load branches and connect SignalR
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
      authService.reregisterNotifications();
      ref.read(signalRServiceProvider).reconnectIfNeeded();

      // Re-check permissions on resume (user may have said "Later"
      // or just came back from system settings)
      if (ref.read(authServiceProvider).isAuthenticated) {
        _checkPermissions();
      }
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
      // Set user ID on Crashlytics so crashes are tied to users
      if (authState.userId != null) {
        FirebaseCrashlytics.instance.setUserIdentifier(authState.userId!);
      }
      _connectSignalR();
      ref.read(branchProvider.notifier).loadBranches();

      // Check permissions after a short delay (let UI settle)
      Future.delayed(const Duration(seconds: 2), _checkPermissions);
    }
  }

  Future<void> _checkPermissions() async {
    // Check battery optimization first
    if (await BatteryOptimizationService.shouldShowBatteryPrompt()) {
      await _showBatteryOptimizationPrompt();
      return; // Show one prompt at a time, check the other on next resume
    }

    // Then check full-screen intent permission (Android 14+)
    if (await BatteryOptimizationService.shouldShowFullScreenPrompt()) {
      _showFullScreenIntentPrompt();
    }
  }

  Future<void> _showBatteryOptimizationPrompt() async {
    final navigatorContext = rootNavigatorKey.currentContext;
    if (navigatorContext == null || !navigatorContext.mounted) return;

    final l10n = AppLocalizations.of(navigatorContext)!;

    showAdaptiveDialog(
      context: navigatorContext,
      barrierDismissible: false,
      builder: (context) => FDialog(
        direction: Axis.vertical,
        title: AppText(l10n.batteryOptimizationTitle),
        body: AppText(l10n.batteryOptimizationBody),
        actions: [
          FButton(
            onPress: () async {
              Navigator.of(context, rootNavigator: true).pop();
              await BatteryOptimizationService.requestIgnoreBatteryOptimizations();
            },
            child: AppText(l10n.disableNow),
          ),
          FButton(
            variant: FButtonVariant.outline,
            onPress: () => Navigator.of(context, rootNavigator: true).pop(),
            child: AppText(l10n.later),
          ),
          FButton(
            variant: FButtonVariant.outline,
            onPress: () async {
              await BatteryOptimizationService.dismissBatteryPromptPermanently();
              if (context.mounted) Navigator.of(context, rootNavigator: true).pop();
            },
            child: AppText(l10n.dontShowAgain),
          ),
        ],
      ),
    );
  }

  void _showFullScreenIntentPrompt() {
    final navigatorContext = rootNavigatorKey.currentContext;
    if (navigatorContext == null || !navigatorContext.mounted) return;

    final l10n = AppLocalizations.of(navigatorContext)!;

    showAdaptiveDialog(
      context: navigatorContext,
      barrierDismissible: false,
      builder: (context) => FDialog(
        direction: Axis.vertical,
        title: AppText(l10n.fullScreenIntentTitle),
        body: AppText(l10n.fullScreenIntentBody),
        actions: [
          FButton(
            onPress: () async {
              Navigator.of(context, rootNavigator: true).pop();
              await BatteryOptimizationService.requestFullScreenIntentPermission();
            },
            child: AppText(l10n.allowNow),
          ),
          FButton(
            variant: FButtonVariant.outline,
            onPress: () => Navigator.of(context, rootNavigator: true).pop(),
            child: AppText(l10n.later),
          ),
          FButton(
            variant: FButtonVariant.outline,
            onPress: () async {
              await BatteryOptimizationService.dismissFullScreenPromptPermanently();
              if (context.mounted) Navigator.of(context, rootNavigator: true).pop();
            },
            child: AppText(l10n.dontShowAgain),
          ),
        ],
      ),
    );
  }

  void _connectSignalR() {
    final signalR = ref.read(signalRServiceProvider);
    signalR.connect();

    // Listen for realtime events and refresh providers
    _signalRSubscriptions.add(
      signalR.onRoomStatusChanged.listen((_) {
        ref.read(placesProvider.notifier).loadPlaces();
      }),
    );
    _signalRSubscriptions.add(
      signalR.onOrderStatusChanged.listen((_) {
        ref.read(ordersProvider.notifier).loadOrders();
      }),
    );
    _signalRSubscriptions.add(
      signalR.onServiceRequestCreated.listen((_) {
        ref.read(serviceRequestsProvider.notifier).loadRequests();
      }),
    );
    _signalRSubscriptions.add(
      signalR.onBranchSettingsChanged.listen((_) {
        ref.read(branchProvider.notifier).refresh();
      }),
    );
  }

  void _setupFCMHandlers() {
    // Handle foreground messages
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      debugPrint('FCM foreground message: ${message.data}');
      _handleFCMMessage(message);
    });

    // Handle messages that opened the app from background
    FirebaseMessaging.onMessageOpenedApp.listen((RemoteMessage message) {
      debugPrint('FCM message opened app: ${message.data}');
      _handleFCMMessage(message);
      _navigateFromFCM(message);
    });

    // Check for initial message (app opened from terminated state)
    FirebaseMessaging.instance.getInitialMessage().then((message) {
      if (message != null) {
        debugPrint('FCM initial message: ${message.data}');
        _handleFCMMessage(message);
        // Delay navigation to let router initialize
        Future.delayed(const Duration(milliseconds: 500), () {
          _navigateFromFCM(message);
        });
      }
    });
  }

  void _navigateFromFCM(RemoteMessage message) {
    final type = message.data['type'];
    final route = switch (type) {
      'service_request' => '/service-requests',
      'new_order' || 'order_reminder' => '/orders',
      'new_reservation' => '/places',
      _ => null,
    };
    if (route != null) {
      ref.read(routerProvider).go(route);
    }
  }

  void _handleFCMMessage(RemoteMessage message) {
    final type = message.data['type'];

    switch (type) {
      case 'service_request':
        // Refresh service requests list
        ref.read(serviceRequestsProvider.notifier).loadRequests();
        break;
      case 'new_order':
        // Refresh orders list
        ref.read(ordersProvider.notifier).loadOrders();
        break;
      case 'order_reminder':
        // Refresh orders list
        ref.read(ordersProvider.notifier).loadOrders();
        // Show in-app alert dialog for reminders (foreground only)
        _showOrderReminderAlert(message.data);
        break;
      case 'new_reservation':
        // Refresh places list
        ref.read(placesProvider.notifier).loadPlaces();
        break;
      default:
        debugPrint('Unknown FCM message type: $type');
    }
  }

  void _showOrderReminderAlert(Map<String, dynamic> data) {
    final navigatorContext = rootNavigatorKey.currentContext;
    if (navigatorContext == null) return;

    final reminderCount = int.tryParse(data['reminderCount']?.toString() ?? '') ?? 1;
    final orderId = data['orderId'] ?? '';
    final buyerName = data['buyerName'] ?? 'Customer';
    final minutesPending = data['minutesPending'] ?? '?';
    final isUrgent = reminderCount >= 3;

    final l10n = AppLocalizations.of(navigatorContext);
    if (l10n == null) return;

    if (isUrgent) {
      // Urgent: Material AlertDialog with red background (FDialog doesn't support custom bg)
      showDialog(
        context: navigatorContext,
        barrierDismissible: false,
        builder: (context) => AlertDialog(
          backgroundColor: const Color(0xFF7F1D1D), // red-900
          icon: const Icon(Icons.warning_amber_rounded, size: 48, color: Colors.amber),
          title: Text(
            l10n.orderNotConfirmed(orderId),
            style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.white),
          ),
          content: Text(
            l10n.orderWaitingBody(buyerName, minutesPending),
            textAlign: TextAlign.center,
            style: const TextStyle(color: Colors.white70),
          ),
          actions: [
            FilledButton(
              style: FilledButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: Colors.black,
              ),
              onPressed: () {
                Navigator.of(context, rootNavigator: true).pop();
                ref.read(routerProvider).go('/orders');
              },
              child: Text(l10n.viewOrders),
            ),
          ],
          actionsAlignment: MainAxisAlignment.center,
        ),
      );
    } else {
      // Non-urgent: Forui dialog
      showAdaptiveDialog(
        context: navigatorContext,
        builder: (context) => FDialog(
          direction: Axis.horizontal,
          title: AppText(l10n.orderWaiting(orderId)),
          body: AppText(l10n.orderWaitingBody(buyerName, minutesPending)),
          actions: [
            FButton(
              variant: FButtonVariant.outline,
              onPress: () => Navigator.of(context, rootNavigator: true).pop(),
              child: AppText(l10n.dismiss),
            ),
            FButton(
              onPress: () {
                Navigator.of(context, rootNavigator: true).pop();
                ref.read(routerProvider).go('/orders');
              },
              child: AppText(l10n.viewOrders),
            ),
          ],
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final router = ref.watch(routerProvider);
    final locale = ref.watch(localeProvider);
    final themeState = ref.watch(themeProvider);

    return MaterialApp.router(
      title: 'Chillax Admin',
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
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF18181B), // zinc-900 (black)
        ),
        useMaterial3: true,
        fontFamily: getFontFamily(locale),
        splashFactory: NoSplash.splashFactory,
        highlightColor: Colors.transparent,
        tabBarTheme: const TabBarThemeData(
          overlayColor: WidgetStatePropertyAll(Colors.transparent),
        ),
      ),
      darkTheme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF18181B), // zinc-900 (black)
          brightness: Brightness.dark,
        ),
        useMaterial3: true,
        fontFamily: getFontFamily(locale),
        splashFactory: NoSplash.splashFactory,
        highlightColor: Colors.transparent,
        tabBarTheme: const TabBarThemeData(
          overlayColor: WidgetStatePropertyAll(Colors.transparent),
        ),
      ),
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
