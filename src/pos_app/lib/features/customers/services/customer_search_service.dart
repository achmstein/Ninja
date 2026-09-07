import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';

/// A Keycloak user as the identity BFF route returns it.
class IdentityUser {
  final String id;
  final String? username;
  final String? email;
  final String? firstName;
  final String? lastName;
  final String? phoneNumber;

  const IdentityUser({
    required this.id,
    this.username,
    this.email,
    this.firstName,
    this.lastName,
    this.phoneNumber,
  });

  String get displayName {
    final full = [firstName, lastName].where((s) => s != null && s.isNotEmpty).join(' ');
    return full.isNotEmpty ? full : (username ?? '');
  }

  String? get contact => (phoneNumber?.isNotEmpty == true) ? phoneNumber : email;

  factory IdentityUser.fromJson(Map<String, dynamic> json) => IdentityUser(
        id: json['id'] as String,
        username: json['username'] as String?,
        email: json['email'] as String?,
        firstName: json['firstName'] as String?,
        lastName: json['lastName'] as String?,
        phoneNumber: json['phoneNumber'] as String?,
      );
}

/// Attach-a-customer search for loyalty accrual and on-account settling.
/// Admins are excluded server-side so staff accounts never end up as
/// "customers" on a sale.
class CustomerSearchService {
  final ApiClient _apiClient;

  CustomerSearchService(this._apiClient);

  Future<List<IdentityUser>> search(String term, {int max = 20}) async {
    final response = await _apiClient.get<List<dynamic>>(
      'users',
      queryParameters: {'search': term, 'excludeRole': 'Admin,Owner,Cashier', 'max': max},
    );
    return (response.data ?? []).map((e) => IdentityUser.fromJson(e as Map<String, dynamic>)).toList();
  }
}

final customerSearchServiceProvider = Provider<CustomerSearchService>((ref) {
  return CustomerSearchService(ref.read(identityApiProvider));
});
