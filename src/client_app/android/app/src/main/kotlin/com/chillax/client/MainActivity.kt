package com.chillax.client

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Intent
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    companion object {
        var sessionChannel: MethodChannel? = null
        private var navigationChannel: MethodChannel? = null
    }

    private var notificationHelper: SessionNotificationHelper? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        createNotificationChannel()
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        notificationHelper = SessionNotificationHelper(this, flutterEngine)

        val channel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, SessionNotificationHelper.CHANNEL_NAME)
        sessionChannel = channel

        navigationChannel = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "com.chillax.client/navigation")

        channel.setMethodCallHandler { call, result ->
            when (call.method) {
                "show" -> {
                    try {
                        val args = call.arguments as? Map<*, *>
                        val placeName = call.argument<String>("placeName") ?: ""
                        val duration = call.argument<String>("duration") ?: ""
                        val startTimeMs = (args?.get("startTimeMs") as? Number)?.toLong()
                        val locale = call.argument<String>("locale") ?: "en"
                        val drink1Id = (args?.get("drink1Id") as? Number)?.toInt()
                        val drink1Name = call.argument<String>("drink1Name")
                        val drink2Id = (args?.get("drink2Id") as? Number)?.toInt()
                        val drink2Name = call.argument<String>("drink2Name")
                        notificationHelper?.show(placeName, duration, startTimeMs, locale,
                            drink1Id, drink1Name, drink2Id, drink2Name)
                        result.success(null)
                    } catch (e: Exception) {
                        result.error("SHOW_ERROR", e.message, null)
                    }
                }
                "dismiss" -> {
                    notificationHelper?.dismiss()
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }

        // Handle navigation from notification tap if app was launched with intent
        handleNavigationIntent(intent)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleNavigationIntent(intent)
    }

    private fun handleNavigationIntent(intent: Intent?) {
        val route = intent?.getStringExtra("navigate_to")
        if (route != null) {
            navigationChannel?.invokeMethod("navigateTo", route)
            // Clear the extra so it doesn't trigger again on config changes
            intent?.removeExtra("navigate_to")
        }
    }

    override fun onDestroy() {
        // Don't dismiss notification on destroy — the foreground service keeps it alive
        // Only clear the channel reference
        sessionChannel = null
        navigationChannel = null
        super.onDestroy()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                "high_priority_channel",
                "Chillax Notifications",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "Notifications for orders, rooms, and other updates"
                enableVibration(true)
                enableLights(true)
                setShowBadge(true)
            }

            val sessionChannel = NotificationChannel(
                "session_controls_channel",
                "Session Controls",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Ongoing notification with quick actions during active sessions"
                enableVibration(false)
                enableLights(false)
                setShowBadge(false)
                setSound(null, null)
            }

            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
            notificationManager.createNotificationChannel(sessionChannel)
        }
    }
}
