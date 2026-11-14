import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_client/core/config/app_config.dart';

void main() {
  test('Powered by ninja opens the platform site and says which business sent the visitor', () {
    expect(
      AppConfig.platformSiteFor('https://auth.ninjapp.net', 'mellow').toString(),
      'https://ninjapp.net/?ref=mellow&utm_medium=guest-app',
    );
  });

  test('a dev machine has no platform site to open', () {
    expect(AppConfig.platformSiteFor('http://localhost:8080/auth', 'mellow'), isNull);
  });
}
