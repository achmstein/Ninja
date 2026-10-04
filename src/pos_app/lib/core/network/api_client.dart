import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ninja_app_core/auth/auth_service.dart';
import 'package:ninja_app_core/network/api_client.dart';
import '../config/app_config.dart';

// The shared client (one 401 retry, one token refresh at a time) and the
// clients every app has: orders, branches, the brand
export 'package:ninja_app_core/network/api_client.dart';

/// The till's own clients: branch-scoped services carry X-Branch-Id
final catalogApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return ApiClient(authService, baseUrl: AppConfig.catalogApiUrl, branchIdGetter: branchIdGetter(ref));
});

/// The kitchen's stations and print queue — branch-scoped
final kitchenApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return ApiClient(authService, baseUrl: AppConfig.kitchenApiUrl, branchIdGetter: branchIdGetter(ref));
});

final placesApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return ApiClient(authService, baseUrl: AppConfig.placesApiUrl, branchIdGetter: branchIdGetter(ref));
});

final staysApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return ApiClient(authService, baseUrl: AppConfig.staysApiUrl, branchIdGetter: branchIdGetter(ref));
});

final reservationsApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return ApiClient(authService, baseUrl: AppConfig.reservationsApiUrl, branchIdGetter: branchIdGetter(ref));
});

final notificationsApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return ApiClient(authService, baseUrl: AppConfig.notificationsApiUrl, branchIdGetter: branchIdGetter(ref));
});

/// Sales.API: tickets and shifts, both branch-scoped
final salesApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return ApiClient(authService, baseUrl: AppConfig.salesApiUrl, branchIdGetter: branchIdGetter(ref));
});

/// Payroll and Finance: the till reads only their pickers, both branch-scoped
final payrollApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return ApiClient(authService, baseUrl: AppConfig.payrollApiUrl, branchIdGetter: branchIdGetter(ref));
});

final financeApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return ApiClient(authService, baseUrl: AppConfig.financeApiUrl, branchIdGetter: branchIdGetter(ref));
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
