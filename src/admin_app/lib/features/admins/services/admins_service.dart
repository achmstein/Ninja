import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../models/admin_user.dart';

/// Abstract repository for staff account operations (Identity.API)
abstract class AdminsRepository {
  /// [role] takes one role or a comma-separated list ("Admin,Cashier")
  Future<List<AdminUser>> getAdmins(
      {int first = 0, int max = 50, String? search, String? role});
  Future<AdminUser> getAdmin(String adminId);
  Future<void> createAdmin({
    required String name,
    required String email,
    required String password,
    String role = 'Admin',
    bool isOwner = false,
    List<int> branchIds = const [],
  });
  Future<void> updateAdminName(String adminId, String newName);
  Future<void> resetAdminPassword(String adminId, String newPassword);
  Future<bool> toggleAdminEnabled(String adminId);

  /// Replaces the branches the account may work in (Owner). The change
  /// reaches the user's token on its next refresh.
  Future<void> setBranches(String adminId, List<int> branchIds);
}

/// API implementation of AdminsRepository
class ApiAdminsRepository implements AdminsRepository {
  final ApiClient _api;

  ApiAdminsRepository(this._api);

  @override
  Future<List<AdminUser>> getAdmins(
      {int first = 0, int max = 50, String? search, String? role}) async {
    final queryParams = <String, dynamic>{
      'first': first,
      'max': max,
    };

    if (role != null && role.isNotEmpty) {
      queryParams['role'] = role;
    }

    if (search != null && search.isNotEmpty) {
      queryParams['search'] = search;
    }

    final response = await _api.get('/users', queryParameters: queryParams);
    final adminsData = response.data as List<dynamic>;

    return adminsData
        .map((e) => AdminUser.fromJson(e as Map<String, dynamic>))
        .toList();
  }

  @override
  Future<AdminUser> getAdmin(String adminId) async {
    final response = await _api.get('/users/$adminId');
    return AdminUser.fromJson(response.data as Map<String, dynamic>);
  }

  @override
  Future<void> createAdmin({
    required String name,
    required String email,
    required String password,
    String role = 'Admin',
    bool isOwner = false,
    List<int> branchIds = const [],
  }) async {
    await _api.post('/register-admin', data: {
      'name': name,
      'email': email,
      'password': password,
      'role': role,
      'isOwner': isOwner,
      'branchIds': branchIds,
    });
  }

  @override
  Future<void> updateAdminName(String adminId, String newName) async {
    // The profile endpoint keeps the other fields; a name-only endpoint does not exist
    await _api.put('/users/$adminId/profile', data: {'name': newName});
  }

  @override
  Future<void> resetAdminPassword(String adminId, String newPassword) async {
    await _api.put('/users/$adminId/password',
        data: {'newPassword': newPassword});
  }

  @override
  Future<bool> toggleAdminEnabled(String adminId) async {
    final response = await _api.put('/users/$adminId/toggle-enabled');
    return response.data['enabled'] as bool;
  }

  @override
  Future<void> setBranches(String adminId, List<int> branchIds) async {
    await _api.put('/users/$adminId/branches', data: {'branchIds': branchIds});
  }
}

/// Provider for AdminsRepository
final adminsRepositoryProvider = Provider<AdminsRepository>(
    (ref) => ApiAdminsRepository(ref.read(identityApiProvider)));
