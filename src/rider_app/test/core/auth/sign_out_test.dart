import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rider_app/core/auth/auth_service.dart';
import 'package:rider_app/core/auth/sign_out.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import 'package:rider_app/core/services/push_service.dart';
import 'package:rider_app/features/deliveries/models/delivery_order.dart';
import 'package:rider_app/features/deliveries/providers/deliveries_provider.dart';
import 'package:rider_app/features/deliveries/services/delivery_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FakeAuth extends AuthService {
  bool signedOut = false;

  @override
  AuthState build() => const AuthState(isInitializing: false, isAuthenticated: true, mayUseApp: true, userId: 'rider-1', roles: ['Rider'], branches: [1]);

  @override
  Future<void> initialize() async {}

  @override
  Future<void> signOut() async {
    signedOut = true;
    state = const AuthState(isInitializing: false);
  }
}

class _FakePush implements PushService {
  bool unregistered = false;

  @override
  Future<void> unregister() async => unregistered = true;

  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}

/// Ordering that never answers duty: sign-out must not wait on it
class _SlowDeliveries implements DeliveryService {
  @override
  Future<List<DeliveryOrder>> mine() async => [];

  @override
  Future<void> setOnDuty(bool onDuty) => Future<void>.delayed(const Duration(minutes: 1));

  @override
  dynamic noSuchMethod(Invocation invocation) => null;
}

void main() {
  testWidgets('signing out ends the session even when the till never answers, and leaves nothing of the rider', (tester) async {
    SharedPreferences.setMockInitialValues({'rider_on_duty:rider-1': true});
    await initializeBranch();
    final auth = _FakeAuth();
    final push = _FakePush();
    late WidgetRef captured;
    await tester.pumpWidget(ProviderScope(
      overrides: [
        authServiceProvider.overrideWith(() => auth),
        pushServiceProvider.overrideWithValue(push),
        deliveryServiceProvider.overrideWithValue(_SlowDeliveries()),
        selectedBranchIdProvider.overrideWithValue(1),
      ],
      child: Consumer(builder: (context, ref, _) {
        captured = ref;
        ref.watch(dutyProvider);
        return const SizedBox();
      }),
    ));
    await tester.pump();

    final done = signOutRider(captured);
    // The duty call never answers; the step gives up on its own
    await tester.pump(const Duration(seconds: 6));
    await tester.pump(const Duration(seconds: 6));
    await done;

    expect(auth.signedOut, isTrue);
    expect(push.unregistered, isTrue);
    expect(captured.read(dutyProvider).onDuty, isFalse);

    // Let the never-answering call run out before the test ends
    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(minutes: 2));
  });
}
