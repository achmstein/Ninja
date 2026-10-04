import 'dart:async';
import 'package:ninja_app_core/config.dart';

/// The core's own tests run as an app that signs in with a password and
/// updates over https with a checksum
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  NinjaCore.configure(const NinjaAppConfig(
    appKey: 'test',
    clientId: 'test-app',
    scopes: ['openid', 'roles', 'branches', 'offline_access'],
    allowedRoles: ['Admin', 'Owner', 'Cashier'],
    update: UpdateConfig(channel: 'com.ninja.test/update', file: 'ninja-test'),
  ));
  await testMain();
}
