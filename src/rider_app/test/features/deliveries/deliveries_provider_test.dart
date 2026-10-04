import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:rider_app/core/auth/auth_service.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import 'package:rider_app/features/deliveries/models/delivery_order.dart';
import 'package:rider_app/features/deliveries/providers/deliveries_provider.dart';
import 'package:rider_app/features/deliveries/services/delivery_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _FakeAuth extends AuthService {
  final String userId;
  _FakeAuth(this.userId);

  @override
  AuthState build() => AuthState(isInitializing: false, isAuthenticated: true, mayUseApp: true, userId: userId, roles: const ['Rider'], branches: const [1]);

  @override
  Future<void> initialize() async {}
}

/// Ordering as the rider app sees it: what it answers, and what it was told
class _FakeDeliveries implements DeliveryService {
  List<DeliveryOrder> orders = [];
  bool fail = false;
  bool failDuty = false;
  final List<String> calls = [];

  DioException get _down => DioException.connectionError(requestOptions: RequestOptions(path: '/'), reason: 'down');

  @override
  Future<List<DeliveryOrder>> mine() async {
    if (fail) throw _down;
    return orders;
  }

  @override
  Future<void> markOut(int orderId) async => calls.add('out $orderId');

  @override
  Future<void> markDelivered(int orderId) async => calls.add('delivered $orderId');

  @override
  Future<void> markFailed(int orderId, String reason) async => calls.add('failed $orderId $reason');

  @override
  Future<void> setOnDuty(bool onDuty) async {
    if (failDuty) throw _down;
    calls.add('duty $onDuty');
  }
}

DeliveryOrder _order(int id, {String stage = 'Assigned'}) => DeliveryOrder.fromJson({
      'orderNumber': id,
      'total': 100,
      'delivery': {'address': 'Tahrir St', 'phone': '01001234567', 'stage': stage},
    });

Future<(ProviderContainer, _FakeDeliveries)> _container({String userId = 'rider-1', Map<String, Object> prefs = const {}}) async {
  SharedPreferences.setMockInitialValues(prefs);
  await initializeBranch();
  final fake = _FakeDeliveries();
  final container = ProviderContainer(overrides: [
    authServiceProvider.overrideWith(() => _FakeAuth(userId)),
    deliveryServiceProvider.overrideWithValue(fake),
    selectedBranchIdProvider.overrideWithValue(1),
  ]);
  addTearDown(container.dispose);
  return (container, fake);
}

void main() {
  group('the list', () {
    test('a failed refresh keeps what was shown and says since when', () async {
      final (container, fake) = await _container();
      fake.orders = [_order(1)];
      await container.read(deliveriesProvider.future);
      expect(container.read(deliveriesStaleSinceProvider), isNull);

      fake.fail = true;
      await container.read(deliveriesProvider.notifier).refresh();
      expect(container.read(deliveriesProvider).value!.toGo.single.orderNumber, 1);
      expect(container.read(deliveriesStaleSinceProvider), isNotNull);

      fake.fail = false;
      await container.read(deliveriesProvider.notifier).refresh();
      expect(container.read(deliveriesStaleSinceProvider), isNull);
    });

    test("couldn't deliver sends the reason and fetches again", () async {
      final (container, fake) = await _container();
      fake.orders = [_order(7, stage: 'OnTheWay')];
      await container.read(deliveriesProvider.future);
      fake.orders = [_order(7, stage: 'Failed')];
      await container.read(deliveriesProvider.notifier).markFailed(7, 'NoAnswer');
      expect(fake.calls, ['failed 7 NoAnswer']);
      expect(container.read(deliveriesProvider).value!.toGo.single.isFailed, isTrue);
    });
  });

  group('duty', () {
    test('a switch the till hears is kept for this rider', () async {
      final (container, fake) = await _container();
      container.read(dutyProvider);
      await container.read(dutyProvider.notifier).set(true);
      expect(container.read(dutyProvider).onDuty, isTrue);
      expect(container.read(dutyProvider).pending, isFalse);
      expect(fake.calls, contains('duty true'));
      final prefs = await SharedPreferences.getInstance();
      expect(prefs.getBool('rider_on_duty:rider-1'), isTrue);
    });

    test('a switch the till does not hear goes back, and says so', () async {
      final (container, fake) = await _container();
      container.read(dutyProvider);
      fake.failDuty = true;
      await expectLater(container.read(dutyProvider.notifier).set(true), throwsA(isA<DioException>()));
      expect(container.read(dutyProvider).onDuty, isFalse);
      expect(container.read(dutyProvider).pending, isFalse);
    });

    test("another rider on the same phone does not inherit the first one's duty", () async {
      final (container, _) = await _container(userId: 'rider-2', prefs: {'rider_on_duty:rider-1': true});
      container.read(dutyProvider);
      await Future<void>.delayed(Duration.zero);
      expect(container.read(dutyProvider).onDuty, isFalse);
    });
  });
}
