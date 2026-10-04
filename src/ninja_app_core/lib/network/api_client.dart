import 'package:dio/dio.dart';
import 'network_status.dart';
import 'server_clock.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../auth/auth_service.dart';
import '../config.dart';
import '../providers/branch_provider.dart';

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
  final AuthService _authService;

  ApiClient(this._authService, {required String baseUrl, int? Function()? branchIdGetter})
      : _dio = Dio(BaseOptions(
          baseUrl: baseUrl,
          connectTimeout: const Duration(seconds: 30),
          receiveTimeout: const Duration(seconds: 30),
          headers: {'Content-Type': 'application/json'},
          queryParameters: {'api-version': '1.0'}, // Required by YARP BFF routes
        )) {
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
        // Add branch header if getter is provided
        // The branch header is sent only while a branch is selected: an
        // account with none to work in must not fall back to some default
        final branchId = branchIdGetter?.call();
        if (branchId != null) {
          options.headers['X-Branch-Id'] = '$branchId';
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

  Options? _options(String? requestId) =>
      requestId == null ? null : Options(headers: {'x-requestid': requestId});

  Future<Response<T>> get<T>(String path,
      {Map<String, dynamic>? queryParameters}) {
    return _dio.get<T>(path, queryParameters: queryParameters);
  }

  Future<Response<T>> post<T>(String path, {dynamic data, String? requestId}) {
    return _dio.post<T>(path, data: data, options: _options(requestId));
  }

  Future<Response<T>> put<T>(String path, {dynamic data, String? requestId}) {
    return _dio.put<T>(path, data: data, options: _options(requestId));
  }

  Future<Response<T>> delete<T>(String path, {String? requestId}) {
    return _dio.delete<T>(path, options: _options(requestId));
  }

  Future<Response<T>> patch<T>(String path, {dynamic data, String? requestId}) {
    return _dio.patch<T>(path, data: data, options: _options(requestId));
  }
}

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
