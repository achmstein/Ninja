package com.chillax.client

import android.app.Notification
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import androidx.core.app.ServiceCompat

class SessionForegroundService : Service() {
    companion object {
        fun start(
            context: Context, placeName: String, duration: String, startTimeMs: Long?, locale: String,
            drink1Id: Int? = null, drink1Name: String? = null,
            drink2Id: Int? = null, drink2Name: String? = null
        ) {
            val intent = Intent(context, SessionForegroundService::class.java).apply {
                putExtra("placeName", placeName)
                putExtra("duration", duration)
                if (startTimeMs != null) putExtra("startTimeMs", startTimeMs)
                putExtra("locale", locale)
                if (drink1Id != null) putExtra("drink1Id", drink1Id)
                if (drink1Name != null) putExtra("drink1Name", drink1Name)
                if (drink2Id != null) putExtra("drink2Id", drink2Id)
                if (drink2Name != null) putExtra("drink2Name", drink2Name)
            }
            context.startForegroundService(intent)
        }

        fun stop(context: Context) {
            context.stopService(Intent(context, SessionForegroundService::class.java))
        }
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        if (intent == null) {
            stopSelf()
            return START_NOT_STICKY
        }

        val placeName = intent.getStringExtra("placeName") ?: ""
        val duration = intent.getStringExtra("duration") ?: ""
        val startTimeMs = if (intent.hasExtra("startTimeMs")) intent.getLongExtra("startTimeMs", 0) else null
        val locale = intent.getStringExtra("locale") ?: "en"
        val drink1Id = if (intent.hasExtra("drink1Id")) intent.getIntExtra("drink1Id", 0) else null
        val drink1Name = intent.getStringExtra("drink1Name")
        val drink2Id = if (intent.hasExtra("drink2Id")) intent.getIntExtra("drink2Id", 0) else null
        val drink2Name = intent.getStringExtra("drink2Name")

        // Build notification — try helper first, fall back to basic notification
        val notification = SessionNotificationHelper.instance?.buildNotification(
            placeName, duration, startTimeMs, locale, drink1Id, drink1Name, drink2Id, drink2Name
        ) ?: buildFallbackNotification(placeName, duration, startTimeMs, locale)

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            ServiceCompat.startForeground(
                this,
                SessionNotificationHelper.NOTIFICATION_ID,
                notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE
            )
        } else {
            startForeground(SessionNotificationHelper.NOTIFICATION_ID, notification)
        }

        return START_NOT_STICKY
    }

    private fun buildFallbackNotification(placeName: String, duration: String, startTimeMs: Long?, locale: String): Notification {
        val openIntent = packageManager.getLaunchIntentForPackage(packageName)?.apply {
            putExtra("navigate_to", "/places")
        }
        val openPendingIntent = PendingIntent.getActivity(
            this, 0, openIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val isArabic = locale == "ar"
        val waiterPending = createFallbackActionPendingIntent(SessionNotificationHelper.ACTION_CALL_WAITER, 1)
        val controllerPending = createFallbackActionPendingIntent(SessionNotificationHelper.ACTION_CONTROLLER, 2)

        val waiterLabel = if (isArabic) "الويتر" else "Waiter"
        val controllerLabel = if (isArabic) "دراع" else "Controller"

        val builder = NotificationCompat.Builder(this, SessionNotificationHelper.CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("Chillax")
            .setContentText(placeName)
            .setContentIntent(openPendingIntent)
            .setOngoing(true)
            .setSilent(true)
            .setShowWhen(true)
            .setUsesChronometer(true)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .addAction(0, waiterLabel, waiterPending)
            .addAction(0, controllerLabel, controllerPending)

        if (startTimeMs != null) {
            builder.setWhen(startTimeMs)
        }

        return builder.build()
    }

    private fun createFallbackActionPendingIntent(action: String, requestCode: Int): PendingIntent {
        val intent = Intent(this, SessionActionReceiver::class.java).apply {
            this.action = action
        }
        return PendingIntent.getBroadcast(
            this, requestCode, intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
    }

    override fun onDestroy() {
        super.onDestroy()
    }
}
