import 'dart:async';
import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';
import 'network_status.dart';
import 'server_clock.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../auth/auth_service.dart';
import '../config.dart';
import '../providers/branch_provider.dart';
import 'token_source.dart';

export 'token_source.dart';

const _uuid = Uuid();

/// Marks a request already sent again after a token refresh
const _retriedKey = 'ninja.retriedAfterRefresh';

/// Base API client with authentication interceptor and idempotency support.
///
/// Every mutation carries an `x-requestid`. Callers that own a retry pass
/// their own so a repeat is deduplicated server-side; everything else gets
/// a fresh one here.
class ApiClient {
  final Dio _dio;
  final TokenSource _authService;

  /// [timeout] for connecting and for the answer; [logInDebug] writes requests
  /// to the console in a debug build (never their headers: the token rides in
  /// one, and a release build's log can be read off a phone).
  ApiClient(
    this._authService, {
    required String baseUrl,
    int? Function()? branchIdGetter,
    Duration timeout = const Duration(seconds: 30),
    bool logInDebug = false,
  }) : _dio = Dio(BaseOptions(
          baseUrl: baseUrl,
          connectTimeout: timeout,
          receiveTimeout: timeout,
          headers: {'Content-Type': 'application/json', 'Accept': 'application/json'},
          queryParameters: {'api-version': '1.0'}, // Required by YARP BFF routes
        )) {
    if (logInDebug && kDebugMode) {
      _dio.interceptors.add(LogInterceptor(
        requestHeader: false,
        responseHeader: false,
        requestBody: true,
        responseBody: true,
        logPrint: (obj) => debugPrint('[Dio] $obj'),
      ));
    }
    _dio.interceptors.add(InterceptorsWrapper(
      onRequest: (options, handler) async {
        final token = await _authService.getAccessToken();
        if (token != null) {
          options.headers['Authorization'] = 'Bearer $token';
        }
        // Add request ID for idempotency on mutating operations, unless the
        // caller already chose one
        if (options.method != 'GET' && options.headers['x-requestid'] == null) {
          options.headers['x-requestid'] = _uuid.v4();
        }
        // The branch the call is for: one it names itself (the customer app's
        // menu cached under another branch), else the one an inBranch zone
        // set, else the selected one. None while no branch is selected: an
        // account with none to work in must not fall back to some default
        if (!options.headers.containsKey('X-Branch-Id')) {
          final branchId = branchInZone ?? branchIdGetter?.call();
          if (branchId != null) options.headers['X-Branch-Id'] = '$branchId';
        }
        return handler.next(options);
      },
      onResponse: (response, handler) {
        networkStatus.reportSuccess();
        // Every answer says what time the server makes it: times are read by it
        serverClock.note(response.headers.value('date'));
        return handler.next(response);
      },
      onError: (error, handler) async {
        if (NetworkStatus.isConnectionError(error)) {
          networkStatus.reportFailure();
        } else if (error.response != null) {
          // The server answered, however unhappily — the network is fine
          networkStatus.reportSuccess();
        }
        // Token expired: refresh (one refresh shared by every caller) and try
        // once more; a request already retried is not retried again, so a 401
        // that a fresh token does not cure ends here instead of looping
        final retried = error.requestOptions.extra[_retriedKey] == true;
        if (error.response?.statusCode == 401 && !retried) {
          final refreshed = await _authService.refreshToken();
          if (refreshed) {
            final token = await _authService.getAccessToken();
            final retry = error.requestOptions
              ..headers['Authorization'] = 'Bearer $token'
              ..extra[_retriedKey] = true;
            try {
              final response = await _dio.fetch<dynamic>(retry);
              return handler.resolve(response);
            } on DioException catch (e) {
              return handler.next(e);
            }
          }
        }
        return handler.next(error);
      },
    ));
  }

  /// The underlying client, for a test to answer its requests
  @visibleForTesting
  Dio get dio => _dio;

  Options? _options(String? requestId, Map<String, dynamic>? headers) => requestId == null && headers == null
      ? null
      : Options(headers: {...?headers, 'x-requestid': ?requestId});

  Future<Response<T>> get<T>(String path,
      {Map<String, dynamic>? queryParameters, Map<String, dynamic>? headers}) {
    return _dio.get<T>(path, queryParameters: queryParameters, options: headers == null ? null : Options(headers: headers));
  }

  Future<Response<T>> post<T>(String path, {dynamic data, String? requestId, Map<String, dynamic>? headers}) {
    return _dio.post<T>(path, data: data, options: _options(requestId, headers));
  }

  Future<Response<T>> put<T>(String path, {dynamic data, String? requestId, Map<String, dynamic>? headers}) {
    return _dio.put<T>(path, data: data, options: _options(requestId, headers));
  }

  Future<Response<T>> delete<T>(String path, {String? requestId, Map<String, dynamic>? headers}) {
    return _dio.delete<T>(path, options: _options(requestId, headers));
  }

  Future<Response<T>> patch<T>(String path, {dynamic data, String? requestId, Map<String, dynamic>? headers}) {
    return _dio.patch<T>(path, data: data, options: _options(requestId, headers));
  }
}

const _branchZoneKey = #ninjaBranchId;

/// Run [body] with every call it makes sent for [branchId] rather than the
/// selected branch: work done at one branch and sent later (a till's offline
/// sale) lands where it happened, whatever the till has switched to since.
Future<T> inBranch<T>(int? branchId, Future<T> Function() body) =>
    branchId == null ? body() : runZoned(body, zoneValues: {_branchZoneKey: branchId});

/// The branch [inBranch] set for the calls made in this zone, if any
int? get branchInZone => Zone.current[_branchZoneKey] as int?;

/// The selected branch, for a client whose calls carry X-Branch-Id
int? Function() branchIdGetter(Ref ref) {
  return () => ref.read(branchProvider).selectedBranchId;
}

/// Ordering API — branch-scoped: the app works at the selected branch
final ordersApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return ApiClient(authService, baseUrl: CoreEndpoints.ordersApiUrl, branchIdGetter: branchIdGetter(ref));
});

/// Branches API — no branch header (it IS the branch service)
final branchesApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return ApiClient(authService, baseUrl: CoreEndpoints.branchesApiUrl);
});

/// Tenant brand — anonymous, no branch header
final tenantApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return ApiClient(authService, baseUrl: CoreEndpoints.tenantApiUrl);
});
