import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'tenant_connection.dart';

/// What one app tells the shared core about itself: which Keycloak client it
/// signs in as, who may use it, where it keeps its choices on the device, how
/// it updates itself, and what happens when someone signs in or out. Set once
/// in `main()` with [NinjaCore.configure], before anything else runs.
class NinjaAppConfig {
  /// Short name the app's on-device keys start with (`rider`, `kds`), so two
  /// apps on one device never read each other's branch or theme
  final String appKey;

  /// The Keycloak client this app signs in as
  final String clientId;

  /// What the token asks for (offline_access: a device signs in once and
  /// lives on silent refreshes)
  final List<String> scopes;

  /// Realm roles that may use the app, mirroring the backend policy its API
  /// calls need; anyone else is signed out again straight away
  final List<String> allowedRoles;

  /// Whether the password form (Resource Owner Password Credentials) may be
  /// used. The kitchen display signs in that way; the rider app signs in in
  /// the system browser and allows it only in a debug build.
  final bool passwordSignIn;

  /// How long a network step of signing out may take before the session ends
  /// anyway; null waits as long as the request does
  final Duration? signOutStepTimeout;

  /// The self-update this app gets from the platform's download page
  final UpdateConfig update;

  /// Someone may use the app now (signed in, or a stored session restored)
  final void Function(Ref ref)? onSignedIn;

  /// The session is ending: close what belongs to it (the realtime hub)
  final Future<void> Function(Ref ref)? onSigningOut;

  const NinjaAppConfig({
    required this.appKey,
    required this.clientId,
    required this.scopes,
    required this.allowedRoles,
    required this.update,
    this.passwordSignIn = true,
    this.signOutStepTimeout,
    this.onSignedIn,
    this.onSigningOut,
  });
}

/// How an app keeps itself on the newest build of the platform's download page
class UpdateConfig {
  /// The platform channel the app's Android side answers (AppUpdater)
  final String channel;

  /// The release's name on the download page: `<file>.json` and `<file>.apk`
  final String file;

  /// False where updates make no sense (a demo build)
  final bool enabled;

  /// Only a release that publishes its checksum is taken
  final bool requireChecksum;

  /// The download page and the APK are fetched over https only
  final bool httpsOnly;

  /// A kiosk tablet (device owner) may install silently in the small hours
  final bool silentKioskInstall;

  /// An update installs on its own only this soon after the app opens
  final Duration quietWindow;

  const UpdateConfig({
    required this.channel,
    required this.file,
    this.enabled = true,
    this.requireChecksum = true,
    this.httpsOnly = true,
    this.silentKioskInstall = false,
    this.quietWindow = const Duration(minutes: 3),
  });
}

/// The shared core's view of the app it runs in
class NinjaCore {
  static NinjaAppConfig? _config;

  /// The app's configuration; [configure] must have been called
  static NinjaAppConfig get config =>
      _config ?? (throw StateError('NinjaCore.configure was not called in main()'));

  static void configure(NinjaAppConfig config) => _config = config;
}

/// Where the business this device serves is reached. Which business is data,
/// not code: one generic build goes to every business from the platform's
/// download page; the first time it opens it asks for the business's address
/// and keeps the [TenantConnection] it finds on the device. A build can still
/// be pinned to one stack (`--dart-define-from-file tenants/<slug>.json`), and
/// a debug build reaches the Aspire AppHost on the dev machine when told the
/// realm alone (`--dart-define=REALM=chillax`).
class CoreEndpoints {
  static const bool _isRelease = bool.fromEnvironment('dart.vm.product');

  static const String _apiUrl = String.fromEnvironment('API_URL');
  static const String _authUrl = String.fromEnvironment('AUTH_URL');
  static const String _realm = String.fromEnvironment('REALM');

  /// A build told its stack at build time never asks for one
  static bool get isPinned => _apiUrl.isNotEmpty;

  /// The business this device was connected to, when the build is not pinned
  static TenantConnection? get connection => TenantConnection.current.value;

  /// Whether there is a stack to talk to. Until there is, the connect screen
  /// is the whole app.
  static bool get isConnected => isPinned || connection != null || (!_isRelease && _realm.isNotEmpty);

  // Everything goes through the mobile BFF (YARP).
  // Debug: the Aspire AppHost on the dev machine, reached from the emulator
  //   through `adb reverse tcp:5000 tcp:5000` and `adb reverse tcp:8080 tcp:8080`
  //   (localhost on both sides keeps Keycloak's token issuer matching).
  static String get bffBaseUrl {
    if (_apiUrl.isNotEmpty) return _apiUrl;
    if (connection case final connection?) return connection.apiUrl;
    if (!_isRelease) return 'http://localhost:5000';
    throw StateError('Not connected to a business: the connect screen comes first');
  }

  // Trailing slash required for Dio path resolution
  static String get ordersApiUrl => '$bffBaseUrl/api/orders/';
  static String get branchesApiUrl => '$bffBaseUrl/api/branches/';

  /// The tenant's brand: one anonymous resource, no sub-paths
  static String get tenantApiUrl => '$bffBaseUrl/api/tenant';

  /// The OpenID issuer to sign in against: the realm a pinned build was given,
  /// else the one the business's API named when this device connected (its own
  /// realm on the platform's auth host), else the AppHost's Keycloak through
  /// adb reverse in debug. Never a default realm: the app signs in against the
  /// business's, or against none.
  static String get identityUrl {
    if (_authUrl.isNotEmpty && _realm.isNotEmpty) return '$_authUrl/realms/$_realm';
    if (connection?.authority case final authority?) return authority;
    if (!_isRelease && _realm.isNotEmpty) return 'http://localhost:8080/realms/$_realm';
    throw StateError('No realm to sign in against: the business\'s API did not name one');
  }
}
