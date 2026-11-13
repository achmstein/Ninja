import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:pos_app/features/call_centre/call_centre_mode.dart';
import 'package:pos_app/features/deliveries/models/delivery_order.dart';
import 'package:pos_app/features/deliveries/providers/delivery_form_controller.dart';
import 'package:pos_app/features/deliveries/services/delivery_service.dart';

/// Ordering's till quote: a pin per pasted text, or a failure
class _FakeRepository implements DeliveryRepository {
  final Map<String, TillDeliveryQuote> answers = {};
  final Set<String> failing = {};
  final List<String> asked = [];
  final List<int?> zonesAsked = [];
  final Map<int, TillDeliveryQuote> zoneAnswers = {};
  final List<bool> everyBranchAsked = [];

  @override
  Future<TillDeliveryQuote> tillQuote({String? location, int? zoneId}) async {
    final text = location ?? '';
    asked.add(text);
    zonesAsked.add(zoneId);
    if (zoneId != null && zoneAnswers.containsKey(zoneId)) return zoneAnswers[zoneId]!;
    if (failing.contains(text)) throw DioException.connectionError(requestOptions: RequestOptions(path: '/'), reason: 'blip');
    return answers[text] ?? const TillDeliveryQuote(delivers: true);
  }

  @override
  Future<List<KnownAddress>> knownAddresses({String? customerUserId, String? phone, bool everyBranch = false}) async {
    everyBranchAsked.add(everyBranch);
    return const [
      KnownAddress(address: 'Tahrir St', building: '12'),
      KnownAddress(address: 'tahrir st', building: '12', label: 'Home'),
    ];
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

(ProviderContainer, _FakeRepository) _container({bool callCentre = false}) {
  final fake = _FakeRepository();
  final container = ProviderContainer(overrides: [
    deliveryRepositoryProvider.overrideWithValue(fake),
    callCentreModeProvider.overrideWithValue(callCentre),
  ]);
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

  group('a named area', () {
    const degla = DeliveryZone(zoneId: 11, branchId: 1, name: LocalizedText(en: 'Maadi Degla'), fee: 35, minimumOrder: 150, etaMinutes: 40);
    const garden = DeliveryZone(zoneId: 12, branchId: 1, name: LocalizedText(en: 'Garden City'), fee: 15);
    const plain = TillDeliveryQuote(delivers: true, fee: 20, zones: [degla, garden]);
    const inDegla = TillDeliveryQuote(delivers: true, fee: 35, minimumOrder: 150, zoneId: 11, etaMinutes: 40, zones: [degla, garden]);

    test("picked by name asks the branch again for that area's fee and minimum; cleared, the branch's own", () async {
      final (container, fake) = _container();
      fake.answers[''] = plain;
      fake.zoneAnswers[11] = inDegla;
      final controller = container.read(deliveryFormControllerProvider.notifier);
      await controller.readLocation('');
      expect(container.read(deliveryFormControllerProvider).zone, isNull);

      controller.pickZone(degla);
      expect(container.read(deliveryFormControllerProvider).reading, isTrue);
      expect(container.read(deliveryFormControllerProvider).zone?.zoneId, 11, reason: 'shown at once, before the answer');
      await pumpEventQueue();
      var state = container.read(deliveryFormControllerProvider);
      expect(fake.zonesAsked.last, 11);
      expect(state.reading, isFalse);
      expect((state.quote?.fee, state.quote?.minimumOrder, state.zone?.etaMinutes), (35, 150, 40));

      controller.pickZone(null);
      await pumpEventQueue();
      state = container.read(deliveryFormControllerProvider);
      expect(fake.zonesAsked.last, isNull);
      expect(state.zone, isNull);
      expect(state.quote?.fee, 20);
    });

    test('a pin that falls in a drawn area pre-selects it, with no pick', () async {
      final (container, fake) = _container();
      fake.answers[a] = const TillDeliveryQuote(
          delivers: true, fee: 35, latitude: 30.1, longitude: 31.1, zoneId: 11, zones: [degla, garden]);
      final controller = container.read(deliveryFormControllerProvider.notifier);
      await controller.readLocation(a);
      final state = container.read(deliveryFormControllerProvider);
      expect(state.picked, isNull);
      expect(state.zone?.zoneId, 11);
      expect(fake.zonesAsked, [null]);
    });

    test('a pin in an area that is switched off selects nothing: that takes the cashier own taps', () async {
      final (container, fake) = _container();
      const off = DeliveryZone(zoneId: 13, branchId: 1, name: LocalizedText(en: 'Zamalek'), fee: 50, on: false);
      fake.answers[a] = const TillDeliveryQuote(
          delivers: true, fee: 50, latitude: 30.1, longitude: 31.1, zoneId: 13, zoneOff: true, zones: [degla, off]);
      fake.zoneAnswers[13] = fake.answers[a]!;
      final controller = container.read(deliveryFormControllerProvider.notifier);
      controller.locationChanged(a, debounce: const Duration(hours: 1));
      await controller.readLocation(a);
      var state = container.read(deliveryFormControllerProvider);
      expect(state.zone, isNull);
      expect(state.pinInOffArea, isTrue);

      controller.pickZone(off);
      await pumpEventQueue();
      state = container.read(deliveryFormControllerProvider);
      expect(state.zone?.zoneId, 13);
      expect(state.pinInOffArea, isFalse);
    });

    test('an area the sale already goes to stays picked, and one the owner took off is dropped', () async {
      final (container, fake) = _container();
      fake.zoneAnswers[11] = inDegla;
      final controller = container.read(deliveryFormControllerProvider.notifier);
      controller.locationChanged('', debounce: const Duration(hours: 1), startWith: degla);
      await controller.readLocation('');
      expect(fake.zonesAsked.last, 11);
      expect(container.read(deliveryFormControllerProvider).zone?.zoneId, 11);

      fake.zoneAnswers[11] = const TillDeliveryQuote(delivers: true, fee: 20, zones: [garden]);
      await controller.readLocation('');
      final state = container.read(deliveryFormControllerProvider);
      expect(state.zone, isNull);
      expect(state.quote?.fee, 20);
    });
  });

  test("the caller's earlier addresses are each door once", () async {
    final (container, _) = _container();
    await container.read(deliveryFormControllerProvider.notifier).lookUpKnown(customerUserId: null, normalizedPhone: '01001234567');
    expect(container.read(deliveryFormControllerProvider).known, hasLength(1));
  });

  test("the call centre asks for every branch's earlier deliveries, a branch till for its own", () async {
    final (branchTill, atBranch) = _container();
    await branchTill.read(deliveryFormControllerProvider.notifier).lookUpKnown(customerUserId: null, normalizedPhone: '01001234567');
    final (hotline, atHotline) = _container(callCentre: true);
    await hotline.read(deliveryFormControllerProvider.notifier).lookUpKnown(customerUserId: null, normalizedPhone: '01001234567');

    expect(atBranch.everyBranchAsked, [false]);
    expect(atHotline.everyBranchAsked, [true]);
  });
}
