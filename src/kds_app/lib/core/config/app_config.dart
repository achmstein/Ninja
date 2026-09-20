/// Application configuration for the kitchen display tablet app
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
  static String get ordersApiUrl => '$bffBaseUrl/api/orders/';
  static String get branchesApiUrl => '$bffBaseUrl/api/branches/';
  /// The tenant's brand: one anonymous resource, no sub-paths
  static String get tenantApiUrl => '$bffBaseUrl/api/tenant';

  // Keycloak configuration
  // Release: the platform's auth host (Caddy proxies straight to Keycloak).
  // Debug: the AppHost's Keycloak, through adb reverse.
  static String get keycloakUrl => _given('AUTH_URL', _authUrl, debug: 'http://localhost:8080');
  /// The tenant's realm. Never defaulted: a build signs in against the
  /// realm it was given, or against none.
  static String get keycloakRealm => _given('REALM', _realm);
  static String get identityUrl => '$keycloakUrl/realms/$keycloakRealm';

  // OIDC configuration (Resource Owner Password Credentials, like pos_app).
  // offline_access on purpose: a wall-mounted tablet has no browser to
  // silently renew, so its refresh token must outlive the SSO idle timeout.
  static const String clientId = 'kds-app';
  // The scheme must match what the native folders declare
  // (AndroidManifest.xml); it becomes flavor data with them in Phase 5 of
  // docs/ninja-plan.md.
  static const String _redirectScheme =
      String.fromEnvironment('REDIRECT_SCHEME', defaultValue: 'com.chillax.kds');
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
  ];

  // Who may run the kitchen display — mirrors the backend "Pos" policy,
  // the same gate kds_web applies
  static const List<String> posRoles = ['Admin', 'Owner', 'Cashier'];

  // App info (the name comes from the tenant brand)
  static const String appVersion = '1.0.0';

  // Poll fallback, mirroring kds_web (SignalR is the primary update path)
  static const Duration kitchenPoll = Duration(seconds: 20);
}
