import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ninja_app_core/auth/auth_service.dart';

export 'package:ninja_app_core/auth/auth_service.dart';

/// The till's gate, in its own words: the account holds one of the roles the
/// backend's "Pos" policy accepts (Admin | Owner | Cashier), the only gate the
/// till has
extension PosAuthState on AuthState {
  bool get isPosUser => mayUseApp;

  /// Owners hold every branch; anyone else needs at least one assigned
  bool get hasBranchAccess => isOwner || branches.isNotEmpty;
}

/// Provider for the till gate (Admin | Owner | Cashier)
final isPosUserProvider = Provider<bool>((ref) => ref.watch(authServiceProvider).isPosUser);
