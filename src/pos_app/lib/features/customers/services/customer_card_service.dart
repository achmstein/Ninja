import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../models/customer_card.dart';

/// What the till may know about a customer: their points, as information,
/// and their tab, which it can take money against. Both are read by the
/// customer's Keycloak id; a 404 from either service means "none yet".
class CustomerCardService {
  final ApiClient _loyalty;
  final ApiClient _accounts;

  CustomerCardService(this._loyalty, this._accounts);

  /// Null when the customer never joined the program
  Future<LoyaltyAccount?> getLoyalty(String userId) async {
    try {
      final response = await _loyalty.get<Map<String, dynamic>>('accounts/$userId');
      return LoyaltyAccount.fromJson(response.data!);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      rethrow;
    }
  }

  /// Null when the customer has no tab yet
  Future<TabAccount?> getTab(String customerId) async {
    try {
      final response = await _accounts.get<Map<String, dynamic>>('$customerId/balance');
      return TabAccount.fromJson(response.data!);
    } on DioException catch (e) {
      if (e.response?.statusCode == 404) return null;
      rethrow;
    }
  }
}

final customerCardServiceProvider = Provider<CustomerCardService>((ref) {
  return CustomerCardService(ref.read(loyaltyApiProvider), ref.read(accountsApiProvider));
});
