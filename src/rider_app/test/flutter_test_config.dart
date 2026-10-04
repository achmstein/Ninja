import 'dart:async';
import 'package:ninja_app_core/config.dart';
import 'package:rider_app/core/config/app_config.dart';

/// Every test runs in the rider app, as main() sets it up: the shared core
/// knows which app it is part of
Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  NinjaCore.configure(AppConfig.core);
  await testMain();
}
