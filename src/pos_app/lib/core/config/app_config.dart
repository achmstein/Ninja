import 'tenant_connection.dart';

/// Application configuration for the POS tablet app
///
/// Which café this app talks to is data, not code. One generic build goes
/// to every café from the platform's download page; the first time it opens
/// it asks for the café's address and keeps the [TenantConnection] it finds
/// on the device. A build can still be pinned to one stack instead:
/// `tenants/<slug>.json` at the repository root, passed as
/// `--dart-define-from-file`, and then it never asks. Debug builds reach the
/// Aspire AppHost on the dev machine when told the realm alone, since the
/// code has no tenant of its own:
///
///   flutter run --dart-define=REALM=chillax
///
/// or connect to it like a tablet would, at http://localhost:5000.
class AppConfig {
  static const bool _isRelease = bool.fromEnvironment('dart.vm.product');

  static const String _apiUrl = String.fromEnvironment('API_URL');
  static const String _authUrl = String.fromEnvironment('AUTH_URL');
  static const String _realm = String.fromEnvironment('REALM');

  /// A build told its stack at build time never asks for one
  static bool get isPinned => _apiUrl.isNotEmpty;

  /// The café this device was connected to, when the build is not pinned
  static TenantConnection? get connection => TenantConnection.current.value;

  /// Whether there is a stack to talk to. Until there is, the connect
  /// screen is the whole app.
  static bool get isConnected => isPinned || connection != null || (!_isRelease && _realm.isNotEmpty);

  // Everything goes through the mobile BFF (YARP).
  // Debug: the Aspire AppHost on the dev machine, reached from the emulator
  //   through `adb reverse tcp:5000 tcp:5000` and `adb reverse tcp:8080 tcp:8080`
  //   (localhost on both sides keeps Keycloak's token issuer matching).
  static String get bffBaseUrl {
    if (_apiUrl.isNotEmpty) return _apiUrl;
    if (connection case final connection?) return connection.apiUrl;
    if (!_isRelease) return 'http://localhost:5000';
    throw StateError('Not connected to a café: the connect screen comes first');
  }

  // API endpoints (through BFF) - trailing slash required for Dio path resolution
  static String get catalogApiUrl => '$bffBaseUrl/api/catalog/';
  static String get ordersApiUrl => '$bffBaseUrl/api/orders/';
  /// Spaces' places: the rooms, the tables, the stations
  static String get placesApiUrl => '$bffBaseUrl/api/places/';
  /// Spaces' stays: the holds and running clocks
  static String get staysApiUrl => '$bffBaseUrl/api/stays/';
  static String get reservationsApiUrl => '$bffBaseUrl/api/reservations/';
  static String get identityApiUrl => '$bffBaseUrl/api/identity/';
  static String get notificationsApiUrl => '$bffBaseUrl/api/notifications/';
  static String get branchesApiUrl => '$bffBaseUrl/api/branches/';
  /// The tenant's brand: one anonymous resource, no sub-paths
  static String get tenantApiUrl => '$bffBaseUrl/api/tenant';
  // Sales.API serves both /api/tickets/* and /api/shifts/*
  static String get salesApiUrl => '$bffBaseUrl/api/';
  // Read-only on the till: a customer's points and tab balance on their card
  static String get loyaltyApiUrl => '$bffBaseUrl/api/loyalty/';
  static String get accountsApiUrl => '$bffBaseUrl/api/accounts/';
  // The pay-out pickers: whom to hand a wage, which supplier or partner,
  // what an expense is for. The till reads nothing else from either.
  static String get payrollApiUrl => '$bffBaseUrl/api/payroll/';
  static String get financeApiUrl => '$bffBaseUrl/api/finance/';

  /// The OpenID issuer to sign in against: the realm a pinned build was
  /// given, else the one the café's API named when this device connected
  /// (its own realm on the platform's auth host), else the AppHost's
  /// Keycloak through adb reverse in debug. Never a default realm: the app
  /// signs in against the café's, or against none.
  static String get identityUrl {
    if (_authUrl.isNotEmpty && _realm.isNotEmpty) return '$_authUrl/realms/$_realm';
    if (connection?.authority case final authority?) return authority;
    if (!_isRelease && _realm.isNotEmpty) return 'http://localhost:8080/realms/$_realm';
    throw StateError('No realm to sign in against: the café\'s API did not name one');
  }

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
  static const Duration shiftChipPoll = Duration(seconds: 60);
  static const Duration shiftScreenPoll = Duration(seconds: 20);
  static const Duration ticketByOrderPoll = Duration(milliseconds: 600);
  static const Duration ticketByOrderTimeout = Duration(seconds: 12);
}
