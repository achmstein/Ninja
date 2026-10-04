import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ninja_app_core/config.dart';
import 'package:ninja_app_core/tenant_connection.dart';
import '../demo/demo.dart';
import '../services/signalr_service.dart';

/// Application configuration for the kitchen display tablet app. Which
/// business it talks to and how it reaches it is the shared core's
/// ([CoreEndpoints]); what is the kitchen's own is here, and handed to the
/// core as [core] at start:
///
///   flutter run --dart-define=REALM=chillax
///
/// or connect to it like a tablet would, at http://localhost:5000.
class AppConfig {
  /// A build told its stack at build time never asks for one
  static bool get isPinned => CoreEndpoints.isPinned;

  /// The business this device was connected to, when the build is not pinned
  static TenantConnection? get connection => CoreEndpoints.connection;

  /// Whether there is a stack to talk to. Until there is, the connect
  /// screen is the whole app.
  static bool get isConnected => CoreEndpoints.isConnected;

  static String get bffBaseUrl => CoreEndpoints.bffBaseUrl;
  static String get ordersApiUrl => CoreEndpoints.ordersApiUrl;
  static String get kitchenApiUrl => '${CoreEndpoints.bffBaseUrl}/api/kitchen/';
  static String get branchesApiUrl => CoreEndpoints.branchesApiUrl;
  static String get tenantApiUrl => CoreEndpoints.tenantApiUrl;
  static String get identityUrl => CoreEndpoints.identityUrl;

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

  /// Who may run the kitchen display — mirrors the backend "Pos" policy, the
  /// same gate kds_web applies: the till's staff, or its own Kitchen account
  static const List<String> posRoles = ['Admin', 'Owner', 'Cashier', 'Kitchen'];

  // App info (the name comes from the tenant brand)
  static const String appVersion = '1.0.0';

  // Poll fallback, mirroring kds_web (SignalR is the primary update path)
  static const Duration kitchenPoll = Duration(seconds: 20);

  /// What the shared core needs to know about the kitchen display
  static final NinjaAppConfig core = NinjaAppConfig(
    appKey: 'kds',
    clientId: clientId,
    scopes: scopes,
    allowedRoles: posRoles,
    // A wall-mounted tablet signs in with a staff username and password
    passwordSignIn: true,
    // As it always has: the download page wherever the stack says, its
    // checksum when the release gives one, and overnight silently on a
    // kiosk tablet (device owner). Never in the design-time demo.
    update: const UpdateConfig(
      channel: 'com.ninja.kds/update',
      file: 'ninja-kds',
      enabled: !kDemoMode,
      requireChecksum: false,
      httpsOnly: false,
      silentKioskInstall: true,
    ),
    onSignedIn: (Ref ref) => unawaited(ref.read(signalRServiceProvider).connect()),
    onSigningOut: (Ref ref) => ref.read(signalRServiceProvider).disconnect(),
  );
}
