import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../config/app_config.dart';
import '../network/api_client.dart';
import 'tenant_brand.dart';

abstract class TenantRepository {
  Future<TenantBrand> getBrand();
}

/// `GET /api/tenant` — anonymous; the client's bearer token, when there is
/// one, is simply ignored
class ApiTenantRepository implements TenantRepository {
  final ApiClient _apiClient;

  ApiTenantRepository(this._apiClient);

  @override
  Future<TenantBrand> getBrand() async {
    final response = await _apiClient.get<Map<String, dynamic>>('');
    return TenantBrand.fromApi(response.data ?? const {}, baseUrl: AppConfig.bffBaseUrl);
  }
}

final tenantRepositoryProvider = Provider<TenantRepository>((ref) {
  return ApiTenantRepository(ref.read(tenantApiProvider));
});
