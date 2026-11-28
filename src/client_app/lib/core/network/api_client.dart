import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../auth/auth_service.dart';
import '../config/app_config.dart';
import '../providers/branch_provider.dart';

import 'package:ninja_app_core/network/api_client.dart' show ApiClient, TokenSource;

export 'package:ninja_app_core/network/api_client.dart' show ApiClient;

/// The customer app's clients: a minute to answer (a phone on a weak network), and requests
/// logged in a debug build only
ApiClient appApiClient(TokenSource auth, String baseUrl, {int? Function()? branchIdGetter}) => ApiClient(
      auth,
      baseUrl: baseUrl,
      branchIdGetter: branchIdGetter,
      timeout: const Duration(seconds: 60),
      logInDebug: true,
    );

/// Helper to get the current branch ID from the provider container
int? Function() _branchIdGetter(Ref ref) {
  return () => ref.read(branchProvider).selectedBranchId;
}

/// Providers for API clients — branch-scoped services include X-Branch-Id header
final catalogApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return appApiClient(authService, AppConfig.catalogApiUrl, branchIdGetter: _branchIdGetter(ref));
});

final ordersApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return appApiClient(authService, AppConfig.ordersApiUrl, branchIdGetter: _branchIdGetter(ref));
});

final placesApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return appApiClient(authService, AppConfig.placesApiUrl, branchIdGetter: _branchIdGetter(ref));
});

final staysApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return appApiClient(authService, AppConfig.staysApiUrl, branchIdGetter: _branchIdGetter(ref));
});

final reservationsApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return appApiClient(authService, AppConfig.reservationsApiUrl, branchIdGetter: _branchIdGetter(ref));
});

final notificationsApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return appApiClient(authService, AppConfig.notificationsApiUrl, branchIdGetter: _branchIdGetter(ref));
});

/// Global services — no branch header needed
final loyaltyApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return appApiClient(authService, AppConfig.loyaltyApiUrl);
});

final accountsApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return appApiClient(authService, AppConfig.accountsApiUrl);
});

final identityApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return appApiClient(authService, AppConfig.identityApiUrl);
});

/// Branches API — no branch header (it IS the branch service)
final branchesApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return appApiClient(authService, AppConfig.branchesApiUrl);
});

/// Tenant brand — anonymous, no branch header
final tenantApiProvider = Provider<ApiClient>((ref) {
  final authService = ref.read(authServiceProvider.notifier);
  return appApiClient(authService, AppConfig.tenantApiUrl);
});
