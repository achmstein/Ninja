import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_app_core/config.dart';
import 'package:ninja_app_core/services/hub_client.dart';

void main() {
  test('an update is strict unless the app says otherwise', () {
    const update = UpdateConfig(channel: 'c', file: 'f');
    expect(update.enabled, isTrue);
    expect(update.requireChecksum, isTrue, reason: 'a release without its checksum is not taken');
    expect(update.httpsOnly, isTrue, reason: 'nothing is fetched over plain http');
    expect(update.silentKioskInstall, isFalse, reason: 'only a kiosk tablet installs without asking');
    expect(update.quietWindow, const Duration(minutes: 3));
  });

  test('the password form is allowed unless the app says otherwise', () {
    const config = NinjaAppConfig(
      appKey: 'a',
      clientId: 'a-app',
      scopes: [],
      allowedRoles: ['Admin'],
      update: UpdateConfig(channel: 'c', file: 'f'),
    );
    expect(config.passwordSignIn, isTrue);
    expect(config.signOutStepTimeout, isNull, reason: 'waits as long as the request does');
  });

  test('the configured app is the one the core reads', () {
    // flutter_test_config.dart configured the test app
    expect(NinjaCore.config.appKey, 'test');
    expect(NinjaCore.config.allowedRoles, contains('Cashier'));
  });

  test('the hub gives a stream for each event the app named, and refuses any other', () {
    final container = ProviderContainer();
    addTearDown(container.dispose);
    final hub = container.read(Provider<HubClient>((ref) => HubClient(ref, const ['DeliveryChanged'])));
    addTearDown(hub.dispose);

    expect(hub.on('DeliveryChanged'), isA<Stream<Map<String, dynamic>>>());
    expect(() => hub.on('OrderStatusChanged'), throwsArgumentError);
  });
}
