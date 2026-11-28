package com.chillax.client

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.UiModeManager
import android.content.Intent
import android.os.Build
import android.os.Bundle
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {
    companion object {
        const val EXTRA_SESSION_ACTION = "session_action"
        var sessionChannel: MethodChannel? = null

        /** The delivery card's line to Flutter; null while no engine is up. */
        var deliveryChannel: MethodChannel? = null

        /** A tap on the delivery card that opened the app before Flutter was listening: asked for once it is. */
        private var pendingDeliveryAction: Map<String, Any>? = null
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

        // The customer's live delivery card: Flutter hands over what it reads, the card draws itself
        val delivery = MethodChannel(flutterEngine.dartExecutor.binaryMessenger, DeliveryCard.CHANNEL_NAME)
        deliveryChannel = delivery
        delivery.setMethodCallHandler { call, result ->
            val args = call.arguments as? Map<*, *> ?: emptyMap<Any, Any>()
            when (call.method) {
                "configure" -> {
                    DeliveryCard.configure(applicationContext, args)
                    // A tap that opened the app before Flutter was listening
                    pendingDeliveryAction?.let { sendDeliveryAction(it) }
                    result.success(null)
                }
                "show" -> {
                    DeliveryCard.apply(applicationContext, args.entries.associate { it.key.toString() to it.value })
                    result.success(null)
                }
                "dismiss" -> {
                    DeliveryCard.dismiss(applicationContext)
                    result.success(null)
                }
                else -> result.notImplemented()
            }
        }

        // The app's own light or dark (the person's choice, else the business's starting theme),
        // kept by the system for the app: from Android 12 the next launch screen is drawn in it
        // rather than in the phone's mode. uiMode is in the manifest's configChanges, so the
        // change reaches Flutter without recreating the activity
        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, "com.chillax.client/theme").setMethodCallHandler { call, result ->
            if (call.method != "setNightMode") return@setMethodCallHandler result.notImplemented()
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                val mode = when (call.arguments as? String) {
                    "light" -> UiModeManager.MODE_NIGHT_NO
                    "dark" -> UiModeManager.MODE_NIGHT_YES
                    else -> UiModeManager.MODE_NIGHT_AUTO
                }
                // The app asks only when its theme changes; the system keeps it across launches
                getSystemService(UiModeManager::class.java).setApplicationNightMode(mode)
            }
            result.success(null)
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

        // A drink button on the session notification: the app is open now, and asks before it orders
        val action = intent?.getStringExtra(EXTRA_SESSION_ACTION)
        if (action != null) {
            sessionChannel?.invokeMethod("onAction", action)
            intent?.removeExtra(EXTRA_SESSION_ACTION)
        }

        // A button on the delivery card that needs the app: "I'm coming down" with a stale sign-in, or Rate
        val deliveryAction = intent?.getStringExtra(DeliveryCard.EXTRA_ACTION)
        if (deliveryAction != null) {
            sendDeliveryAction(mapOf("action" to deliveryAction, "orderId" to (intent?.getLongExtra(DeliveryCard.EXTRA_ORDER_ID, -1) ?: -1L)))
            intent?.removeExtra(DeliveryCard.EXTRA_ACTION)
        }
    }

    /** Hands a card tap to Flutter; kept until Flutter is listening when the tap itself started the app. */
    private fun sendDeliveryAction(action: Map<String, Any>) {
        pendingDeliveryAction = action
        deliveryChannel?.invokeMethod("onAction", action, object : MethodChannel.Result {
            override fun success(result: Any?) {
                if (pendingDeliveryAction === action) pendingDeliveryAction = null
            }

            override fun error(errorCode: String, errorMessage: String?, errorDetails: Any?) {}

            override fun notImplemented() {}
        })
    }

    override fun onDestroy() {
        // Don't dismiss notification on destroy — the foreground service keeps it alive
        // Only clear the channel reference
        sessionChannel = null
        deliveryChannel = null
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
