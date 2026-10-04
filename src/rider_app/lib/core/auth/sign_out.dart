import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../features/deliveries/providers/deliveries_provider.dart';
import '../services/push_service.dart';
import 'auth_service.dart';

/// Signing out of the rider app: the till hears the rider is off duty, the
/// phone stops ringing for them, then the session ends. Each step is best
/// effort; signing out never waits on the network to be allowed.
Future<void> signOutRider(WidgetRef ref) async {
  if (ref.read(dutyProvider)) await ref.read(dutyProvider.notifier).set(false);
  await ref.read(pushServiceProvider).unregister();
  await ref.read(authServiceProvider.notifier).signOut();
}
