import 'package:flutter_test/flutter_test.dart';
import 'package:pos_app/core/business_data.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  test('a tablet moved to another business forgets the last one, and keeps what is the tablet\'s own', () async {
    SharedPreferences.setMockInitialValues({
      'pos_cashier_roster': '[{"username":"mona@old","name":"Mona"}]',
      'ninja-pos-sale': '{}',
      'ninja-pos-call-centre': true,
      'pos.offline.next': 7,
      'pos.catalog.items.1': '[]',
      'pos.catalog.categories.2': '[]',
      'pos.pricing.1': '{}',
      'pos.printer.host': '192.168.1.50',
      'pos.kiosk.enabled': true,
      'pos_device_mode': 'tablet',
      'pos.device.id': 'abc',
    });

    await forgetBusinessData();

    final prefs = await SharedPreferences.getInstance();
    expect(prefs.getKeys(), {'pos.printer.host', 'pos.kiosk.enabled', 'pos_device_mode', 'pos.device.id'});
  });

  test('sales not sent yet are counted, so the tablet stays with the business it owes them to', () async {
    SharedPreferences.setMockInitialValues({});
    expect(await unsentToBusiness(), 0);

    SharedPreferences.setMockInitialValues({'pos.offline.sales': '[{"id":"a"},{"id":"b"}]', 'pos.sending': '[{"id":"c"}]'});
    expect(await unsentToBusiness(), 3);

    SharedPreferences.setMockInitialValues({'pos.offline.sales': 'not json'});
    expect(await unsentToBusiness(), 1, reason: 'unreadable is not empty');
  });
}
