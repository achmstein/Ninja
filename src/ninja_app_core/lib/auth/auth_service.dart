import 'dart:async';
import 'dart:convert';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config.dart';

/// Auth state
class AuthState {
  final bool isAuthenticated;

  /// Holds one of the roles the app's backend policy accepts
  /// ([NinjaAppConfig.allowedRoles]): the only gate the app has
  final bool mayUseApp;
  final bool isOwner;
  final bool isInitializing;
  final String? accessToken;
  final String? refreshToken;
  final String? idToken;
  final String? userId;
  final String? email;
  final String? name;
  final List<String> roles;

  /// The branches this account may work in (the `branches` token claim);
  /// the app offers only these
  final List<int> branches;

  const AuthState({
    this.isAuthenticated = false,
    this.mayUseApp = false,
    this.isOwner = false,
    this.isInitializing = true,
    this.accessToken,
    this.refreshToken,
    this.idToken,
    this.userId,
    this.email,
    this.name,
    this.roles = const [],
    this.branches = const [],
  });

  AuthState copyWith({
    bool? isAuthenticated,
    bool? mayUseApp,
    bool? isOwner,
    bool? isInitializing,
    String? accessToken,
    String? refreshToken,
    String? idToken,
    String? userId,
    String? email,
    String? name,
    List<String>? roles,
    List<int>? branches,
  }) {
    return AuthState(
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      mayUseApp: mayUseApp ?? this.mayUseApp,
      isOwner: isOwner ?? this.isOwner,
      isInitializing: isInitializing ?? this.isInitializing,
      accessToken: accessToken ?? this.accessToken,
      refreshToken: refreshToken ?? this.refreshToken,
      idToken: idToken ?? this.idToken,
      userId: userId ?? this.userId,
      email: email ?? this.email,
      name: name ?? this.name,
      roles: roles ?? this.roles,
      branches: branches ?? this.branches,
    );
  }
}

/// Authentication against the business's Keycloak realm. A session starts
/// either from the password form (where the app allows it,
/// [NinjaAppConfig.passwordSignIn]) or from tokens the app obtained itself (the
/// rider app's browser sign-in, [completeSignIn]), and then lives on silent
/// refreshes. Who may stay signed in is [NinjaAppConfig.allowedRoles].
class AuthService extends Notifier<AuthState> {
  final Dio _dio = Dio();
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  /// The refresh under way: a poll, a heartbeat, a push and a resume may all
  /// find the token expired at once, and must share one refresh
  Future<bool>? _refreshing;

  static const _accessTokenKey = 'access_token';
  static const _refreshTokenKey = 'refresh_token';
  static const _idTokenKey = 'id_token';

  static NinjaAppConfig get _config => NinjaCore.config;

  /// Where a browser sign-in starts
  static String get authorizationEndpoint => '${CoreEndpoints.identityUrl}/protocol/openid-connect/auth';

  static String get tokenEndpoint => '${CoreEndpoints.identityUrl}/protocol/openid-connect/token';

  static String get logoutEndpoint => '${CoreEndpoints.identityUrl}/protocol/openid-connect/logout';

  @override
  AuthState build() => const AuthState();

  /// Initialize auth state from stored tokens
  Future<void> initialize() async {
    try {
      final accessToken = await _storage.read(key: _accessTokenKey);
      final refreshTokenValue = await _storage.read(key: _refreshTokenKey);
      final idToken = await _storage.read(key: _idTokenKey);

      if (accessToken != null && refreshTokenValue != null) {
        // Parse stored token to get user info
        final claims = _parseJwt(accessToken);
        final roles = _extractRoles(claims);

        // Set initial state from stored tokens
        state = state.copyWith(
          accessToken: accessToken,
          refreshToken: refreshTokenValue,
          idToken: idToken,
          isAuthenticated: true,
          mayUseApp: _mayUseApp(roles),
          isOwner: roles.contains('Owner'),
          userId: claims['sub'] as String?,
          email: claims['email'] as String?,
          name: claims['name'] as String?,
          roles: roles,
          branches: extractBranches(claims),
        );

        // Try to refresh tokens in background
        final refreshed = await refreshToken();
        if (refreshed) {
          state = state.copyWith(isInitializing: false);
          return;
        }

        // Refresh failed - check if tokens were cleared (auth error) or preserved (network error)
        if (state.accessToken != null) {
          // Tokens preserved (network error) - use existing tokens
          debugPrint('Auth: Using existing tokens (refresh failed, likely network issue)');
          state = state.copyWith(isInitializing: false);
          return;
        }
      }

      // No valid tokens or tokens were cleared due to auth error
      state = state.copyWith(isInitializing: false, isAuthenticated: false, mayUseApp: false, isOwner: false);
    } catch (e) {
      debugPrint('Initialize error: $e');
      state = state.copyWith(isInitializing: false, isAuthenticated: false, mayUseApp: false, isOwner: false);
    }
  }

  /// The tokens are in, however they were obtained: someone the app is for
  /// stays, anyone else is signed out again
  Future<SignInResult> completeSignIn(String accessToken, String? refreshToken, String? idToken) async {
    await _saveTokens(accessToken: accessToken, refreshToken: refreshToken, idToken: idToken);
    if (!state.mayUseApp) {
      await signOut();
      return SignInResult.notAuthorized;
    }
    _config.onSignedIn?.call(ref);
    return SignInResult.success;
  }

  /// Sign in with username and password (Resource Owner Password Credentials),
  /// where the app allows it
  Future<SignInResult> signIn(String username, String password) async {
    if (!_config.passwordSignIn) return SignInResult.failed;
    try {
      final response = await _dio.post<Map<String, dynamic>>(
        tokenEndpoint,
        data: {
          'grant_type': 'password',
          'client_id': _config.clientId,
          'username': username,
          'password': password,
          'scope': _config.scopes.join(' '),
        },
        options: Options(contentType: Headers.formUrlEncodedContentType),
      );

      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        return completeSignIn(data['access_token'] as String, data['refresh_token'] as String?, data['id_token'] as String?);
      }
      return SignInResult.failed;
    } on DioException catch (e) {
      debugPrint('Auth: DioException - Status: ${e.response?.statusCode}');
      return SignInResult.failed;
    } catch (e) {
      debugPrint('Auth: Exception: $e');
      return SignInResult.failed;
    }
  }

  /// Sign out: the session's own things close first, then Keycloak hears it
  /// (the offline session ends there too), and the tokens go whatever happens
  Future<void> signOut() async {
    try {
      await _config.onSigningOut?.call(ref);

      if (state.refreshToken != null) {
        final logout = _dio.post<void>(
          logoutEndpoint,
          data: {'client_id': _config.clientId, 'refresh_token': state.refreshToken},
          options: Options(contentType: Headers.formUrlEncodedContentType),
        );
        final timeout = _config.signOutStepTimeout;
        await (timeout == null ? logout : logout.timeout(timeout));
      }
    } catch (e) {
      // Ignore errors during sign out
    } finally {
      await _clearTokens();
    }
  }

  /// Refresh the access token; callers at the same moment share the one refresh
  Future<bool> refreshToken() => _refreshing ??= _refresh().whenComplete(() => _refreshing = null);

  Future<bool> _refresh() async {
    if (state.refreshToken == null) return false;

    try {
      final response = await _dio.post<Map<String, dynamic>>(
        tokenEndpoint,
        data: {
          'grant_type': 'refresh_token',
          'client_id': _config.clientId,
          'refresh_token': state.refreshToken,
        },
        options: Options(contentType: Headers.formUrlEncodedContentType),
      );

      if (response.statusCode == 200) {
        final data = response.data as Map<String, dynamic>;
        await _saveTokens(
          accessToken: data['access_token'] as String,
          refreshToken: data['refresh_token'] as String?,
          idToken: data['id_token'] as String?,
        );
        return true;
      }
      return false;
    } on DioException catch (e) {
      debugPrint('Token refresh error: ${e.response?.data ?? e.message}');
      // Only clear tokens if server explicitly rejected them (auth errors).
      // Don't clear on network errors - the business's internet may just be down
      final statusCode = e.response?.statusCode;
      if (statusCode == 400 || statusCode == 401) {
        await _clearTokens();
      }
      return false;
    } catch (e) {
      debugPrint('Token refresh error: $e');
      // Don't clear tokens on unknown errors - preserve session
      return false;
    }
  }

  /// Get current access token
  Future<String?> getAccessToken() async => state.accessToken;

  Future<void> _saveTokens({required String accessToken, String? refreshToken, String? idToken}) async {
    await _storage.write(key: _accessTokenKey, value: accessToken);
    if (refreshToken != null) {
      await _storage.write(key: _refreshTokenKey, value: refreshToken);
    }
    if (idToken != null) {
      await _storage.write(key: _idTokenKey, value: idToken);
    }

    final claims = _parseJwt(accessToken);
    final roles = _extractRoles(claims);

    state = state.copyWith(
      isAuthenticated: true,
      mayUseApp: _mayUseApp(roles),
      isOwner: roles.contains('Owner'),
      accessToken: accessToken,
      refreshToken: refreshToken ?? state.refreshToken,
      idToken: idToken ?? state.idToken,
      userId: claims['sub'] as String?,
      email: claims['email'] as String?,
      name: claims['name'] as String?,
      roles: roles,
      branches: extractBranches(claims),
    );
  }

  Future<void> _clearTokens() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
    await _storage.delete(key: _idTokenKey);

    // Set isInitializing to false so router redirects to login instead of staying on splash
    state = const AuthState(isInitializing: false);
  }

  static bool _mayUseApp(List<String> roles) => _config.allowedRoles.any(roles.contains);

  /// Branch ids from the multivalued `branches` claim (strings, from the
  /// Keycloak attribute mapper). An absent claim is no branch, never "all".
  @visibleForTesting
  static List<int> extractBranches(Map<String, dynamic> claims) {
    final raw = claims['branches'];
    final List<Object?> values = raw is List ? raw : raw == null ? const <Object>[] : <Object>[raw as Object];
    return values.map((v) => int.tryParse(v.toString())).whereType<int>().toSet().toList()..sort();
  }

  Map<String, dynamic> _parseJwt(String token) {
    final parts = token.split('.');
    if (parts.length != 3) return {};

    final payload = parts[1];
    final normalized = base64Url.normalize(payload);
    final decoded = utf8.decode(base64Url.decode(normalized));
    return json.decode(decoded) as Map<String, dynamic>;
  }

  List<String> _extractRoles(Map<String, dynamic> claims) {
    final roles = <String>[];

    // Try 'role' claim (flat roles from Keycloak mapper)
    if (claims['role'] != null) {
      if (claims['role'] is List) {
        roles.addAll((claims['role'] as List).cast<String>());
      } else if (claims['role'] is String) {
        roles.add(claims['role'] as String);
      }
    }

    // Try 'roles' claim (plural)
    if (claims['roles'] != null) {
      if (claims['roles'] is List) {
        roles.addAll((claims['roles'] as List).cast<String>());
      } else if (claims['roles'] is String) {
        roles.add(claims['roles'] as String);
      }
    }

    // Try 'realm_access.roles' claim
    if (claims['realm_access'] != null) {
      final realmAccess = claims['realm_access'] as Map<String, dynamic>;
      if (realmAccess['roles'] != null) {
        roles.addAll((realmAccess['roles'] as List).cast<String>());
      }
    }

    return roles.toSet().toList();
  }
}

/// Sign in result
enum SignInResult {
  success,
  failed,
  notAuthorized,

  /// The browser was closed before signing in
  cancelled,
}

/// Provider for auth service
final authServiceProvider = NotifierProvider<AuthService, AuthState>(AuthService.new);

/// Provider for auth state
final isAuthenticatedProvider = Provider<bool>((ref) {
  return ref.watch(authServiceProvider).isAuthenticated;
});

/// Provider for the app's gate ([NinjaAppConfig.allowedRoles])
final mayUseAppProvider = Provider<bool>((ref) {
  return ref.watch(authServiceProvider).mayUseApp;
});

/// Provider for owner check
final isOwnerProvider = Provider<bool>((ref) {
  return ref.watch(authServiceProvider).isOwner;
});
