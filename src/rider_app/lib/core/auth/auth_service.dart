import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ninja_app_core/auth/auth_service.dart';

export 'package:ninja_app_core/auth/auth_service.dart';
export 'package:ninja_app_core/auth/pin_sign_in.dart';

/// The rider's gate, in the rider app's words: the account holds one of the
/// roles the backend's "Rider" policy accepts (Admin | Owner | Rider)
extension RiderAuthState on AuthState {
  bool get isRider => mayUseApp;
}

/// Provider for the rider gate (Admin | Owner | Rider)
final isRiderProvider = Provider<bool>((ref) => ref.watch(authServiceProvider).isRider);
