import 'package:dio/dio.dart';
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

  /// Added at the till by name and phone and not yet claimed: no email, no
  /// password, a "Send app link" away from being theirs
  final bool addedAtCounter;

  const IdentityUser({
    required this.id,
    this.username,
    this.email,
    this.firstName,
    this.lastName,
    this.phoneNumber,
    this.addedAtCounter = false,
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
        addedAtCounter: json['addedAtCounter'] as bool? ?? false,
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

/// What the live check found for what the cashier typed: the one customer
/// with this number, and a few whose names look alike.
class CustomerLookup {
  /// The number as the server normalized it
  final String phone;
  final bool phoneValid;
  final IdentityUser? match;
  final List<IdentityUser> similar;

  const CustomerLookup({required this.phone, required this.phoneValid, this.match, this.similar = const []});

  static const empty = CustomerLookup(phone: '', phoneValid: false);

  factory CustomerLookup.fromJson(Map<String, dynamic> json) => CustomerLookup(
        phone: json['phone'] as String? ?? '',
        phoneValid: json['phoneValid'] as bool? ?? false,
        match: json['match'] is Map<String, dynamic> ? IdentityUser.fromJson(json['match'] as Map<String, dynamic>) : null,
        similar: (json['similar'] as List<dynamic>? ?? [])
            .map((e) => IdentityUser.fromJson(e as Map<String, dynamic>))
            .toList(),
      );
}

/// The outcome of adding a customer at the counter
sealed class NewCustomerResult {
  const NewCustomerResult();
}

class CustomerAdded extends NewCustomerResult {
  final IdentityUser user;
  const CustomerAdded(this.user);
}

/// The number already belongs to [existing]: offer them instead
class CustomerExists extends NewCustomerResult {
  final IdentityUser existing;
  const CustomerExists(this.existing);
}

/// The server refused a field: `name` or `phoneNumber`
class CustomerRefused extends NewCustomerResult {
  final String? field;
  final String? placeholder;
  const CustomerRefused(this.field, this.placeholder);
}

/// A one-time link a counter customer claims their account with
class ClaimLink {
  final String token;
  final DateTime expiresAt;
  const ClaimLink(this.token, this.expiresAt);

  /// On the café's customer host, where the claim page lives
  Uri url(String customerOrigin) => Uri.parse('$customerOrigin/claim?token=${Uri.encodeQueryComponent(token)}');
}

/// Why a link was not issued
enum ClaimLinkRefusal { alreadyHasAccount, tooMany, failed }

class ClaimLinkException implements Exception {
  final ClaimLinkRefusal reason;
  const ClaimLinkException(this.reason);
}

/// Customers the till adds by name and phone, and the app link that hands
/// such an account to its customer
class CounterCustomerService {
  final ApiClient _apiClient;

  CounterCustomerService(this._apiClient);

  Future<CustomerLookup> lookup({String? phone, String? name}) async {
    final response = await _apiClient.get<Map<String, dynamic>>(
      'customers/lookup',
      queryParameters: {
        if (phone != null && phone.isNotEmpty) 'phone': phone,
        if (name != null && name.isNotEmpty) 'name': name,
      },
    );
    return CustomerLookup.fromJson(response.data ?? const {});
  }

  Future<NewCustomerResult> add({required String name, required String phone}) async {
    try {
      final response = await _apiClient.post<Map<String, dynamic>>('customers', data: {'name': name, 'phoneNumber': phone});
      return CustomerAdded(IdentityUser.fromJson(response.data!));
    } on DioException catch (e) {
      final body = e.response?.data;
      final json = body is Map<String, dynamic> ? body : const <String, dynamic>{};
      switch (e.response?.statusCode) {
        case 409 when json['existing'] is Map<String, dynamic>:
          return CustomerExists(IdentityUser.fromJson(json['existing'] as Map<String, dynamic>));
        case 400:
          return CustomerRefused(json['field'] as String?, json['placeholder'] as String?);
      }
      rethrow;
    }
  }

  Future<ClaimLink> claimLink(String userId) async {
    try {
      final response = await _apiClient.post<Map<String, dynamic>>('customers/$userId/claim-link');
      final json = response.data!;
      return ClaimLink(json['token'] as String, DateTime.parse(json['expiresAt'] as String).toLocal());
    } on DioException catch (e) {
      throw ClaimLinkException(switch (e.response?.statusCode) {
        409 => ClaimLinkRefusal.alreadyHasAccount,
        429 => ClaimLinkRefusal.tooMany,
        _ => ClaimLinkRefusal.failed,
      });
    }
  }
}

final counterCustomerServiceProvider = Provider<CounterCustomerService>((ref) {
  return CounterCustomerService(ref.read(identityApiProvider));
});
