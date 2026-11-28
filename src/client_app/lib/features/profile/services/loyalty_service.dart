import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../models/loyalty_info.dart';

/// Abstract interface for loyalty data access
abstract class LoyaltyRepository {
  Future<LoyaltyInfo?> getAccount(String userId);
  Future<List<PointsTransaction>> getTransactions(String userId, {int max = 10});
  Future<void> joinProgram(String userId);
  Future<double?> getPointsValue(int points);
}

/// API implementation of LoyaltyRepository
class ApiLoyaltyRepository implements LoyaltyRepository {
  final ApiClient _apiClient;

  ApiLoyaltyRepository(this._apiClient);

  @override
  Future<LoyaltyInfo?> getAccount(String userId) async {
    try {
      final response = await _apiClient.get<dynamic>(
        '/accounts/$userId',
        queryParameters: {'api-version': '1.0'},
      ).timeout(const Duration(seconds: 3));

      return LoyaltyInfo.fromJson(response.data as Map<String, dynamic>);
    } catch (e) {
      if (e.toString().contains('404')) {
        return null;
      }
      rethrow;
    }
  }

  @override
  Future<List<PointsTransaction>> getTransactions(String userId, {int max = 10}) async {
    final response = await _apiClient.get<dynamic>(
      '/transactions/$userId',
      queryParameters: {'api-version': '1.0', 'max': max},
    );

    return (response.data as List<dynamic>)
        .map((e) => PointsTransaction.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<void> joinProgram(String userId) async {
    await _apiClient.post<dynamic>(
      '/accounts',
      data: {'userId': userId},
    );
  }

  @override
  Future<double?> getPointsValue(int points) async {
    if (points <= 0) return 0;
    try {
      final response = await _apiClient.get<dynamic>(
        '/points-value',
        queryParameters: {'api-version': '1.0', 'points': points},
      );
      final data = response.data as Map<String, dynamic>;
      return (data['discountValue'] as num).toDouble();
    } catch (e) {
      return null;
    }
  }
}

/// Provider for loyalty repository
final loyaltyRepositoryProvider = Provider<LoyaltyRepository>((ref) {
  final apiClient = ref.watch(loyaltyApiProvider);
  return ApiLoyaltyRepository(apiClient);
});
