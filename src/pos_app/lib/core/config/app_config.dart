/// Application configuration for the Chillax POS tablet app
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
  static String get catalogApiUrl => '$bffBaseUrl/api/catalog/';
  static String get ordersApiUrl => '$bffBaseUrl/api/orders/';
  static String get roomsApiUrl => '$bffBaseUrl/api/rooms/';
  static String get tablesApiUrl => '$bffBaseUrl/api/tables/';
  static String get identityApiUrl => '$bffBaseUrl/api/identity/';
  static String get notificationsApiUrl => '$bffBaseUrl/api/notifications/';
  static String get branchesApiUrl => '$bffBaseUrl/api/branches/';
  // Sales.API serves both /api/tickets/* and /api/shifts/*
  static String get salesApiUrl => '$bffBaseUrl/api/';

  // Keycloak configuration
  // Release: dedicated auth subdomain (Caddy proxies straight to Keycloak).
  // Debug: the AppHost's Keycloak, through adb reverse.
  static String get keycloakUrl =>
      _isRelease ? 'https://auth.chillax.site' : 'http://localhost:8080';
  static const String keycloakRealm = 'chillax';
  static String get identityUrl => '$keycloakUrl/realms/$keycloakRealm';

  // OIDC configuration (Resource Owner Password Credentials, like admin_app)
  static const String clientId = 'pos-app';
  static const String redirectUri = 'com.chillax.pos://callback';
  static const String postLogoutRedirectUri = 'com.chillax.pos://';
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

  // App info
  static const String appName = 'Chillax POS';
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
