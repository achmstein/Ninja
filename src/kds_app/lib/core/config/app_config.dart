/// Application configuration for the Chillax Kitchen tablet app
class AppConfig {
  // Everything goes through the mobile BFF (YARP).
  // Debug: the Aspire AppHost on the dev machine, reached from the emulator
  //   through `adb reverse tcp:5000 tcp:5000` and `adb reverse tcp:8080 tcp:8080`
  //   (localhost on both sides keeps Keycloak's token issuer matching).
  // Release: the production server.
  static const bool _isRelease = bool.fromEnvironment('dart.vm.product');
  static String get bffBaseUrl {
    return _isRelease
        ? 'https://api.chillax.site'
        : 'http://localhost:5000';
  }

  // API endpoints (through BFF) - trailing slash required for Dio path resolution
  static String get ordersApiUrl => '$bffBaseUrl/api/orders/';
  static String get branchesApiUrl => '$bffBaseUrl/api/branches/';

  // Keycloak configuration
  // Release: dedicated auth subdomain (Caddy proxies straight to Keycloak).
  // Debug: the AppHost's Keycloak, through adb reverse.
  static String get keycloakUrl =>
      _isRelease ? 'https://auth.chillax.site' : 'http://localhost:8080';
  static const String keycloakRealm = 'chillax';
  static String get identityUrl => '$keycloakUrl/realms/$keycloakRealm';

  // OIDC configuration (Resource Owner Password Credentials, like pos_app).
  // offline_access on purpose: a wall-mounted tablet has no browser to
  // silently renew, so its refresh token must outlive the SSO idle timeout.
  static const String clientId = 'kds-app';
  static const String redirectUri = 'com.chillax.kds://callback';
  static const String postLogoutRedirectUri = 'com.chillax.kds://';
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

  // App info
  static const String appName = 'Chillax Kitchen';
  static const String appVersion = '1.0.0';

  // Poll fallback, mirroring kds_web (SignalR is the primary update path)
  static const Duration kitchenPoll = Duration(seconds: 20);
}
