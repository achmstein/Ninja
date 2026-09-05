import 'dart:async';
import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../config/app_config.dart';
import '../services/signalr_service.dart';

/// Authentication state
class AuthState {
  final bool isInitializing;
  final bool isAuthenticated;

  /// Holds one of the roles the backend's "Pos" policy accepts
  /// (Admin | Owner | Cashier) — the only gate the till has.
  final bool isPosUser;
  final bool isOwner;
  final String? accessToken;
  final String? refreshToken;
  final String? idToken;
  final String? userId;
  final String? email;
  final String? name;
  final List<String> roles;

  const AuthState({
    this.isInitializing = true,
    this.isAuthenticated = false,
    this.isPosUser = false,
    this.isOwner = false,
    this.accessToken,
    this.refreshToken,
    this.idToken,
    this.userId,
    this.email,
    this.name,
    this.roles = const [],
  });

  AuthState copyWith({
    bool? isInitializing,
    bool? isAuthenticated,
    bool? isPosUser,
    bool? isOwner,
    String? accessToken,
    String? refreshToken,
    String? idToken,
    String? userId,
    String? email,
    String? name,
    List<String>? roles,
  }) {
    return AuthState(
      isInitializing: isInitializing ?? this.isInitializing,
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      isPosUser: isPosUser ?? this.isPosUser,
      isOwner: isOwner ?? this.isOwner,
      accessToken: accessToken ?? this.accessToken,
      refreshToken: refreshToken ?? this.refreshToken,
      idToken: idToken ?? this.idToken,
      userId: userId ?? this.userId,
      email: email ?? this.email,
      name: name ?? this.name,
      roles: roles ?? this.roles,
    );
  }
}

/// Authentication service using Keycloak's Resource Owner Password
/// Credentials grant — a till signs in with a staff username and password
/// once and then lives on silent refreshes.
class AuthService extends Notifier<AuthState> {
  final Dio _dio = Dio();
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  static const _accessTokenKey = 'access_token';
  static const _refreshTokenKey = 'refresh_token';
  static const _idTokenKey = 'id_token';

  /// Token endpoint URL
  String get _tokenEndpoint => '${AppConfig.identityUrl}/protocol/openid-connect/token';

  /// Logout endpoint URL
  String get _logoutEndpoint => '${AppConfig.identityUrl}/protocol/openid-connect/logout';

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
          isPosUser: _isPosUser(roles),
          isOwner: roles.contains('Owner'),
          userId: claims['sub'] as String?,
          email: claims['email'] as String?,
          name: claims['name'] as String?,
          roles: roles,
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
      state = state.copyWith(
        isInitializing: false,
        isAuthenticated: false,
        isPosUser: false,
        isOwner: false,
      );
    } catch (e) {
      debugPrint('Initialize error: $e');
      state = state.copyWith(
        isInitializing: false,
        isAuthenticated: false,
        isPosUser: false,
        isOwner: false,
      );
    }
  }

  /// Sign in with username and password using Resource Owner Password Credentials grant
  Future<SignInResult> signIn(String username, String password) async {
    try {
      final response = await _dio.post(
        _tokenEndpoint,
        data: {
          'grant_type': 'password',
          'client_id': AppConfig.clientId,
          'username': username,
          'password': password,
          'scope': AppConfig.scopes.join(' '),
        },
        options: Options(
          contentType: Headers.formUrlEncodedContentType,
        ),
      );

      if (response.statusCode == 200) {
        final data = response.data;
        await _saveTokens(
          accessToken: data['access_token'],
          refreshToken: data['refresh_token'],
          idToken: data['id_token'],
        );

        // A customer account signs in fine at Keycloak; it just may not run
        // a till. Mirrors the backend "Pos" policy exactly.
        if (!state.isPosUser) {
          await signOut();
          return SignInResult.notAuthorized;
        }

        // Connect SignalR for realtime updates
        ref.read(signalRServiceProvider).connect();

        return SignInResult.success;
      }
      debugPrint('Auth: Unexpected status code: ${response.statusCode}');
      return SignInResult.failed;
    } on DioException catch (e) {
      debugPrint('Auth: DioException - Status: ${e.response?.statusCode}');
      return SignInResult.failed;
    } catch (e) {
      debugPrint('Auth: Exception: $e');
      return SignInResult.failed;
    }
  }

  /// Sign out
  Future<void> signOut() async {
    try {
      // Disconnect SignalR
      await ref.read(signalRServiceProvider).disconnect();

      if (state.refreshToken != null) {
        await _dio.post(
          _logoutEndpoint,
          data: {
            'client_id': AppConfig.clientId,
            'refresh_token': state.refreshToken,
          },
          options: Options(
            contentType: Headers.formUrlEncodedContentType,
          ),
        );
      }
    } catch (e) {
      // Ignore errors during sign out
    } finally {
      await _clearTokens();
    }
  }

  /// Refresh access token
  Future<bool> refreshToken() async {
    if (state.refreshToken == null) return false;

    try {
      final response = await _dio.post(
        _tokenEndpoint,
        data: {
          'grant_type': 'refresh_token',
          'client_id': AppConfig.clientId,
          'refresh_token': state.refreshToken,
        },
        options: Options(
          contentType: Headers.formUrlEncodedContentType,
        ),
      );

      if (response.statusCode == 200) {
        final data = response.data;
        await _saveTokens(
          accessToken: data['access_token'],
          refreshToken: data['refresh_token'],
          idToken: data['id_token'],
        );
        return true;
      }
      return false;
    } on DioException catch (e) {
      debugPrint('Token refresh error: ${e.response?.data ?? e.message}');
      // Only clear tokens if server explicitly rejected them (auth errors)
      // Don't clear on network errors - the café's internet may just be down
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
  Future<String?> getAccessToken() async {
    return state.accessToken;
  }

  Future<void> _saveTokens({
    required String accessToken,
    String? refreshToken,
    String? idToken,
  }) async {
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
      isPosUser: _isPosUser(roles),
      isOwner: roles.contains('Owner'),
      accessToken: accessToken,
      refreshToken: refreshToken ?? state.refreshToken,
      idToken: idToken ?? state.idToken,
      userId: claims['sub'] as String?,
      email: claims['email'] as String?,
      name: claims['name'] as String?,
      roles: roles,
    );
  }

  Future<void> _clearTokens() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
    await _storage.delete(key: _idTokenKey);

    // Set isInitializing to false so router redirects to login instead of staying on splash
    state = const AuthState(isInitializing: false);
  }

  static bool _isPosUser(List<String> roles) =>
      AppConfig.posRoles.any(roles.contains);

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
}

/// Provider for auth service
final authServiceProvider = NotifierProvider<AuthService, AuthState>(AuthService.new);

/// Provider for auth state
final isAuthenticatedProvider = Provider<bool>((ref) {
  return ref.watch(authServiceProvider).isAuthenticated;
});

/// Provider for the till gate (Admin | Owner | Cashier)
final isPosUserProvider = Provider<bool>((ref) {
  return ref.watch(authServiceProvider).isPosUser;
});

/// Provider for owner check
final isOwnerProvider = Provider<bool>((ref) {
  return ref.watch(authServiceProvider).isOwner;
});
