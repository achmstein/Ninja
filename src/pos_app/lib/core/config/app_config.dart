import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ninja_app_core/config.dart';
import 'package:ninja_app_core/tenant_connection.dart';
import '../demo/demo.dart';
import '../services/signalr_service.dart';

/// Application configuration for the POS tablet app. Which business it talks
/// to and how it reaches it is the shared core's ([CoreEndpoints]): one
/// generic build goes to every business from the platform's download page, a
/// build can be pinned to one stack with `--dart-define-from-file`, and a
/// debug build reaches the Aspire AppHost when told the realm alone:
///
///   flutter run --dart-define=REALM=chillax
///
/// or connect to it like a tablet would, at http://localhost:5000. What is the
/// till's own is here, and handed to the core as [core] at start.
class AppConfig {
  /// A build told its stack at build time never asks for one
  static bool get isPinned => CoreEndpoints.isPinned;

  /// The business this device was connected to, when the build is not pinned
  static TenantConnection? get connection => CoreEndpoints.connection;

  /// Whether there is a stack to talk to. Until there is, the connect
  /// screen is the whole app.
  static bool get isConnected => CoreEndpoints.isConnected;

  static String get bffBaseUrl => CoreEndpoints.bffBaseUrl;

  // API endpoints (through BFF) - trailing slash required for Dio path resolution
  static String get catalogApiUrl => '$bffBaseUrl/api/catalog/';
  static String get ordersApiUrl => CoreEndpoints.ordersApiUrl;
  static String get kitchenApiUrl => '$bffBaseUrl/api/kitchen/';
  /// Spaces' places: the rooms, the tables, the stations
  static String get placesApiUrl => '$bffBaseUrl/api/places/';
  /// Spaces' stays: the holds and running clocks
  static String get staysApiUrl => '$bffBaseUrl/api/stays/';
  static String get reservationsApiUrl => '$bffBaseUrl/api/reservations/';
  static String get identityApiUrl => '$bffBaseUrl/api/identity/';
  static String get notificationsApiUrl => '$bffBaseUrl/api/notifications/';
  static String get branchesApiUrl => CoreEndpoints.branchesApiUrl;
  /// The tenant's brand: one anonymous resource, no sub-paths
  static String get tenantApiUrl => CoreEndpoints.tenantApiUrl;
  // Sales.API serves both /api/tickets/* and /api/shifts/*
  static String get salesApiUrl => '$bffBaseUrl/api/';
  // Read-only on the till: a customer's points and tab balance on their card
  static String get loyaltyApiUrl => '$bffBaseUrl/api/loyalty/';
  static String get accountsApiUrl => '$bffBaseUrl/api/accounts/';
  // The pay-out pickers: whom to hand a wage, which supplier or partner,
  // what an expense is for. The till reads nothing else from either.
  static String get payrollApiUrl => '$bffBaseUrl/api/payroll/';
  static String get financeApiUrl => '$bffBaseUrl/api/finance/';

  /// The OpenID issuer to sign in against ([CoreEndpoints.identityUrl])
  static String get identityUrl => CoreEndpoints.identityUrl;

  // OIDC configuration (Resource Owner Password Credentials, like admin_app)
  static const String clientId = 'pos-app';
  // The scheme must match what the native folders declare
  // (AndroidManifest.xml); it becomes flavor data with them in Phase 5 of
  // docs/ninja-plan.md.
  static const String _redirectScheme =
      String.fromEnvironment('REDIRECT_SCHEME', defaultValue: 'com.ninja.pos');
  static const String redirectUri = '$_redirectScheme://callback';
  static const String postLogoutRedirectUri = '$_redirectScheme://';
  static const List<String> scopes = [
    'openid',
    'profile',
    'email',
    'roles',
    'branches',
    'offline_access',
    'orders',
    'spaces',
    'catalog',
  ];

  // Who may run the till — mirrors the backend "Pos" policy
  static const List<String> posRoles = ['Admin', 'Owner', 'Cashier'];

  // App info (the name comes from the tenant brand)
  static const String appVersion = '1.0.0';

  // Poll fallbacks, mirroring pos_web (SignalR is the primary update path)
  static const Duration ticketsPoll = Duration(seconds: 20);
  static const Duration roomsPoll = Duration(seconds: 60);
  static const Duration sessionsPoll = Duration(seconds: 30);
  static const Duration pendingOrdersPoll = Duration(seconds: 60);
  static const Duration serviceRequestsPoll = Duration(seconds: 30);

  /// The deliveries board: the hub's DeliveryChanged is the primary path
  static const Duration deliveriesPoll = Duration(seconds: 20);

  /// How often the deliveries board redraws its "since" times
  static const Duration deliveriesClockTick = Duration(seconds: 30);

  /// The phone-order form waits this long after typing stops before asking the server
  static const Duration deliveryLookupDebounce = Duration(milliseconds: 400);

  /// Shorter than this a distance reads in metres, longer in kilometres
  static const int metresUntilKm = 950;
  static const Duration shiftChipPoll = Duration(seconds: 60);
  static const Duration shiftScreenPoll = Duration(seconds: 20);
  static const Duration ticketByOrderPoll = Duration(milliseconds: 600);
  static const Duration ticketByOrderTimeout = Duration(seconds: 12);

  /// What the shared core needs to know about the till
  static final NinjaAppConfig core = NinjaAppConfig(
    appKey: 'pos',
    clientId: clientId,
    scopes: scopes,
    allowedRoles: posRoles,
    // A till signs in with a staff username and password once and then
    // lives on silent refreshes
    passwordSignIn: true,
    // Where the till kept its language before the shared core; its branch
    // (`pos_selected_branch_id`) and theme (`pos_app_theme_mode`) already
    // follow the core's `<appKey>_` keys
    localeKey: 'app_locale',
    // Someone who has not chosen sees the device's theme
    defaultThemeMode: 'system',
    // As it always has: the download page wherever the stack says, its
    // checksum when the release gives one, and overnight silently on a
    // kiosk tablet (device owner). Never in the design-time demo.
    update: const UpdateConfig(
      channel: 'com.ninja.pos/update',
      file: 'ninja-pos',
      enabled: !kDemoMode,
      requireChecksum: false,
      httpsOnly: false,
      silentKioskInstall: true,
    ),
    onSignedIn: (Ref ref) => unawaited(ref.read(signalRServiceProvider).connect()),
    onSigningOut: (Ref ref) => ref.read(signalRServiceProvider).disconnect(),
  );
}
