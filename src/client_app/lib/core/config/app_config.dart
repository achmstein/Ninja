/// Application configuration
class AppConfig {
  // Mobile BFF base URL (all API calls go through here)
  // Debug: localhost with adb reverse tcp:8080 tcp:5000 (BFF port)
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
  static String get ticketsApiUrl => '$bffBaseUrl/api/tickets/';
  /// Spaces' places: the rooms, the tables, the stations
  static String get placesApiUrl => '$bffBaseUrl/api/places/';
  /// Spaces' stays: the customer's holds and running clocks
  static String get staysApiUrl => '$bffBaseUrl/api/stays/';
  /// The older table stickers (/table/{id}) resolve through this

  static String get tablesApiUrl => '$bffBaseUrl/api/tables/';
  static String get loyaltyApiUrl => '$bffBaseUrl/api/loyalty/';
  static String get notificationsApiUrl => '$bffBaseUrl/api/notifications/';
  static String get accountsApiUrl => '$bffBaseUrl/api/accounts/';
  static String get identityApiUrl => '$bffBaseUrl/api/identity/';
  static String get branchesApiUrl => '$bffBaseUrl/api/branches/';

  // Keycloak configuration
  // Release: dedicated auth subdomain (Caddy proxies straight to Keycloak).
  // Debug: through the BFF, which strips /auth and forwards to Keycloak.
  static String get keycloakUrl =>
      _isRelease ? 'https://auth.chillax.site' : '$bffBaseUrl/auth';
  static const String keycloakRealm = 'chillax';
  static String get identityUrl => '$keycloakUrl/realms/$keycloakRealm';

  // OIDC configuration
  static const String clientId = 'mobile-app';
  static const String redirectUri = 'com.chillax.client://callback';
  static const String postLogoutRedirectUri = 'com.chillax.client://';

  // Social login configuration
  // Google: This should match the Web Client ID configured in Keycloak
  // Set via environment or replace with actual value from Google Cloud Console
  static const String googleServerClientId = '781709613952-k0s4k6mg9nq82kf16td3snotikpv7469.apps.googleusercontent.com';

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

  // App info
  static const String appName = 'Chillax';
  static const String appVersion = '1.0.2';
}
