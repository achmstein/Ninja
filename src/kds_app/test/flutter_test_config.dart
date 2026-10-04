import 'dart:async';
import 'package:kds_app/core/config/app_config.dart';
import 'package:ninja_app_core/config.dart';

/// Every test runs in the kitchen display, as main() sets it up: the shared
/// core knows which app it is part of
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  NinjaCore.configure(AppConfig.core);
  await testMain();
}
