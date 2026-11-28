import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:ninja_staff_ui/kiosk_service.dart';
import 'package:shared_preferences/shared_preferences.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test("keeps each app's choice under its own key and asks its own channel", () async {
    SharedPreferences.setMockInitialValues({'kds.kiosk.enabled': true});
    final calls = <String>[];
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger.setMockMethodCallHandler(
      const MethodChannel('com.ninja.kds/kiosk'),
      (call) async {
        calls.add(call.method);
        return call.method == 'isDeviceOwner';
      },
    );

    final kitchen = await KioskService('kds').status();
    expect(kitchen.enabled, isTrue);
    expect(kitchen.isDeviceOwner, isTrue);
    expect(calls, containsAll(['isDeviceOwner', 'isInLockTask']));

    // The till's choice is its own, and with no channel answering it is simply off
    final till = await KioskService('pos').status();
    expect(till.enabled, isFalse);
    expect(till.isDeviceOwner, isFalse);
  });
}
