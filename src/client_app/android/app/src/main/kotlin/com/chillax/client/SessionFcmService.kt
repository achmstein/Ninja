package com.chillax.client

import android.app.NotificationManager
import android.content.Context
import com.google.firebase.messaging.RemoteMessage
import io.flutter.plugins.firebase.messaging.FlutterFirebaseMessagingService

/**
 * Handles session_ended FCM messages natively to dismiss the notification
 * immediately, even when the Flutter engine is not running, and redraws the
 * customer's delivery card from its delivery_card messages the same way.
 *
 * It is the app's one FCM service, the firebase_messaging plugin's own
 * extended (its registration is removed in the manifest): Android hands each
 * message to a single MESSAGING_EVENT service, so this one has to pass every
 * message and every new token on to Flutter through the plugin's.
 */
class SessionFcmService : FlutterFirebaseMessagingService() {
    private companion object {
        const val DELIVERY_CARD = "delivery_card"
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val type = message.data["type"]

        if (type == "session_ended") {
            // Dismiss the ongoing session notification immediately
            val helper = SessionNotificationHelper.instance
            if (helper != null) {
                helper.dismiss()
            } else {
                // Helper not alive — dismiss notification and stop service directly
                SessionForegroundService.stop(this)
                val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
                nm.cancel(SessionNotificationHelper.NOTIFICATION_ID)
            }
        }

        // The delivery card redraws itself here, with the app closed or open
        if (type == DELIVERY_CARD) {
            DeliveryCard.apply(applicationContext, message.data)
        }

        // On to Flutter's plugin: everything else, and session_ended for the Dart side's refresh
        super.onMessageReceived(message)
    }
}
