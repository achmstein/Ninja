package com.ninja.pos

import android.app.ActivityManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import android.content.pm.ActivityInfo
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * Kiosk (lock-task) support. Once the tablet is provisioned with this app
 * as device owner (`adb shell dpm set-device-owner
 * com.ninja.pos/.PosDeviceAdminReceiver` on a freshly reset device), the
 * till can pin itself: Home, Recents and the notification shade are gone
 * until the app unpins. Without device-owner rights the same call only
 * shows Android's screen-pinning prompt, so the Dart side asks first.
 */
class MainActivity : FlutterActivity() {
    private val channelName = "com.ninja.pos/kiosk"

    /**
     * Which way the till is held is settled here, before the first thing is
     * drawn: a tablet lies on its side, a phone stands upright. Left to the
     * Dart side, the window opened whichever way the device happened to be
     * and turned a moment later, and a tablet showed the phone's screens
     * until it had. The Dart side asks the same question of this activity
     * (lib/core/layout/device_mode.dart) and so always agrees with it.
     */
    override fun onCreate(savedInstanceState: Bundle?) {
        requestedOrientation =
            if (runsAsPhone()) ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
            else ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        super.onCreate(savedInstanceState)
    }

    /** Android's own line between a phone and a tablet: a smallest width of 600 dp. */
    private fun screenIsPhone(): Boolean = resources.configuration.smallestScreenWidthDp < 600

    /** The screen's answer, unless the till's settings say otherwise (Screen layout, kept by the Dart side). */
    private fun runsAsPhone(): Boolean =
        when (getSharedPreferences("FlutterSharedPreferences", Context.MODE_PRIVATE).getString("flutter.pos_device_mode", null)) {
            "phone" -> true
            "tablet" -> false
            else -> screenIsPhone()
        }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "com.ninja.pos/device").setMethodCallHandler { call, result ->
            if (call.method == "isPhone") result.success(screenIsPhone()) else result.notImplemented()
        }
        // Updates from the platform's download page (see AppUpdater)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "com.ninja.pos/update").setMethodCallHandler(AppUpdater(this))
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName).setMethodCallHandler { call, result ->
            val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val admin = ComponentName(this, PosDeviceAdminReceiver::class.java)
            when (call.method) {
                "isDeviceOwner" -> result.success(dpm.isDeviceOwnerApp(packageName))
                "isInLockTask" -> {
                    val am = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
                    result.success(am.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE)
                }
                "startLockTask" -> {
                    if (dpm.isDeviceOwnerApp(packageName)) {
                        // Only this app may be pinned; the keyguard and the
                        // status bar stay off while it is
                        dpm.setLockTaskPackages(admin, arrayOf(packageName))
                    }
                    try {
                        startLockTask()
                        result.success(true)
                    } catch (e: Exception) {
                        result.error("lock_task", e.message, null)
                    }
                }
                "stopLockTask" -> {
                    try {
                        stopLockTask()
                        result.success(true)
                    } catch (e: Exception) {
                        result.error("lock_task", e.message, null)
                    }
                }
                else -> result.notImplemented()
            }
        }
    }
}
