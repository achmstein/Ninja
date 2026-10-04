import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/features/deliveries/models/delivery_order.dart';
import 'package:pos_app/features/deliveries/providers/delivery_form_controller.dart';
import 'package:pos_app/features/deliveries/services/delivery_service.dart';

/// Ordering's till quote: a pin per pasted text, or a failure
class _FakeRepository implements DeliveryRepository {
  final Map<String, TillDeliveryQuote> answers = {};
  final Set<String> failing = {};
  final List<String> asked = [];

  @override
  Future<TillDeliveryQuote> tillQuote({String? location}) async {
    final text = location ?? '';
    asked.add(text);
    if (failing.contains(text)) throw DioException.connectionError(requestOptions: RequestOptions(path: '/'), reason: 'blip');
    return answers[text] ?? const TillDeliveryQuote(delivers: true);
  }

  @override
  Future<List<KnownAddress>> knownAddresses({String? customerUserId, String? phone}) async => const [
        KnownAddress(address: 'Tahrir St', building: '12'),
        KnownAddress(address: 'tahrir st', building: '12', label: 'Home'),
      ];

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

(ProviderContainer, _FakeRepository) _container() {
  final fake = _FakeRepository();
  final container = ProviderContainer(overrides: [deliveryRepositoryProvider.overrideWithValue(fake)]);
  addTearDown(container.dispose);
  // Keep the auto-disposed controller alive for the test
  container.listen(deliveryFormControllerProvider, (_, _) {});
  return (container, fake);
}

void main() {
  const a = 'https://maps.app.goo.gl/AAA';
  const b = 'https://maps.app.goo.gl/BBB';

  test("a pin belongs to the text it answered, never to the next one's", () async {
    final (container, fake) = _container();
    fake.answers[a] = const TillDeliveryQuote(delivers: true, latitude: 30.1, longitude: 31.1);
    fake.failing.add(b);
    final controller = container.read(deliveryFormControllerProvider.notifier);

    await controller.readLocation(a);
    expect(container.read(deliveryFormControllerProvider).pinFor(a), (latitude: 30.1, longitude: 31.1));

    // Link B pasted, and the network blips: A's pin must not travel with B's text
    controller.locationChanged(b, debounce: const Duration(hours: 1));
    expect(container.read(deliveryFormControllerProvider).pinFor(b), isNull);
    await controller.readLocation(b);
    final state = container.read(deliveryFormControllerProvider);
    expect(state.pinFor(b), isNull);
    expect(state.quoteFailed, isTrue);
  });

  test('moving the cursor or selecting is not new text, and is not asked about again', () {
    final (container, _) = _container();
    final controller = container.read(deliveryFormControllerProvider.notifier);
    controller.locationChanged(a, debounce: const Duration(hours: 1));
    expect(container.read(deliveryFormControllerProvider).reading, isTrue);
    controller.locationChanged(' $a ', debounce: const Duration(hours: 1));
    controller.locationChanged(a, debounce: const Duration(hours: 1));
    // Still the one ask pending, for the same text
    expect(container.read(deliveryFormControllerProvider).reading, isTrue);
  });

  test("a later answer for an older text does not overwrite the newer one's", () async {
    final (container, fake) = _container();
    fake.answers[a] = const TillDeliveryQuote(delivers: true, latitude: 30.1, longitude: 31.1);
    fake.answers[b] = const TillDeliveryQuote(delivers: true, latitude: 30.2, longitude: 31.2);
    final controller = container.read(deliveryFormControllerProvider.notifier);
    final first = controller.readLocation(a);
    final second = controller.readLocation(b);
    await Future.wait([first, second]);
    expect(container.read(deliveryFormControllerProvider).pinFor(b), (latitude: 30.2, longitude: 31.2));
    expect(container.read(deliveryFormControllerProvider).pinFor(a), isNull);
  });

  test("the caller's earlier addresses are each door once", () async {
    final (container, _) = _container();
    await container.read(deliveryFormControllerProvider.notifier).lookUpKnown(customerUserId: null, normalizedPhone: '01001234567');
    expect(container.read(deliveryFormControllerProvider).known, hasLength(1));
  });
}
