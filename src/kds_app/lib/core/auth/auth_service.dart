import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ninja_app_core/auth/auth_service.dart';

export 'package:ninja_app_core/auth/auth_service.dart';

/// The kitchen display's gate, in its own words: the account holds one of the
/// roles the backend's "Pos" policy accepts, or the kitchen's own account
/// (Admin | Owner | Cashier | Kitchen)
extension PosAuthState on AuthState {
  bool get isPosUser => mayUseApp;
}

/// Provider for the kitchen display's gate
final isPosUserProvider = Provider<bool>((ref) => ref.watch(authServiceProvider).isPosUser);
