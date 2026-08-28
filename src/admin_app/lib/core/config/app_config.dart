/// Application configuration for Admin Tablet App
class AppConfig {
  // Admin BFF base URL (all API calls go through here)
  // Debug: localhost with adb reverse tcp:8080 tcp:80
  // Release: Oracle Cloud server
  static const bool _isRelease = bool.fromEnvironment('dart.vm.product');
  static String get bffBaseUrl {
    return _isRelease
        ? 'https://api.chillax.site'
        : 'http://localhost:8080';
  }

  // API endpoints (through BFF) - trailing slash required for Dio path resolution
  static String get catalogApiUrl => '$bffBaseUrl/api/catalog/';
  static String get ordersApiUrl => '$bffBaseUrl/api/orders/';
  static String get roomsApiUrl => '$bffBaseUrl/api/rooms/';
  static String get sessionsApiUrl => '$bffBaseUrl/api/sessions/';
  static String get identityApiUrl => '$bffBaseUrl/api/identity/';
  static String get loyaltyApiUrl => '$bffBaseUrl/api/loyalty/';
  static String get accountsApiUrl => '$bffBaseUrl/api/accounts/';
  static String get notificationsApiUrl => '$bffBaseUrl/api/notifications/';
  static String get branchesApiUrl => '$bffBaseUrl/api/branches/';

  // Keycloak configuration
  // Release: dedicated auth subdomain (Caddy proxies straight to Keycloak).
  // Debug: through the BFF, which strips /auth and forwards to Keycloak.
  static String get keycloakUrl =>
      _isRelease ? 'https://auth.chillax.site' : '$bffBaseUrl/auth';
  static const String keycloakRealm = 'chillax';
  static String get identityUrl => '$keycloakUrl/realms/$keycloakRealm';

  // OIDC configuration
  static const String clientId = 'admin-app';
  static const String redirectUri = 'com.chillax.admin://callback';
  static const String postLogoutRedirectUri = 'com.chillax.admin://';
  static const List<String> scopes = [
    'openid',
    'profile',
    'email',
    'roles',
    'offline_access',
    'orders',
    'rooms',
    'catalog',
  ];

  // Required role for admin access
  static const String adminRole = 'Admin';

  // App info
  static const String appName = 'Chillax Admin';
  static const String appVersion = '1.0.0';

  // Refresh intervals
  static const Duration ordersRefreshInterval = Duration(seconds: 30);
  static const Duration roomsRefreshInterval = Duration(seconds: 10);
}
