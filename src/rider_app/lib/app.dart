import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:forui/forui.dart';
import 'package:go_router/go_router.dart';
import 'core/brand/brand_provider.dart';
import 'core/providers/branch_provider.dart';
import 'core/providers/locale_provider.dart';
import 'core/router/app_router.dart';
import 'core/network/network_status.dart';
import 'core/services/chime_service.dart';
import 'core/services/push_service.dart';
import 'core/services/signalr_service.dart';
import 'core/services/update_service.dart';
import 'core/widgets/rider_toast.dart';
import 'l10n/app_localizations.dart';
import 'core/theme/app_theme.dart';
import 'core/auth/auth_service.dart';
import 'features/deliveries/providers/deliveries_provider.dart';

/// Global navigator key for dialogs shown from outside the widget tree
final rootNavigatorKey = GlobalKey<NavigatorState>();

class NinjaRiderApp extends ConsumerStatefulWidget {
  const NinjaRiderApp({super.key});

  @override
  ConsumerState<NinjaRiderApp> createState() => _NinjaRiderAppState();
}

class _NinjaRiderAppState extends ConsumerState<NinjaRiderApp> with WidgetsBindingObserver {
  final List<StreamSubscription> _subscriptions = [];

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _initializeApp();

    // The hub may have given up while the network was out; reopen it the
    // moment the backend answers again
    ref.listenManual(onlineProvider, (previous, next) {
      if (next && previous == false) ref.read(signalRServiceProvider).reconnectIfNeeded();
    });

    // When the rider signs in: branches, the live hub, the phone's push
    // registration, and where they stand on duty
    ref.listenManual(authServiceProvider, (previous, next) {
      if (previous != null && !previous.isAuthenticated && next.isAuthenticated) {
        _connect();
        ref.read(branchProvider.notifier).loadBranches();
      }
    });

    // The branch decides where the till lists the rider and which deliveries show
    ref.listenManual(selectedBranchIdProvider, (previous, next) {
      if (next != null && next != previous && ref.read(authServiceProvider).isAuthenticated) {
        ref.read(pushServiceProvider).register();
      }
    });
  }

  @override
  void dispose() {
    for (final sub in _subscriptions) {
      sub.cancel();
    }
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!ref.read(authServiceProvider).isAuthenticated) return;
    if (state == AppLifecycleState.resumed) {
      ref.read(authServiceProvider.notifier).refreshToken();
      ref.read(signalRServiceProvider).reconnectIfNeeded();
      ref.read(brandProvider.notifier).refresh();
      // Whatever was given or taken while the phone was in a pocket
      _refresh();
      ref.read(dutyProvider.notifier).resume();
    } else if (state == AppLifecycleState.paused) {
      ref.read(dutyProvider.notifier).pause();
    }
  }

  Future<void> _initializeApp() async {
    await ref.read(authServiceProvider.notifier).initialize();
    FlutterNativeSplash.remove();

    // New builds from the platform's download page
    ref.read(updateProvider.notifier).start();

    if (ref.read(authServiceProvider).isAuthenticated) {
      _connect();
      ref.read(branchProvider.notifier).loadBranches();
    }
  }

  void _refresh() => ref.read(deliveriesProvider.notifier).refresh();

  void _toast(RiderToastType type, String Function(AppLocalizations l10n) message) {
    final context = rootNavigatorKey.currentContext;
    if (context == null || !context.mounted) return;
    showRiderToast(context, type, message(AppLocalizations.of(context)!));
  }

  /// The hub, the pushes and the duty switch, wired to the list
  void _connect() {
    final signalR = ref.read(signalRServiceProvider);
    signalR.connect();
    ref.read(dutyProvider.notifier).resume();

    for (final sub in _subscriptions) {
      sub.cancel();
    }
    _subscriptions.clear();

    // A delivery given, taken back or moved on: the list refetches. The push
    // says it out loud when the app is open; the hub only refreshes, so a
    // delivery is never rung twice.
    _subscriptions.add(signalR.onDeliveryChanged.listen((_) => _refresh()));
    _subscriptions.add(
      signalR.onBranchSettingsChanged.listen((_) {
        ref.read(branchProvider.notifier).refresh();
        ref.read(brandProvider.notifier).refresh();
      }),
    );
    _subscriptions.add(
      signalR.onReconnected.listen((_) {
        networkStatus.reportSuccess();
        _refresh();
        ref.read(branchProvider.notifier).refresh();
      }),
    );

    final push = ref.read(pushServiceProvider);
    _subscriptions.add(
      push.events.listen((event) {
        _refresh();
        if (event.opened) {
          // Tapped in the shade: the list is where it is
          GoRouter.of(rootNavigatorKey.currentContext!).go('/');
          return;
        }
        if (event.type == 'delivery_assigned') {
          ref.read(chimeServiceProvider).play(times: 2);
          _toast(RiderToastType.info, (l10n) => l10n.newDelivery(event.orderId));
        } else if (event.type == 'delivery_unassigned') {
          _toast(RiderToastType.warning, (l10n) => l10n.deliveryTakenBack(event.orderId));
        }
      }),
    );
    push.register();
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

    final brand = ref.watch(brandProvider).name;
    return MaterialApp.router(
      title: brand.isEmpty ? 'Rider' : '${brand.primary} Rider',
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
