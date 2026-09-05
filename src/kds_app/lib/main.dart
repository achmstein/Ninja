import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:wakelock_plus/wakelock_plus.dart';
import 'app.dart';
import 'core/demo/demo.dart';
import 'core/providers/branch_provider.dart';
import 'core/providers/locale_provider.dart';

void main() async {
  // Preserve the native splash screen
  WidgetsBinding widgetsBinding = WidgetsFlutterBinding.ensureInitialized();
  FlutterNativeSplash.preserve(widgetsBinding: widgetsBinding);

  // A kitchen display is a landscape tablet with nothing but the board on
  // it: no rotation, no system bars, and a screen that never dims mid-shift.
  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);
  await SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky);
  WakelockPlus.enable();

  // Initialize locale and branch before app starts
  await initializeLocale(override: kDemoMode ? kDemoLocale : null);
  await initializeBranch();

  runApp(
    ProviderScope(
      // Design-time mode swaps auth, branches and the board for samples
      overrides: kDemoMode ? demoOverrides : const [],
      child: const ChillaxKdsApp(),
    ),
  );
}
