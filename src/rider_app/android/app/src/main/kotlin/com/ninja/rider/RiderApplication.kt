package com.ninja.rider

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build

/**
 * The rider app's process. It makes the notification channel the platform
 * pushes on as the process starts, so a delivery given before the app was
 * ever opened still rings loud, with the channel named in the phone's language.
 */
class RiderApplication : Application() {
    override fun onCreate() {
        super.onCreate()
        createPushChannel()
    }

    /** The channel Notification.API names on every push: loud, on the lock screen */
    private fun createPushChannel() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        val channel = NotificationChannel(PUSH_CHANNEL, getString(R.string.push_channel_name), NotificationManager.IMPORTANCE_HIGH).apply {
            description = getString(R.string.push_channel_description)
            enableVibration(true)
        }
        // Creating it again only renames it (to the phone's language now); its importance stays the rider's
        manager.createNotificationChannel(channel)
    }

    companion object {
        const val PUSH_CHANNEL = "high_priority_channel"
    }
}
