import 'dart:async';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../features/deliveries/providers/deliveries_provider.dart';
import '../config/app_config.dart';
import '../services/push_service.dart';
import 'auth_service.dart';

/// Signing out of the rider app: the till hears the rider is off duty, the
/// phone stops ringing for them, then the session ends and nothing of theirs
/// stays on screen for whoever signs in next. Each network step is best
/// effort and time-boxed: signing out never waits long on the network.
Future<void> signOutRider(WidgetRef ref) async {
  Future<void> step(Future<void> Function() action) async {
    try {
      await action().timeout(AppConfig.signOutStepTimeout);
    } catch (_) {
      // Offline, or slow: the session ends regardless
    }
  }

  if (ref.read(dutyProvider).onDuty) await step(() => ref.read(dutyProvider.notifier).set(false));
  await step(() => ref.read(pushServiceProvider).unregister());
  await ref.read(authServiceProvider.notifier).signOut();

  // The next rider on this phone starts from nothing
  ref.invalidate(deliveriesProvider);
  ref.invalidate(deliveriesStaleSinceProvider);
  ref.invalidate(focusedDeliveryProvider);
  ref.invalidate(dutyProvider);
}
