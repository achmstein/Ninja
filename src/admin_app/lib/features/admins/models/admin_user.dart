/// Admin user model (from Keycloak user)
class AdminUser {
  final String id;
  final String? username;
  final String? email;
  final String? firstName;
  final String? lastName;
  final bool enabled;
  final DateTime? createdAt;
  final List<String> realmRoles;

  /// Branch ids the account may work in (owners hold all)
  final List<int> branches;

  AdminUser({
    required this.id,
    this.username,
    this.email,
    this.firstName,
    this.lastName,
    this.enabled = true,
    this.createdAt,
    this.realmRoles = const [],
    this.branches = const [],
  });

  String get displayName {
    final parts = [firstName, lastName]
        .where((s) => s?.isNotEmpty == true)
        .join(' ')
        .trim();
    if (parts.isNotEmpty) return parts;
    return username ?? email ?? 'Unknown';
  }

  String get initials {
    if (firstName != null &&
        firstName!.isNotEmpty &&
        lastName != null &&
        lastName!.isNotEmpty) {
      return '${firstName![0]}${lastName![0]}'.toUpperCase();
    }
    if (firstName != null && firstName!.isNotEmpty) {
      return firstName![0].toUpperCase();
    }
    if (username != null && username!.isNotEmpty) {
      return username![0].toUpperCase();
    }
    if (email != null && email!.isNotEmpty) {
      return email![0].toUpperCase();
    }
    return '?';
  }

  bool get isAdmin => realmRoles.contains('Admin');
  bool get isOwner => realmRoles.contains('Owner');
  bool get isCashier => realmRoles.contains('Cashier');

  factory AdminUser.fromJson(Map<String, dynamic> json) {
    return AdminUser(
      id: json['id'] as String,
      username: json['username'] as String?,
      email: json['email'] as String?,
      firstName: json['firstName'] as String?,
      lastName: json['lastName'] as String?,
      enabled: json['enabled'] as bool? ?? true,
      createdAt: json['createdTimestamp'] != null
          ? DateTime.fromMillisecondsSinceEpoch(json['createdTimestamp'] as int)
          : null,
      realmRoles: (json['realmRoles'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const [],
      branches: (json['branches'] as List<dynamic>?)?.map((e) => (e as num).toInt()).toList() ?? const [],
    );
  }
}
