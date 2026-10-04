import 'package:flutter/foundation.dart';
import 'package:flutter_appauth/flutter_appauth.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ninja_app_core/auth/auth_service.dart';
import '../config/app_config.dart';

export 'package:ninja_app_core/auth/auth_service.dart';

/// The rider's gate, in the rider app's words: the account holds one of the
/// roles the backend's "Rider" policy accepts (Admin | Owner | Rider)
extension RiderAuthState on AuthState {
  bool get isRider => mayUseApp;
}

/// Provider for the rider gate (Admin | Owner | Rider)
final isRiderProvider = Provider<bool>((ref) => ref.watch(authServiceProvider).isRider);

const FlutterAppAuth _appAuth = FlutterAppAuth();

/// The rider signs in in the system browser: Keycloak's own page,
/// authorization code with PKCE, so the app never sees the password; the
/// tokens then go to the shared session ([AuthService.completeSignIn]).
extension RiderBrowserSignIn on AuthService {
  Future<SignInResult> signInWithBrowser() async {
    try {
      final response = await _appAuth.authorizeAndExchangeCode(
        AuthorizationTokenRequest(
          AppConfig.clientId,
          AppConfig.redirectUri,
          serviceConfiguration: AuthorizationServiceConfiguration(
            authorizationEndpoint: AuthService.authorizationEndpoint,
            tokenEndpoint: AuthService.tokenEndpoint,
            endSessionEndpoint: AuthService.logoutEndpoint,
          ),
          scopes: AppConfig.scopes,
          // The dev AppHost's Keycloak is plain http; a release build talks https only
          allowInsecureConnections: !kReleaseMode,
        ),
      );
      final accessToken = response.accessToken;
      if (accessToken == null) return SignInResult.failed;
      return completeSignIn(accessToken, response.refreshToken, response.idToken);
    } on FlutterAppAuthUserCancelledException {
      return SignInResult.cancelled;
    } catch (e) {
      debugPrint('Auth: browser sign-in failed: $e');
      return SignInResult.failed;
    }
  }
}
