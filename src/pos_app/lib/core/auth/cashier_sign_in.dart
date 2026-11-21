import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import '../config/app_config.dart';
import 'auth_service.dart';

/// How a PIN sign-in ended
enum PinSignIn {
  success,

  /// The PIN is not the account's
  wrong,

  /// No PIN to use right now: the account has none, or too many wrong
  /// tries were made and the password is asked for again
  unavailable,

  /// Signed in, but the account may not run the till
  notAuthorized,

  /// The server could not be reached, or said something else
  failed,
}

/// How choosing a PIN ended
enum PinChoice { saved, wrongPassword, format, guessable, failed }

/// Taking over the till by name and PIN, on the till's own pad. The PIN goes
/// where the password goes when the till signs in: straight to Keycloak's
/// token endpoint, which checks it against the hash it keeps, counts wrong
/// tries and answers with its ordinary tokens (src/keycloak-pin,
/// PinDirectGrant). The till keeps nothing of it.
extension CashierSignIn on AuthService {
  Future<PinSignIn> signInWithPin(String username, String pin) async {
    final answer = await _grant({'username': username, 'pin': pin});
    final tokens = answer.tokens;
    if (tokens == null) {
      return switch (answer.problem) {
        'pin_wrong' => PinSignIn.wrong,
        'pin_unavailable' => PinSignIn.unavailable,
        _ => PinSignIn.failed,
      };
    }
    final result = await completeSignIn(
      tokens['access_token'] as String,
      tokens['refresh_token'] as String?,
      tokens['id_token'] as String?,
    );
    return switch (result) {
      SignInResult.success => PinSignIn.success,
      SignInResult.notAuthorized => PinSignIn.notAuthorized,
      _ => PinSignIn.failed,
    };
  }

  /// Sets the signed-in person's PIN. Keycloak takes a new PIN only in a
  /// request that proves the password, so the password is asked for here;
  /// the session that request opens is closed again at once, and the one
  /// the till is running on carries on.
  Future<PinChoice> chooseMyPin(String password, String pin) async {
    final username = signedInEmail;
    if (username == null) return PinChoice.failed;
    final answer = await _grant({'username': username, 'password': password, 'new_pin': pin});
    final tokens = answer.tokens;
    if (tokens == null) {
      return switch (answer.problem) {
        'pin_format' => PinChoice.format,
        'pin_guessable' => PinChoice.guessable,
        // Keycloak's own words for a wrong password
        _ when answer.status == 401 => PinChoice.wrongPassword,
        _ => PinChoice.failed,
      };
    }
    final refreshToken = tokens['refresh_token'] as String?;
    if (refreshToken != null) {
      try {
        await _http.post<void>(
          AuthService.logoutEndpoint,
          data: {'client_id': AppConfig.clientId, 'refresh_token': refreshToken},
          options: Options(contentType: Headers.formUrlEncodedContentType),
        );
      } catch (_) {
        // The spare session ends by itself when it is not refreshed
      }
    }
    return PinChoice.saved;
  }
}

final Dio _http = Dio(BaseOptions(connectTimeout: const Duration(seconds: 15), receiveTimeout: const Duration(seconds: 15)));

typedef _Answer = ({Map<String, dynamic>? tokens, String? problem, int? status});

/// One request to the token endpoint, as the password sign-in makes it
Future<_Answer> _grant(Map<String, String> fields) async {
  try {
    final response = await _http.post<Map<String, dynamic>>(
      AuthService.tokenEndpoint,
      data: {
        'grant_type': 'password',
        'client_id': AppConfig.clientId,
        'scope': AppConfig.scopes.join(' '),
        ...fields,
      },
      options: Options(contentType: Headers.formUrlEncodedContentType),
    );
    final data = response.data;
    if (response.statusCode == 200 && data?['access_token'] is String) {
      return (tokens: data, problem: null, status: 200);
    }
    return (tokens: null, problem: null, status: response.statusCode);
  } on DioException catch (e) {
    final body = e.response?.data;
    return (
      tokens: null,
      problem: body is Map ? body['error_description'] as String? : null,
      status: e.response?.statusCode,
    );
  } catch (e) {
    debugPrint('Auth: PIN request failed: $e');
    return (tokens: null, problem: null, status: null);
  }
}

/// Whether what was typed can be a PIN at all: 4 to 6 digits
bool looksLikePin(String value) => RegExp(r'^\d{4,6}$').hasMatch(value);
