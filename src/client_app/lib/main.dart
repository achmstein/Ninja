import 'dart:async';
import 'dart:ui';
import 'package:flutter/services.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'l10n/app_localizations.dart';
import 'core/router/app_router.dart';
import 'core/auth/auth_service.dart';
import 'core/providers/branch_provider.dart';
import 'core/providers/current_place_provider.dart';
import 'core/providers/locale_provider.dart';
import 'core/services/firebase_service.dart';
import 'core/services/session_notification_service.dart';
import 'core/services/signalr_service.dart';
import 'core/theme/theme_provider.dart';
import 'core/theme/app_theme.dart';
import 'features/menu/providers/favorites_provider.dart';
import 'features/menu/services/menu_service.dart';
import 'features/notifications/services/notification_service.dart';
import 'features/bills/services/bills_service.dart';
import 'features/orders/services/order_service.dart';
import 'features/places/services/place_service.dart';
import 'features/settings/providers/settings_provider.dart';

void main() async {
  WidgetsBinding widgetsBinding = WidgetsFlutterBinding.ensureInitialized();
  FlutterNativeSplash.preserve(widgetsBinding: widgetsBinding);

  await initializeLocale();
  await initializeBranch();
  await initializeCurrentPlace();

  // Initialize Firebase before setting up Crashlytics handlers
  try {
    await Firebase.initializeApp();

    // Set up background message handler
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);

    // Send Flutter errors to Crashlytics
    FlutterError.onError = FirebaseCrashlytics.instance.recordFlutterFatalError;

    // Send async errors to Crashlytics
    PlatformDispatcher.instance.onError = (error, stack) {
      FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
      return true;
    };
  } catch (_) {
    // Firebase not configured - app will work without crash reporting
  }

  runApp(
    const ProviderScope(
      child: ChillaxApp(),
    ),
  );
}

class ChillaxApp extends ConsumerStatefulWidget {
  const ChillaxApp({super.key});

  @override
  ConsumerState<ChillaxApp> createState() => _ChillaxAppState();
}

class _ChillaxAppState extends ConsumerState<ChillaxApp>
    with WidgetsBindingObserver {
  final List<StreamSubscription> _signalRSubscriptions = [];
  bool _wasAuthenticated = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initializeApp();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _cancelSignalRSubscriptions();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _wasAuthenticated) {
      ref.read(signalRServiceProvider).reconnectIfNeeded();
      ref.read(myStaysProvider.notifier).refresh();
      ref.read(branchProvider.notifier).refreshSilently();
      final branchId = ref.read(selectedBranchIdProvider);
      if (branchId != null) ref.invalidate(placesProvider(branchId));
      _reregisterNotificationsIfEnabled();
    }
  }

  void _reregisterNotificationsIfEnabled() {
    final prefs = ref.read(settingsProvider).preferences;
    if (prefs.orderStatusUpdates) {
      _registerForNotifications();
    }
  }

  Future<void> _initializeApp() async {
    try {
      await ref.read(authServiceProvider.notifier).initialize();

      final authState = ref.read(authServiceProvider);
      if (authState.isAuthenticated) {
        _connectSignalR();
        _wasAuthenticated = true;
        // Start session notification listener — it will eagerly fetch
        // sessions and show the notification if one is already active.
        ref.read(sessionNotificationServiceProvider).startListening();
      }
    } catch (e, stack) {
      debugPrint('App initialization error: $e\n$stack');
    } finally {
      FlutterNativeSplash.remove();
    }

    // Initialize Firebase messaging in background (never blocks UI)
    _initializeFirebaseMessaging();

    // Listen for navigation from native (e.g. notification tap)
    const navigationChannel = MethodChannel('com.chillax.client/navigation');
    navigationChannel.setMethodCallHandler((call) async {
      if (call.method == 'navigateTo') {
        final route = call.arguments as String?;
        if (route != null) {
          final router = ref.read(routerProvider);
          router.go(route);
        }
      }
    });
  }

  Future<void> _initializeFirebaseMessaging() async {
    try {
      await ref.read(firebaseServiceProvider).initialize();

      if (ref.read(authServiceProvider).isAuthenticated) {
        _registerForNotifications();
      }
    } catch (e) {
      debugPrint('Firebase messaging initialization failed: $e');
    }
  }

  void _cancelSignalRSubscriptions() {
    for (final sub in _signalRSubscriptions) {
      sub.cancel();
    }
    _signalRSubscriptions.clear();
  }

  void _registerForNotifications() {
    final lang = ref.read(localeProvider).languageCode;
    final notificationRepo = ref.read(notificationRepositoryProvider);

    notificationRepo.registerForOrderNotifications(preferredLanguage: lang);
    notificationRepo.registerForSessionNotifications(preferredLanguage: lang);

    ref.read(firebaseServiceProvider).onTokenRefresh((_) {
      final lang = ref.read(localeProvider).languageCode;
      ref.read(notificationRepositoryProvider).registerForOrderNotifications(
        preferredLanguage: lang,
      );
      ref.read(notificationRepositoryProvider).registerForSessionNotifications(
        preferredLanguage: lang,
      );
    });
  }

  void _connectSignalR() {
    final signalR = ref.read(signalRServiceProvider);
    signalR.connect();

    _signalRSubscriptions.add(
      signalR.onRoomStatusChanged.listen((_) {
        final branchId = ref.read(selectedBranchIdProvider);
        if (branchId != null) ref.invalidate(placesProvider(branchId));
        ref.read(myStaysProvider.notifier).refresh();
        ref.read(myBillsProvider.notifier).refresh();
        ref.invalidate(roomAvailabilitySubscriptionProvider);
        WidgetsBinding.instance.ensureVisualUpdate();
      }),
    );
    _signalRSubscriptions.add(
      signalR.onOrderStatusChanged.listen((_) {
        ref.read(ordersProvider.notifier).refresh();
        ref.read(myBillsProvider.notifier).refresh();
        WidgetsBinding.instance.ensureVisualUpdate();
      }),
    );
    _signalRSubscriptions.add(
      signalR.onBranchSettingsChanged.listen((_) async {
        await ref.read(branchProvider.notifier).refreshSilently();
        WidgetsBinding.instance.ensureVisualUpdate();
      }),
    );
    _signalRSubscriptions.add(
      signalR.onCatalogChanged.listen((_) {
        // An item went sold out (or came back) at the till: drop every
        // cached menu (all locales and branches) so the open screen refetches
        ref.invalidate(groupedMenuItemsProvider);
        ref.invalidate(menuItemsProvider);
        WidgetsBinding.instance.ensureVisualUpdate();
      }),
    );
  }

  @override
  Widget build(BuildContext context) {
    final authState = ref.watch(authServiceProvider);
    final router = ref.watch(routerProvider);
    final themeState = ref.watch(themeProvider);
    final locale = ref.watch(localeProvider);

    if (authState.isAuthenticated && !_wasAuthenticated) {
      _wasAuthenticated = true;
      try {
        if (authState.userId != null) {
          FirebaseCrashlytics.instance.setUserIdentifier(authState.userId!);
        }
      } catch (_) {}
      _connectSignalR();
      _registerForNotifications();
      ref.read(sessionNotificationServiceProvider).startListening();
    } else if (!authState.isAuthenticated && _wasAuthenticated) {
      _wasAuthenticated = false;
      _cancelSignalRSubscriptions();
      ref.read(notificationRepositoryProvider).unregisterFromOrderNotifications();
      ref.read(notificationRepositoryProvider).unregisterFromSessionNotifications();
      ref.read(sessionNotificationServiceProvider).stopListening();
      ref.invalidate(favoritesProvider);
    }

    return MaterialApp.router(
      title: 'Chillax',
      debugShowCheckedModeBanner: false,
      routerConfig: router,
      locale: locale,
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: AppTheme.primaryColor,
          brightness: Brightness.light,
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
          seedColor: AppTheme.primaryColor,
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
      themeMode: themeState.themeMode == AppThemeMode.light
          ? ThemeMode.light
          : themeState.themeMode == AppThemeMode.dark
              ? ThemeMode.dark
              : ThemeMode.system,
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
