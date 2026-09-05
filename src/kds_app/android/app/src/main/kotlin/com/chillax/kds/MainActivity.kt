package com.chillax.kds

import android.app.ActivityManager
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Context
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * Kiosk (lock-task) support. Once the tablet is provisioned with this app
 * as device owner (`adb shell dpm set-device-owner
 * com.chillax.kds/.KdsDeviceAdminReceiver` on a freshly reset device), the
 * display can pin itself: Home, Recents and the notification shade are gone
 * until the app unpins. Without device-owner rights the same call only
 * shows Android's screen-pinning prompt, so the Dart side asks first.
 */
class MainActivity : FlutterActivity() {
    private val channelName = "com.chillax.kds/kiosk"

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, channelName).setMethodCallHandler { call, result ->
            val dpm = getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val admin = ComponentName(this, KdsDeviceAdminReceiver::class.java)
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
