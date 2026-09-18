import 'dart:ui' show PlatformDispatcher;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import 'app.dart';
import 'core/demo/demo.dart';
import 'core/offline/offline_queue.dart';
import 'core/printing/printer_settings.dart';
import 'core/providers/branch_provider.dart';
import 'core/providers/locale_provider.dart';
import 'features/sale/providers/sale_provider.dart';

void main() async {
  // Preserve the native splash screen
  WidgetsBinding widgetsBinding = WidgetsFlutterBinding.ensureInitialized();
  FlutterNativeSplash.preserve(widgetsBinding: widgetsBinding);

  // A till is a landscape tablet with nothing but the till on it: no
  // rotation, no system bars, and a screen that never dims mid-shift.
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  WakelockPlus.enable();

  // Initialize locale and branch before app starts
  await initializeLocale(override: kDemoMode ? kDemoLocale : null);
  await initializeBranch();
  await initializePrinterSettings();
  await initializeSale();
  await initializeOfflineQueue();

  // A till that crashes costs money: every Flutter and async error goes to
  // Crashlytics. Without google-services.json (the app not yet registered
  // in the Firebase console) initializeApp throws and the app runs
  // without crash reporting, as it always did.
  try {
    await Firebase.initializeApp();
    FlutterError.onError = FirebaseCrashlytics.instance.recordFlutterFatalError;
    PlatformDispatcher.instance.onError = (error, stack) {
      FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
      return true;
    };
  } catch (_) {
    // Not configured yet
  }

  runApp(
    ProviderScope(
      // Design-time mode swaps auth, branches and tickets for samples
      overrides: kDemoMode ? demoOverrides : const [],
      child: const ChillaxPosApp(),
    ),
  );
}
