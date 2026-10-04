import 'dart:ui' show PlatformDispatcher;

import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_native_splash/flutter_native_splash.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:ninja_app_core/config.dart';
import 'app.dart';
import 'core/config/app_config.dart';
import 'package:ninja_app_core/brand/brand_provider.dart';
import 'package:ninja_app_core/tenant_connection.dart';
import 'package:ninja_app_core/providers/branch_provider.dart';
import 'package:ninja_app_core/providers/locale_provider.dart';
import 'core/services/push_service.dart';
import 'features/connect/connect_screen.dart';

void main() async {
  // Preserve the native splash screen
  WidgetsBinding widgetsBinding = WidgetsFlutterBinding.ensureInitialized();
  FlutterNativeSplash.preserve(widgetsBinding: widgetsBinding);

  // The shared core learns which app it runs in before anything reads it
  NinjaCore.configure(AppConfig.core);

  // A rider's phone, held upright on a bike mount or in a hand
  await SystemChrome.setPreferredOrientations([DeviceOrientation.portraitUp]);

  // Initialize locale and branch before app starts
  await initializeLocale();
  await initializeBranch();
  await initializeBrand();
  // Which business this phone serves; the connect screen asks when none is known
  await TenantConnection.initialize();

  // Crash reports and pushes ride on the Firebase project. Without
  // google-services.json (the app not yet registered in the Firebase
  // console) initializeApp throws and the app runs without either: the
  // live hub and the poll still bring the deliveries.
  try {
    await Firebase.initializeApp();
    FlutterError.onError = FirebaseCrashlytics.instance.recordFlutterFatalError;
    PlatformDispatcher.instance.onError = (error, stack) {
      FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
      return true;
    };
    FirebaseMessaging.onBackgroundMessage(firebaseBackgroundHandler);
  } catch (_) {
    // Not configured yet
  }

  runApp(
    // Until the phone is connected to a business the connect screen is the app
    ConnectGate(
      child: () => const ProviderScope(child: NinjaRiderApp()),
    ),
  );
}
