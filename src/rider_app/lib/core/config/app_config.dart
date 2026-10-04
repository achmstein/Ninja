import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ninja_app_core/config.dart';
import 'package:ninja_app_core/tenant_connection.dart';
import '../services/signalr_service.dart';

/// Application configuration for the rider app. Which business it talks to
/// and how it reaches it is the shared core's ([CoreEndpoints]); what is the
/// rider's own is here, and handed to the core as [core] at start:
///
///   flutter run --dart-define=REALM=chillax
///
/// or connect to it like a phone would, at http://localhost:5000.
class AppConfig {
  static const bool _isRelease = bool.fromEnvironment('dart.vm.product');

  /// A build told its stack at build time never asks for one
  static bool get isPinned => CoreEndpoints.isPinned;

  /// The business this device was connected to, when the build is not pinned
  static TenantConnection? get connection => CoreEndpoints.connection;

  /// Whether there is a stack to talk to. Until there is, the connect
  /// screen is the whole app.
  static bool get isConnected => CoreEndpoints.isConnected;

  static String get bffBaseUrl => CoreEndpoints.bffBaseUrl;
  static String get ordersApiUrl => CoreEndpoints.ordersApiUrl;

  /// Push: the rider's phone registers here for the deliveries given to them
  static String get notificationsApiUrl => '${CoreEndpoints.bffBaseUrl}/api/notifications/';
  static String get branchesApiUrl => CoreEndpoints.branchesApiUrl;
  static String get tenantApiUrl => CoreEndpoints.tenantApiUrl;
  static String get identityUrl => CoreEndpoints.identityUrl;

  // OIDC configuration: authorization code with PKCE in the system browser.
  // offline_access on purpose: a rider signs in once at the start of the
  // week, not every shift, so the refresh token must outlive the SSO idle timeout.
  static const String clientId = 'rider-app';

  /// The password form (Resource Owner Password Credentials) instead of the
  /// browser: a debug build only, asked for with
  /// `--dart-define=RIDER_SIGN_IN=password`, for a dev realm whose client has
  /// no browser flow. A release build always signs in in the browser.
  static const bool passwordSignIn = !_isRelease && String.fromEnvironment('RIDER_SIGN_IN') == 'password';

  // The scheme must match the redirect the Android build declares
  // (appAuthRedirectScheme in android/app/build.gradle.kts).
  static const String _redirectScheme =
      String.fromEnvironment('REDIRECT_SCHEME', defaultValue: 'com.ninja.rider');
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

  /// Who may run the rider app — mirrors the backend "Rider" policy: a
  /// rider on their own account, or an admin standing in for one
  static const List<String> riderRoles = ['Admin', 'Owner', 'Rider'];

  // App info (the name comes from the tenant brand)
  static const String appVersion = '1.0.0';

  // Poll fallback (SignalR and push are the primary update paths)
  static const Duration deliveriesPoll = Duration(seconds: 30);

  /// While on duty and the app is in front, the till hears from it this often.
  /// The till only calls a rider stale after a good while longer (Ordering's
  /// RiderGone): a rider out on the road with Maps in front stays on duty.
  static const Duration dutyHeartbeat = Duration(minutes: 5);

  /// How long a network step of signing out may take before the session ends anyway
  static const Duration signOutStepTimeout = Duration(seconds: 5);

  /// A refresh that has failed for this long tells the rider the list may be old
  static const Duration staleAfter = Duration(minutes: 2);

  /// An update installs on its own only this soon after the app opens (nothing is under way yet)
  static const Duration updateQuietWindow = Duration(minutes: 3);

  /// Shorter than this a distance reads in metres, longer in kilometres
  static const int metresUntilKm = 950;

  /// What the shared core needs to know about the rider app
  static final NinjaAppConfig core = NinjaAppConfig(
    appKey: 'rider',
    clientId: clientId,
    scopes: scopes,
    allowedRoles: riderRoles,
    passwordSignIn: passwordSignIn,
    signOutStepTimeout: signOutStepTimeout,
    // Over https only, with its checksum and this app's signing certificate
    // (AppUpdater), and Android's prompt only right after the app opens
    update: const UpdateConfig(
      channel: 'com.ninja.rider/update',
      file: 'ninja-rider',
      quietWindow: updateQuietWindow,
    ),
    onSignedIn: (Ref ref) => unawaited(ref.read(signalRServiceProvider).connect()),
    onSigningOut: (Ref ref) => ref.read(signalRServiceProvider).disconnect(),
  );
}
