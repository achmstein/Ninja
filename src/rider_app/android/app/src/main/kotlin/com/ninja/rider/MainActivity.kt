package com.ninja.rider

import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * The rider app's one activity: it answers the updater's calls (see
 * AppUpdater). The push channel is made with the process (RiderApplication).
 */
class MainActivity : FlutterActivity() {
    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // Updates from the platform's download page (see AppUpdater)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "com.ninja.rider/update").setMethodCallHandler(AppUpdater(this))
    }
}
