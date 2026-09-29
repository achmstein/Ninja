import 'dart:convert';
import 'dart:math';

import 'package:crypto/crypto.dart';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:google_sign_in/google_sign_in.dart';
import 'package:sign_in_with_apple/sign_in_with_apple.dart';
import '../config/app_config.dart';
import '../services/signalr_service.dart';

/// Supported social login providers
enum SocialProvider { google, apple }

/// Authentication state
class AuthState {
  final bool isInitializing;
  final bool isAuthenticated;
  final bool isSocialLogin;
  final String? accessToken;
  final String? refreshToken;
  final String? idToken;
  final String? userId;
  final String? email;
  final String? name;

  /// The name as Keycloak keeps it, once the profile has been read; null
  /// until then (the token's [name] is the whole of it)
  final String? firstName;
  final String? lastName;
  final String? phoneNumber;

  const AuthState({
    this.isInitializing = true,
    this.isAuthenticated = false,
    this.isSocialLogin = false,
    this.accessToken,
    this.refreshToken,
    this.idToken,
    this.userId,
    this.email,
    this.name,
    this.firstName,
    this.lastName,
    this.phoneNumber,
  });

  /// First and last name to fill a form with: as read from the profile, or
  /// the token's whole name split at its first space until it has been
  (String, String) get nameParts {
    if (firstName != null || lastName != null) return (firstName ?? '', lastName ?? '');
    final whole = hasName ? name!.trim() : '';
    final space = whole.indexOf(' ');
    return space < 0 ? (whole, '') : (whole.substring(0, space), whole.substring(space + 1).trim());
  }

  /// Whether the user has a whole name: once the profile has been read, a first
  /// and a last name both (an Apple account comes with none, or half of one);
  /// until then the token's whole name, never an address
  bool get hasName {
    if (firstName != null || lastName != null) {
      return (firstName?.trim().isNotEmpty ?? false) && (lastName?.trim().isNotEmpty ?? false);
    }
    return name != null && name!.isNotEmpty && !name!.contains('@');
  }

  /// Whether the user has a phone number
  bool get hasPhone => phoneNumber != null && phoneNumber!.isNotEmpty;

  /// Whether the profile is complete (has name + phone)
  bool get isProfileComplete => hasName && hasPhone;

  AuthState copyWith({
    bool? isInitializing,
    bool? isAuthenticated,
    bool? isSocialLogin,
    String? accessToken,
    String? refreshToken,
    String? idToken,
    String? userId,
    String? email,
    String? name,
    String? firstName,
    String? lastName,
    String? phoneNumber,
  }) {
    return AuthState(
      isInitializing: isInitializing ?? this.isInitializing,
      isAuthenticated: isAuthenticated ?? this.isAuthenticated,
      isSocialLogin: isSocialLogin ?? this.isSocialLogin,
      accessToken: accessToken ?? this.accessToken,
      refreshToken: refreshToken ?? this.refreshToken,
      idToken: idToken ?? this.idToken,
      userId: userId ?? this.userId,
      email: email ?? this.email,
      name: name ?? this.name,
      firstName: firstName ?? this.firstName,
      lastName: lastName ?? this.lastName,
      phoneNumber: phoneNumber ?? this.phoneNumber,
    );
  }
}

/// Authentication service using native OIDC with Resource Owner Password Credentials
/// and native social login SDKs (Google Sign-In, Apple Sign In)
class AuthService extends Notifier<AuthState> {
  final Dio _dio = Dio(BaseOptions(
    connectTimeout: const Duration(seconds: 10),
    receiveTimeout: const Duration(seconds: 10),
  ));
  final FlutterSecureStorage _storage = const FlutterSecureStorage();

  // Native social login SDKs
  final GoogleSignIn _googleSignIn = GoogleSignIn.instance;
  bool _googleSignInInitialized = false;

  /// The name Apple gives on the first sign-in only, sent on once the account is made.
  /// Kept in storage until the backend has it: Apple never gives it again, so a failed
  /// send is retried when the profile is next read rather than lost
  static const _pendingAppleFirstKey = 'pending_apple_first';
  static const _pendingAppleLastKey = 'pending_apple_last';

  static const _accessTokenKey = 'access_token';
  static const _refreshTokenKey = 'refresh_token';
  static const _idTokenKey = 'id_token';
  static const _isSocialLoginKey = 'is_social_login';
  static const _nameKey = 'profile_name';
  static const _phoneKey = 'profile_phone';

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
      final refreshToken = await _storage.read(key: _refreshTokenKey);
      final idToken = await _storage.read(key: _idTokenKey);

      debugPrint('Auth init - has access token: ${accessToken != null}');
      debugPrint('Auth init - has refresh token: ${refreshToken != null}');

      if (accessToken != null && refreshToken != null) {
        // Try to refresh the token to validate it's still valid
        state = state.copyWith(
          accessToken: accessToken,
          refreshToken: refreshToken,
          idToken: idToken,
        );

        // Restore cached profile immediately so it's available offline
        final cachedName = await _storage.read(key: _nameKey);
        final cachedPhone = await _storage.read(key: _phoneKey);

        final refreshed = await this.refreshToken();
        debugPrint('Auth init - token refresh result: $refreshed');
        if (refreshed) {
          final isSocial = await _storage.read(key: _isSocialLoginKey);
          state = state.copyWith(
            isInitializing: false,
            isAuthenticated: true,
            isSocialLogin: isSocial == 'true',
            name: cachedName,
            phoneNumber: cachedPhone,
          );

          // Load fresh profile in background (will update cache)
          _loadProfile();

          return;
        }

        // Refresh failed — check if tokens were cleared (server rejected them)
        // or if it was just a network error (tokens still in storage)
        final tokensStillExist = await _storage.read(key: _accessTokenKey) != null;
        if (tokensStillExist) {
          // Network error — keep user authenticated with existing tokens
          debugPrint('Auth init - refresh failed (network), staying authenticated');
          final isSocial = await _storage.read(key: _isSocialLoginKey);
          state = state.copyWith(
            isInitializing: false,
            isAuthenticated: true,
            isSocialLogin: isSocial == 'true',
            name: cachedName,
            phoneNumber: cachedPhone,
          );

          _loadProfile();
          return;
        }
      }

      // No valid tokens found
      debugPrint('Auth init - no valid tokens, user needs to login');
      state = state.copyWith(
        isInitializing: false,
        isAuthenticated: false,
      );
    } catch (e) {
      debugPrint('Auth initialization error: $e');
      state = state.copyWith(
        isInitializing: false,
        isAuthenticated: false,
      );
    }
  }

  /// The name Apple gave on a first sign-in, to the backend; kept for another try if it
  /// does not get there. Only ever fills a name: one already on the account is left as it is.
  Future<void> _sendPendingAppleName({String? currentFirst, String? currentLast}) async {
    final first = (await _storage.read(key: _pendingAppleFirstKey))?.trim() ?? '';
    final last = (await _storage.read(key: _pendingAppleLastKey))?.trim() ?? '';
    if (first.isEmpty && last.isEmpty) return;
    final data = {
      'firstName': (currentFirst?.isNotEmpty ?? false) ? currentFirst : first,
      'lastName': (currentLast?.isNotEmpty ?? false) ? currentLast : last,
    };
    try {
      await _dio.post(
        '${AppConfig.bffBaseUrl}/api/identity/update-profile',
        data: data,
        options: Options(
          contentType: Headers.jsonContentType,
          headers: {'Authorization': 'Bearer ${state.accessToken}'},
        ),
      );
      await _storage.delete(key: _pendingAppleFirstKey);
      await _storage.delete(key: _pendingAppleLastKey);
      debugPrint('Apple name sent to backend');
    } catch (e) {
      debugPrint('Failed to send Apple name to backend, kept for the next try: $e');
    }
  }

  /// Load the user's full profile (name + phone) from the backend.
  /// Called once after authentication — result is cached in state.
  void _loadProfile() {
    _dio.get(
      '${AppConfig.bffBaseUrl}/api/identity/my-profile',
      options: Options(
        headers: {'Authorization': 'Bearer ${state.accessToken}'},
      ),
    ).then((response) async {
      if (response.statusCode == 200) {
        final data = response.data;
        // A name Apple gave that never reached the backend: sent now, then read again
        final storedFirst = (data['firstName'] as String?)?.trim() ?? '';
        final storedLast = (data['lastName'] as String?)?.trim() ?? '';
        if (state.isSocialLogin && (storedFirst.isEmpty || storedLast.isEmpty) && await _storage.containsKey(key: _pendingAppleFirstKey)) {
          await _sendPendingAppleName(currentFirst: storedFirst, currentLast: storedLast);
          if (!await _storage.containsKey(key: _pendingAppleFirstKey)) {
            _loadProfile();
            return;
          }
        }
        final name = (data['name'] as String?)?.trim();
        final phone = data['phoneNumber'] as String?;
        final effectiveName = (name != null && name.isNotEmpty) ? name : state.name;
        state = state.copyWith(
          name: effectiveName,
          firstName: (data['firstName'] as String?)?.trim() ?? '',
          lastName: (data['lastName'] as String?)?.trim() ?? '',
          phoneNumber: phone,
        );
        // Cache for offline access
        if (effectiveName != null) _storage.write(key: _nameKey, value: effectiveName);
        if (phone != null) _storage.write(key: _phoneKey, value: phone);
        debugPrint('Profile loaded - name: $name, phone: $phone');
      }
    }).catchError((e) {
      debugPrint('Failed to load profile: $e');
    });
  }

  /// Update the cached profile in auth state (called after profile_gate saves).
  void setProfile(String firstName, String lastName, String phoneNumber) {
    final name = '$firstName $lastName'.trim();
    state = state.copyWith(name: name, firstName: firstName, lastName: lastName, phoneNumber: phoneNumber);
    _storage.write(key: _nameKey, value: name);
    _storage.write(key: _phoneKey, value: phoneNumber);
  }

  /// Sign in with username and password using Resource Owner Password Credentials grant
  Future<bool> signIn(String username, String password) async {
    debugPrint('Attempting sign in to: $_tokenEndpoint');
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

      debugPrint('Sign in response status: ${response.statusCode}');
      if (response.statusCode == 200) {
        final data = response.data;
        await _saveTokens(
          accessToken: data['access_token'],
          refreshToken: data['refresh_token'],
          idToken: data['id_token'],
        );
        _loadProfile();
        return true;
      }
      return false;
    } on DioException catch (e) {
      debugPrint('Sign in DioException: ${e.type} - ${e.message}');
      debugPrint('Sign in error response: ${e.response?.statusCode} - ${e.response?.data}');
      return false;
    } catch (e) {
      debugPrint('Sign in error: $e');
      return false;
    }
  }

  /// Initialize Google Sign-In (must be called exactly once before use)
  Future<void> _ensureGoogleSignInInitialized() async {
    if (_googleSignInInitialized) return;
    await _googleSignIn.initialize(
      serverClientId: AppConfig.googleServerClientId,
    );
    _googleSignInInitialized = true;
  }

  /// Generate a random nonce string for Apple Sign In
  String _generateNonce([int length = 32]) {
    const charset = '0123456789ABCDEFGHIJKLMNOPQRSTUVXYZabcdefghijklmnopqrstuvwxyz-._';
    final random = Random.secure();
    return List.generate(length, (_) => charset[random.nextInt(charset.length)]).join();
  }

  /// SHA256 hash of a string (used for Apple Sign In nonce on Android)
  String _sha256ofString(String input) {
    final bytes = utf8.encode(input);
    final digest = sha256.convert(bytes);
    return digest.toString();
  }

  /// Sign in with social provider using native SDKs (no browser)
  Future<bool> signInWithProvider(SocialProvider provider) async {
    debugPrint('Attempting native social sign in with: ${provider.name}');

    try {
      String? socialToken;
      String providerAlias;
      String tokenType;

      if (provider == SocialProvider.google) {
        // Use native Google Sign-In (v7 singleton API)
        await _ensureGoogleSignInInitialized();
        try {
          final scopes = ['email', 'profile', 'openid'];
          final googleUser = await _googleSignIn.authenticate(scopeHint: scopes);

          // Get access token via authorization client
          var authz = await googleUser.authorizationClient.authorizationForScopes(scopes);
          authz ??= await googleUser.authorizationClient.authorizeScopes(scopes);
          socialToken = authz.accessToken;
          providerAlias = 'google';
          tokenType = 'urn:ietf:params:oauth:token-type:access_token';
          debugPrint('Google sign in successful, got access token');
        } on GoogleSignInException catch (e) {
          debugPrint('Google sign in exception: ${e.code}');
          return false;
        }
      } else {
        // Use Sign In with Apple
        final rawNonce = _generateNonce();
        final hashedNonce = _sha256ofString(rawNonce);

        final credential = await SignInWithApple.getAppleIDCredential(
          scopes: [
            AppleIDAuthorizationScopes.email,
            AppleIDAuthorizationScopes.fullName,
          ],
          nonce: hashedNonce,
        );

        socialToken = credential.identityToken;
        providerAlias = 'apple';
        tokenType = 'urn:ietf:params:oauth:token-type:id_token';

        // Apple provides name only on first sign-in — capture it now
        final givenName = credential.givenName?.trim();
        final familyName = credential.familyName?.trim();
        if ((givenName?.isNotEmpty ?? false) || (familyName?.isNotEmpty ?? false)) {
          debugPrint('Apple provided a name');
          await _storage.write(key: _pendingAppleFirstKey, value: givenName ?? '');
          await _storage.write(key: _pendingAppleLastKey, value: familyName ?? '');
        }

        debugPrint('Apple sign in successful, got identity token');
      }

      if (socialToken == null) {
        debugPrint('No social token received');
        return false;
      }

      // Exchange social token with Keycloak using token exchange grant
      return await _exchangeSocialToken(socialToken, providerAlias, tokenType);
    } catch (e) {
      debugPrint('Social sign in error: $e');
      return false;
    }
  }

  /// Exchange social provider token for Keycloak tokens
  Future<bool> _exchangeSocialToken(String socialToken, String providerAlias, String tokenType) async {
    debugPrint('Exchanging $providerAlias token with Keycloak');

    try {
      final response = await _dio.post(
        _tokenEndpoint,
        data: {
          'grant_type': 'urn:ietf:params:oauth:grant-type:token-exchange',
          'client_id': AppConfig.clientId,
          'subject_token': socialToken,
          'subject_token_type': tokenType,
          'subject_issuer': providerAlias,
          'scope': AppConfig.scopes.join(' '),
        },
        options: Options(
          contentType: Headers.formUrlEncodedContentType,
        ),
      );

      debugPrint('Token exchange response status: ${response.statusCode}');
      if (response.statusCode == 200) {
        final data = response.data;
        await _saveTokens(
          accessToken: data['access_token'],
          refreshToken: data['refresh_token'],
          idToken: data['id_token'],
        );

        // Mark as social login
        await _storage.write(key: _isSocialLoginKey, value: 'true');
        state = state.copyWith(isSocialLogin: true);

        // Load full profile (name + phone) from backend; a name Apple gave on this, its
        // first sign-in, is sent on from there where the account has none
        _loadProfile();

        return true;
      }
      return false;
    } on DioException catch (e) {
      debugPrint('Token exchange DioException: ${e.type} - ${e.message}');
      debugPrint('Token exchange error response: ${e.response?.statusCode} - ${e.response?.data}');
      return false;
    } catch (e) {
      debugPrint('Token exchange error: $e');
      return false;
    }
  }

  /// Register a new user
  Future<bool> register(String firstName, String lastName, String email, String phone, String password) async {
    try {
      // Call the BFF registration endpoint which handles Keycloak user creation
      final response = await _dio.post(
        '${AppConfig.bffBaseUrl}/api/identity/register',
        data: {
          'firstName': firstName,
          'lastName': lastName,
          'email': email,
          'phoneNumber': phone,
          'password': password,
        },
        options: Options(
          contentType: Headers.jsonContentType,
        ),
      );

      return response.statusCode == 200 || response.statusCode == 201;
    } on DioException catch (e) {
      debugPrint('Registration error: ${e.response?.data ?? e.message}');
      return false;
    } catch (e) {
      debugPrint('Registration error: $e');
      return false;
    }
  }

  /// Sign out
  Future<void> signOut() async {
    // Capture refresh token before clearing state
    final refreshToken = state.refreshToken;

    // Clear tokens and set unauthenticated immediately for instant UI redirect
    await _clearTokens();

    // Fire-and-forget: cleanup SignalR, Keycloak session, and social providers
    Future(() async {
      try {
        ref.read(signalRServiceProvider).disconnect();
      } catch (e) {
        debugPrint('SignalR disconnect error: $e');
      }
      try {
        if (refreshToken != null) {
          await _dio.post(
            _logoutEndpoint,
            data: {
              'client_id': AppConfig.clientId,
              'refresh_token': refreshToken,
            },
            options: Options(
              contentType: Headers.formUrlEncodedContentType,
            ),
          );
        }
      } catch (e) {
        debugPrint('Keycloak logout error: $e');
      }
      try {
        await _googleSignIn.signOut();
      } catch (_) {
        // May not be signed in with Google
      }
    });
  }

  /// Refresh access token
  Future<bool> refreshToken() async {
    if (state.refreshToken == null) {
      debugPrint('Token refresh - no refresh token available');
      return false;
    }

    try {
      debugPrint('Token refresh - calling $_tokenEndpoint');
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
        debugPrint('Token refresh - success');
        return true;
      }
      debugPrint('Token refresh - failed with status ${response.statusCode}');
      return false;
    } on DioException catch (e) {
      debugPrint('Token refresh DioException: ${e.type}');
      debugPrint('Token refresh error response: ${e.response?.statusCode} - ${e.response?.data}');
      debugPrint('Token refresh error message: ${e.message}');
      // Only clear tokens if the server explicitly rejected the refresh token
      // (400 = invalid_grant / expired). Don't clear on network errors or timeouts.
      if (e.response?.statusCode == 400 || e.response?.statusCode == 401) {
        await _clearTokens();
      }
      return false;
    } catch (e) {
      debugPrint('Token refresh error: $e');
      return false;
    }
  }

  /// Get current access token
  Future<String?> getAccessToken() async {
    return state.accessToken;
  }

  /// Decode JWT token payload (without verification - just for reading claims)
  Map<String, dynamic>? _decodeJwtPayload(String token) {
    try {
      final parts = token.split('.');
      if (parts.length != 3) return null;

      // Decode the payload (second part)
      final payload = parts[1];
      // Add padding if needed
      final normalized = base64Url.normalize(payload);
      final decoded = utf8.decode(base64Url.decode(normalized));
      return jsonDecode(decoded) as Map<String, dynamic>;
    } catch (e) {
      debugPrint('Error decoding JWT: $e');
      return null;
    }
  }

  Future<void> _saveTokens({
    required String accessToken,
    String? refreshToken,
    String? idToken,
  }) async {
    debugPrint('Saving tokens to secure storage...');
    await _storage.write(key: _accessTokenKey, value: accessToken);
    if (refreshToken != null) {
      await _storage.write(key: _refreshTokenKey, value: refreshToken);
    }
    if (idToken != null) {
      await _storage.write(key: _idTokenKey, value: idToken);
    }
    debugPrint('Tokens saved successfully');

    // Extract user info from token
    String? userId;
    String? email;
    String? name;

    // Try to decode id_token first (has user info), fallback to access_token
    final tokenToDecode = idToken ?? accessToken;
    final claims = _decodeJwtPayload(tokenToDecode);
    if (claims != null) {
      userId = claims['sub'] as String?;
      email = claims['email'] as String?;
      // Keycloak: 'name' is full name (firstName + lastName), 'preferred_username' is username
      name = claims['name'] as String? ?? claims['preferred_username'] as String?;
      debugPrint('Extracted user info - userId: $userId, email: $email, name: $name');
    }

    state = state.copyWith(
      isAuthenticated: true,
      accessToken: accessToken,
      refreshToken: refreshToken ?? state.refreshToken,
      idToken: idToken ?? state.idToken,
      userId: userId,
      email: email,
      name: name,
    );

    // Connect SignalR for realtime updates
    ref.read(signalRServiceProvider).connect();
  }

  Future<void> _clearTokens() async {
    await _storage.delete(key: _accessTokenKey);
    await _storage.delete(key: _refreshTokenKey);
    await _storage.delete(key: _idTokenKey);
    await _storage.delete(key: _isSocialLoginKey);
    await _storage.delete(key: _nameKey);
    await _storage.delete(key: _phoneKey);
    await _storage.delete(key: _pendingAppleFirstKey);
    await _storage.delete(key: _pendingAppleLastKey);

    state = const AuthState(isInitializing: false);
  }
}

/// Provider for auth service
final authServiceProvider = NotifierProvider<AuthService, AuthState>(AuthService.new);

/// Provider for auth state
final isAuthenticatedProvider = Provider<bool>((ref) {
  return ref.watch(authServiceProvider).isAuthenticated;
});
