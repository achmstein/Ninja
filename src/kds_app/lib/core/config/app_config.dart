import 'tenant_connection.dart';

/// Application configuration for the kitchen display tablet app
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
  static String get ordersApiUrl => '$bffBaseUrl/api/orders/';
  static String get branchesApiUrl => '$bffBaseUrl/api/branches/';
  /// The tenant's brand: one anonymous resource, no sub-paths
  static String get tenantApiUrl => '$bffBaseUrl/api/tenant';

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

  // OIDC configuration (Resource Owner Password Credentials, like pos_app).
  // offline_access on purpose: a wall-mounted tablet has no browser to
  // silently renew, so its refresh token must outlive the SSO idle timeout.
  static const String clientId = 'kds-app';
  // The scheme must match what the native folders declare
  // (AndroidManifest.xml); it becomes flavor data with them in Phase 5 of
  // docs/ninja-plan.md.
  static const String _redirectScheme =
      String.fromEnvironment('REDIRECT_SCHEME', defaultValue: 'com.ninja.kds');
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
