/// Application configuration for the POS tablet app
///
/// Which stack this build talks to is data, not code: `tenants/<slug>.json`
/// at the repository root, passed as `--dart-define-from-file` (CI does it in
/// mobile-deploy.yml). Debug builds reach the Aspire AppHost on the dev
/// machine when no host is passed; the realm is always passed, since the
/// code has no tenant of its own:
///
///   flutter run --dart-define=REALM=chillax
class AppConfig {
  static const bool _isRelease = bool.fromEnvironment('dart.vm.product');

  static const String _apiUrl = String.fromEnvironment('API_URL');
  static const String _authUrl = String.fromEnvironment('AUTH_URL');
  static const String _realm = String.fromEnvironment('REALM');

  /// The value this build was given; the AppHost's in debug when it was not.
  /// A release build that was not told is a mistake, and says so at first use.
  static String _given(String name, String value, {String? debug}) {
    if (value.isNotEmpty) return value;
    if (!_isRelease && debug != null) return debug;
    throw StateError(
      '$name is not set: pass --dart-define=$name=… or '
      '--dart-define-from-file=tenants/<slug>.json (see mobile-deploy.yml)',
    );
  }

  // Everything goes through the mobile BFF (YARP).
  // Debug: the Aspire AppHost on the dev machine, reached from the emulator
  //   through `adb reverse tcp:5000 tcp:5000` and `adb reverse tcp:8080 tcp:8080`
  //   (localhost on both sides keeps Keycloak's token issuer matching).
  static String get bffBaseUrl => _given('API_URL', _apiUrl, debug: 'http://localhost:5000');

  // API endpoints (through BFF) - trailing slash required for Dio path resolution
  static String get catalogApiUrl => '$bffBaseUrl/api/catalog/';
  static String get ordersApiUrl => '$bffBaseUrl/api/orders/';
  /// Spaces' places: the rooms, the tables, the stations
  static String get placesApiUrl => '$bffBaseUrl/api/places/';
  /// Spaces' stays: the holds and running clocks
  static String get staysApiUrl => '$bffBaseUrl/api/stays/';
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

  // Keycloak configuration
  // Release: the platform's auth host (Caddy proxies straight to Keycloak).
  // Debug: the AppHost's Keycloak, through adb reverse.
  static String get keycloakUrl => _given('AUTH_URL', _authUrl, debug: 'http://localhost:8080');
  /// The tenant's realm. Never defaulted: a build signs in against the
  /// realm it was given, or against none.
  static String get keycloakRealm => _given('REALM', _realm);
  static String get identityUrl => '$keycloakUrl/realms/$keycloakRealm';

  // OIDC configuration (Resource Owner Password Credentials, like admin_app)
  static const String clientId = 'pos-app';
  // The scheme must match what the native folders declare
  // (AndroidManifest.xml); it becomes flavor data with them in Phase 5 of
  // docs/ninja-plan.md.
  static const String _redirectScheme =
      String.fromEnvironment('REDIRECT_SCHEME', defaultValue: 'com.chillax.pos');
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
