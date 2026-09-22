import 'package:dio/dio.dart';
import 'network_status.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:uuid/uuid.dart';
import '../auth/auth_service.dart';
import '../config/app_config.dart';
import '../providers/branch_provider.dart';

const _uuid = Uuid();

/// Base API client with authentication interceptor and idempotency support.
///
/// Every mutation carries an `x-requestid`. Callers that own a retry (the
/// sale pad's charge, a queued command later) pass their own so a repeat is
/// deduplicated server-side; everything else gets a fresh one here.
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
        return handler.next(response);
      },
      onError: (error, handler) async {
        if (NetworkStatus.isConnectionError(error)) {
          networkStatus.reportFailure();
        } else if (error.response != null) {
          // The server answered, however unhappily — the network is fine
          networkStatus.reportSuccess();
        }
        if (error.response?.statusCode == 401) {
          // Token expired, try to refresh
          final refreshed = await _authService.refreshToken();
          if (refreshed) {
            // Retry the request with new token
            final token = await _authService.getAccessToken();
            error.requestOptions.headers['Authorization'] = 'Bearer $token';
            try {
              final response = await _dio.fetch(error.requestOptions);
              return handler.resolve(response);
            } catch (e) {
              return handler.next(error);
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

/// Helper to get the current branch ID from the provider container
int? Function() _branchIdGetter(Ref ref) {
  return () => ref.read(branchProvider).selectedBranchId;
}

/// Providers for API clients — branch-scoped services include X-Branch-Id header
final catalogApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return ApiClient(authService, baseUrl: AppConfig.catalogApiUrl, branchIdGetter: _branchIdGetter(ref));
});

final ordersApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return ApiClient(authService, baseUrl: AppConfig.ordersApiUrl, branchIdGetter: _branchIdGetter(ref));
});

final placesApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return ApiClient(authService, baseUrl: AppConfig.placesApiUrl, branchIdGetter: _branchIdGetter(ref));
});

final staysApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return ApiClient(authService, baseUrl: AppConfig.staysApiUrl, branchIdGetter: _branchIdGetter(ref));
});

final reservationsApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return ApiClient(authService, baseUrl: AppConfig.reservationsApiUrl, branchIdGetter: _branchIdGetter(ref));
});

final notificationsApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return ApiClient(authService, baseUrl: AppConfig.notificationsApiUrl, branchIdGetter: _branchIdGetter(ref));
});

/// Sales.API: tickets and shifts, both branch-scoped
final salesApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return ApiClient(authService, baseUrl: AppConfig.salesApiUrl, branchIdGetter: _branchIdGetter(ref));
});

/// Payroll and Finance: the till reads only their pickers, both branch-scoped
final payrollApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return ApiClient(authService, baseUrl: AppConfig.payrollApiUrl, branchIdGetter: _branchIdGetter(ref));
});

final financeApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return ApiClient(authService, baseUrl: AppConfig.financeApiUrl, branchIdGetter: _branchIdGetter(ref));
});

/// Global services — no branch header needed
final identityApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return ApiClient(authService, baseUrl: AppConfig.identityApiUrl);
});

/// Loyalty and Accounts: neither is branch-scoped; the till only reads a
/// customer's points and tab balance from them
final loyaltyApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return ApiClient(authService, baseUrl: AppConfig.loyaltyApiUrl);
});

final accountsApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return ApiClient(authService, baseUrl: AppConfig.accountsApiUrl);
});

/// Branches API — no branch header (it IS the branch service)
final branchesApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return ApiClient(authService, baseUrl: AppConfig.branchesApiUrl);
});

/// Tenant brand — anonymous, no branch header
final tenantApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return ApiClient(authService, baseUrl: AppConfig.tenantApiUrl);
});
