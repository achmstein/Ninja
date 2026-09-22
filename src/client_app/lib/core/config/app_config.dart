/// Application configuration
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
  static const String _googleServerClientId = String.fromEnvironment('GOOGLE_SERVER_CLIENT_ID');

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

  // Mobile BFF base URL (all API calls go through here)
  // Debug: localhost with adb reverse tcp:8080 tcp:5000 (BFF port)
  static String get bffBaseUrl => _given('API_URL', _apiUrl, debug: 'http://localhost:8080');

  // API endpoints (through BFF) - trailing slash required for Dio path resolution
  static String get catalogApiUrl => '$bffBaseUrl/api/catalog/';
  static String get ordersApiUrl => '$bffBaseUrl/api/orders/';
  static String get ticketsApiUrl => '$bffBaseUrl/api/tickets/';
  /// Spaces' places: the rooms, the tables, the stations
  static String get placesApiUrl => '$bffBaseUrl/api/places/';
  /// Spaces' reservations: the customer's claim on a place, for now or for later
  static String get reservationsApiUrl => '$bffBaseUrl/api/reservations/';
  /// Spaces' stays: the customer's running clocks and their history
  static String get staysApiUrl => '$bffBaseUrl/api/stays/';
  static String get loyaltyApiUrl => '$bffBaseUrl/api/loyalty/';
  static String get notificationsApiUrl => '$bffBaseUrl/api/notifications/';
  static String get accountsApiUrl => '$bffBaseUrl/api/accounts/';
  static String get identityApiUrl => '$bffBaseUrl/api/identity/';
  static String get branchesApiUrl => '$bffBaseUrl/api/branches/';
  /// The tenant's brand: one anonymous resource, no sub-paths
  static String get tenantApiUrl => '$bffBaseUrl/api/tenant';

  // Keycloak configuration
  // Release: the platform's auth host (Caddy proxies straight to Keycloak).
  // Debug: through the BFF, which strips /auth and forwards to Keycloak.
  static String get keycloakUrl => _given('AUTH_URL', _authUrl, debug: '$bffBaseUrl/auth');
  /// The tenant's realm. Never defaulted: a build signs in against the
  /// realm it was given, or against none.
  static String get keycloakRealm => _given('REALM', _realm);
  static String get identityUrl => '$keycloakUrl/realms/$keycloakRealm';

  // OIDC configuration. The scheme must match what the native folders
  // declare (AndroidManifest.xml, Info.plist); it becomes flavor data with
  // them in Phase 5 of docs/ninja-plan.md.
  static const String clientId = 'mobile-app';
  static const String _redirectScheme =
      String.fromEnvironment('REDIRECT_SCHEME', defaultValue: 'com.chillax.client');
  static const String redirectUri = '$_redirectScheme://callback';
  static const String postLogoutRedirectUri = '$_redirectScheme://';

  // Social login configuration
  // Google: the Web Client ID the realm's Google identity provider is
  // configured with (Google Cloud Console). Null leaves Google sign-in
  // without a server client, which the token exchange then refuses.
  static String? get googleServerClientId =>
      _googleServerClientId.isEmpty ? null : _googleServerClientId;

  static const List<String> scopes = [
    'openid',
    'profile',
    'email',
    'roles',
    'offline_access',
    'orders',
    'spaces',
    'catalog',
  ];

  // App info (the name comes from the tenant brand)
  static const String appVersion = '1.0.2';
}
