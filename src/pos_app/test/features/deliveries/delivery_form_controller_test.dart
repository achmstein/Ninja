import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_app_core/models/localized_text.dart';
import 'package:pos_app/features/call_centre/call_centre_mode.dart';
import 'package:pos_app/features/customers/services/customer_search_service.dart';
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

  /// What a number's earlier addresses are; a number not listed has the two spellings of one door
  final Map<String, List<KnownAddress>> knownBy = {};
  int sharesMade = 0;
  LocationShare share = const LocationShare();

  @override
  Future<LocationShareLink> createLocationShare() async {
    sharesMade++;
    return LocationShareLink('tok$sharesMade', DateTime.utc(2030));
  }

  @override
  Future<LocationShare> getLocationShare(String token) async => share;

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
    if (knownBy.containsKey(phone)) return knownBy[phone]!;
    return const [
      KnownAddress(address: 'Tahrir St', building: '12'),
      KnownAddress(address: 'tahrir st', building: '12', label: 'Home'),
    ];
  }

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

/// The customers the till's search finds for the digits typed, and the one the server pairs a whole number with
class _FakeCustomers implements CustomerSearchService, CounterCustomerService {
  List<IdentityUser> found = const [];
  IdentityUser? match;
  final List<String> searched = [];

  @override
  Future<List<IdentityUser>> search(String term, {int max = 20}) async {
    searched.add(term);
    return found;
  }

  @override
  Future<CustomerLookup> lookup({String? phone, String? name}) async => CustomerLookup(phone: phone ?? '', phoneValid: true, match: match);

  @override
  dynamic noSuchMethod(Invocation invocation) => throw UnimplementedError('${invocation.memberName}');
}

(ProviderContainer, _FakeRepository) _container({bool callCentre = false, _FakeCustomers? customers}) {
  final fake = _FakeRepository();
  final people = customers ?? _FakeCustomers();
  final container = ProviderContainer(overrides: [
    deliveryRepositoryProvider.overrideWithValue(fake),
    callCentreModeProvider.overrideWithValue(callCentre),
    customerSearchServiceProvider.overrideWithValue(people),
    counterCustomerServiceProvider.overrideWithValue(people),
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

    test('picked by name, a pin in another area is said beside it, never taken over', () async {
      final (container, fake) = _container();
      const inGarden = TillDeliveryQuote(delivers: true, fee: 15, latitude: 30.03, longitude: 31.23, zoneId: 12, zones: [degla, garden]);
      fake.answers[a] = inGarden;
      fake.zoneAnswers[11] = inDegla;
      final controller = container.read(deliveryFormControllerProvider.notifier);
      controller.pickZone(degla);
      await pumpEventQueue();
      await controller.readLocation(a);
      var state = container.read(deliveryFormControllerProvider);
      expect(state.zone?.zoneId, 11, reason: 'the area picked by name stands');
      expect(state.pinZone?.zoneId, 12);

      // The pin in the area picked: nothing to say
      controller.pickZone(garden);
      fake.zoneAnswers[12] = inGarden;
      await pumpEventQueue();
      await controller.readLocation(a);
      state = container.read(deliveryFormControllerProvider);
      expect(state.pinZone, isNull);
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

  test('the form opens where the call is: a sale that says who it is for is not asked again', () {
    expect(firstDeliveryStep(changing: false), DeliveryStep.who);
    expect(firstDeliveryStep(changing: false, customerName: 'Mona', customerPhone: '+201001234567'), DeliveryStep.where);
    // A name with no number, or half a number, still has the number to ask for
    expect(firstDeliveryStep(changing: false, customerName: 'Mona'), DeliveryStep.who);
    expect(firstDeliveryStep(changing: false, customerName: 'Mona', customerPhone: '0100123'), DeliveryStep.who);
    expect(firstDeliveryStep(changing: false, customerName: '  ', customerPhone: '01001234567'), DeliveryStep.who);
    // A delivery being changed has everything to look over
    expect(firstDeliveryStep(changing: true), DeliveryStep.check);
    expect(firstDeliveryStep(changing: true, customerName: 'Mona', customerPhone: '01001234567'), DeliveryStep.check);
  });

  group('who the number is', () {
    const mona = IdentityUser(id: 'u1', firstName: 'Mona', phoneNumber: '+201001234567');
    const omar = IdentityUser(id: 'u2', firstName: 'Omar', phoneNumber: '+201001239999');
    const off = IdentityUser(id: 'u3', firstName: 'Gone', phoneNumber: '+201001230000', enabled: false);
    const whole = '+201001234567';

    test('a few digits offer the customers whose numbers hold them; under five, nobody', () async {
      final people = _FakeCustomers()..found = const [mona, omar, off];
      final (container, _) = _container(customers: people);
      final controller = container.read(deliveryFormControllerProvider.notifier);

      await controller.lookUpCaller(typed: '0100', normalizedPhone: '', country: 'EG');
      expect(people.searched, isEmpty);
      expect(container.read(deliveryFormControllerProvider).suggestions, isEmpty);

      await controller.lookUpCaller(typed: '010012', normalizedPhone: '', country: 'EG');
      final state = container.read(deliveryFormControllerProvider);
      expect(people.searched, ['010012']);
      expect(state.suggestions.map((u) => u.id), ['u1', 'u2'], reason: 'an account switched off is not offered');
      expect(state.account, isNull);
      expect(state.callerFor(''), isNull);
    });

    test("an account's own number says the customer, and offers nobody else", () async {
      final people = _FakeCustomers()..found = const [omar, mona];
      final (container, _) = _container(customers: people);
      final controller = container.read(deliveryFormControllerProvider.notifier);
      await controller.lookUpCaller(typed: '01001234567', normalizedPhone: whole, country: 'EG');
      final state = container.read(deliveryFormControllerProvider);
      expect(state.account?.id, 'u1');
      expect(state.suggestions, isEmpty);
      expect(state.callerFor(whole), DeliveryCaller.customer);
    });

    test('a whole number with no account: delivered to before, or a new caller, once both answers are in', () async {
      final (container, fake) = _container();
      final controller = container.read(deliveryFormControllerProvider.notifier);
      fake.knownBy['+201110000000'] = const [];

      await controller.lookUpCaller(typed: '01001234567', normalizedPhone: whole, country: 'EG');
      expect(container.read(deliveryFormControllerProvider).callerFor(whole), isNull, reason: 'their earlier addresses are not in yet');
      await controller.lookUpKnown(customerUserId: null, normalizedPhone: whole);
      expect(container.read(deliveryFormControllerProvider).callerFor(whole), DeliveryCaller.calledBefore);

      // Another number: nothing is said of it on the strength of the last one's answer
      expect(container.read(deliveryFormControllerProvider).callerFor('+201110000000'), isNull);
      await controller.lookUpCaller(typed: '01110000000', normalizedPhone: '+201110000000', country: 'EG');
      await controller.lookUpKnown(customerUserId: null, normalizedPhone: '+201110000000');
      final state = container.read(deliveryFormControllerProvider);
      expect(state.known, isEmpty);
      expect(state.callerFor('+201110000000'), DeliveryCaller.newCaller);
    });

    test('a whole number the search did not pair is still the account the server reads it as', () async {
      final people = _FakeCustomers()..match = mona;
      final (container, _) = _container(customers: people);
      await container
          .read(deliveryFormControllerProvider.notifier)
          .lookUpCaller(typed: '01001234567', normalizedPhone: whole, country: 'EG');
      expect(container.read(deliveryFormControllerProvider).account?.id, 'u1');
    });

    test('typing on unsettles what was said until the new number is answered', () async {
      final (container, fake) = _container();
      final controller = container.read(deliveryFormControllerProvider.notifier);
      fake.knownBy[whole] = const [];
      await controller.lookUpCaller(typed: '01001234567', normalizedPhone: whole, country: 'EG');
      await controller.lookUpKnown(customerUserId: null, normalizedPhone: whole);
      expect(container.read(deliveryFormControllerProvider).callerFor(whole), DeliveryCaller.newCaller);

      controller.phoneChanged(customerUserId: null, normalizedPhone: '+201001234568', typed: '01001234568', country: 'EG');
      final state = container.read(deliveryFormControllerProvider);
      expect((state.searching, state.knownReading), (true, true));
      expect(state.callerFor('+201001234568'), isNull);
    });
  });

  group('location link', () {
    test("waits for the caller, then holds their point and stops asking", () async {
      final (container, fake) = _container();
      final controller = container.read(deliveryFormControllerProvider.notifier);
      final link = await controller.makeShareLink(poll: const Duration(hours: 1));
      expect(link?.token, 'tok1');
      expect(link?.url('https://cafe.example').toString(), 'https://cafe.example/l/tok1');
      expect(container.read(deliveryFormControllerProvider).shareWaiting, isTrue);

      await controller.readShare();
      expect(container.read(deliveryFormControllerProvider).shareWaiting, isTrue);

      fake.share = LocationShare(latitude: 30.05, longitude: 31.23, accuracyMeters: 12, sharedAt: DateTime.utc(2026, 11, 26));
      await controller.readShare();
      final state = container.read(deliveryFormControllerProvider);
      expect(state.shareWaiting, isFalse);
      expect(state.shared?.latitude, 30.05);
      expect(state.shareToken, 'tok1');
    });

    test('an expired link stops the waiting, and asking again makes a new one', () async {
      final (container, fake) = _container();
      final controller = container.read(deliveryFormControllerProvider.notifier);
      await controller.makeShareLink(poll: const Duration(hours: 1));
      fake.share = const LocationShare(expired: true);
      await controller.readShare();
      expect(container.read(deliveryFormControllerProvider).shareExpired, isTrue);
      expect(container.read(deliveryFormControllerProvider).shareWaiting, isFalse);

      fake.share = const LocationShare();
      await controller.makeShareLink(poll: const Duration(hours: 1));
      final state = container.read(deliveryFormControllerProvider);
      expect(state.shareToken, 'tok2');
      expect(state.shareExpired, isFalse);
      expect(state.shareWaiting, isTrue);
    });
  });
}
