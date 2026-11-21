import 'package:flutter/foundation.dart';
import 'package:flutter_appauth/flutter_appauth.dart';

import '../config/app_config.dart';
import 'auth_service.dart';

const FlutterAppAuth _appAuth = FlutterAppAuth();

/// The action in which someone chooses their till PIN (Keycloak's name for
/// it; src/keycloak-pin)
const String _configurePinAction = 'ninja-configure-pin';

/// Taking over the till by name. The cashier taps their name and Keycloak's
/// own page, in the system browser, asks for their PIN (or their password
/// when they have none): authorization code with PKCE, so neither ever
/// passes through the app, and the PIN is checked where passwords are. The
/// tokens then go to the shared session ([AuthService.completeSignIn]), as
/// the password sign-in's do.
extension CashierSignIn on AuthService {
  /// Signs [username] in. Anyone else who comes back signed in (the browser
  /// still held their session) is signed out again: the till is never handed
  /// to a name that was not tapped.
  Future<SignInResult> signInAs(String username) async {
    final result = await _authorize(loginHint: username, promptValues: const ['login']);
    if (result != SignInResult.success) return result;
    if (!isSameAccount(username, signedInEmail)) {
      await signOut();
      return SignInResult.failed;
    }
    return result;
  }

  /// Opens the page where the signed-in person chooses their PIN, after
  /// Keycloak has asked for their password. They stay signed in either way.
  Future<SignInResult> chooseMyPin() => _authorize(
        loginHint: signedInEmail,
        additionalParameters: const {'kc_action': _configurePinAction},
      );

  Future<SignInResult> _authorize({
    String? loginHint,
    List<String>? promptValues,
    Map<String, String>? additionalParameters,
  }) async {
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
          loginHint: loginHint,
          promptValues: promptValues,
          additionalParameters: additionalParameters,
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

/// Whether the account that came back is the one that was asked for
bool isSameAccount(String wanted, String? signedIn) =>
    signedIn != null && signedIn.trim().toLowerCase() == wanted.trim().toLowerCase();
