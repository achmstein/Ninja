package com.ninja.rider

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

/**
 * The rider app's one activity. It makes the notification channel the
 * platform pushes on (a new delivery must ring, even with the app closed),
 * and answers the updater's calls (see AppUpdater).
 */
class MainActivity : FlutterActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createPushChannel()
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)
        // Updates from the platform's download page (see AppUpdater)
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "com.ninja.rider/update").setMethodCallHandler(AppUpdater(this))
    }

    /** The channel Notification.API names on every push: loud, on the lock screen */
    private fun createPushChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (manager.getNotificationChannel(PUSH_CHANNEL) != null) return
        val channel = NotificationChannel(PUSH_CHANNEL, "Deliveries", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "A delivery given to you, or taken back"
            enableVibration(true)
        }
        manager.createNotificationChannel(channel)
    }

    companion object {
        const val PUSH_CHANNEL = "high_priority_channel"
    }
}
