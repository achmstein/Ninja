package com.ninja.kds

import android.app.Activity
import android.app.ActivityManager
import android.app.PendingIntent
import android.app.admin.DevicePolicyManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.security.MessageDigest

/**
 * The kitchen display updating itself from the platform's download page. Dart finds and
 * downloads the new APK; this installs it through Android's PackageInstaller:
 * silently on a tablet provisioned as device owner (the kiosk setup), with
 * Android's own "update this app?" prompt everywhere else. Android refuses an
 * APK signed with another key, so only our own builds can replace the app.
 */
class AppUpdater(private val activity: Activity) : MethodChannel.MethodCallHandler {
    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "installedVersion" -> {
                val info = activity.packageManager.getPackageInfo(activity.packageName, 0)
                val build = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else @Suppress("DEPRECATION") info.versionCode.toLong()
                result.success(mapOf("version" to (info.versionName ?: ""), "build" to build))
            }
            "isDeviceOwner" -> result.success(isDeviceOwner())
            "install" -> {
                val path = call.argument<String>("path")
                val sha256 = call.argument<String>("sha256")
                if (path == null) return result.error("install", "no path", null)
                try {
                    result.success(install(File(path), sha256))
                } catch (e: Exception) {
                    Log.w(TAG, "install failed", e)
                    result.error("install", e.message, null)
                }
            }
            else -> result.notImplemented()
        }
    }

    private fun isDeviceOwner(): Boolean {
        val dpm = activity.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
        return dpm.isDeviceOwnerApp(activity.packageName)
    }

    /** "installing" once the session is committed; "needsPermission" when Android first wants "install unknown apps" allowed for us. */
    private fun install(apk: File, sha256: String?): String {
        if (!apk.exists()) throw IllegalStateException("the download is gone")
        if (sha256 != null && !sha256.equals(digest(apk), ignoreCase = true)) {
            apk.delete()
            throw IllegalStateException("checksum mismatch")
        }

        val owner = isDeviceOwner()
        if (!owner && Build.VERSION.SDK_INT >= 26 && !activity.packageManager.canRequestPackageInstalls()) {
            activity.startActivity(
                Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${activity.packageName}"))
            )
            return "needsPermission"
        }
        // Screen pinning (no device owner) would hide Android's prompt; the app pins itself again on resume
        if (!owner) {
            val am = activity.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
            if (am.lockTaskModeState != ActivityManager.LOCK_TASK_MODE_NONE) activity.stopLockTask()
        }

        val installer = activity.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
            setAppPackageName(activity.packageName)
            if (Build.VERSION.SDK_INT >= 31) setRequireUserAction(PackageInstaller.SessionParams.USER_ACTION_NOT_REQUIRED)
        }
        val sessionId = installer.createSession(params)
        installer.openSession(sessionId).use { session ->
            session.openWrite("app.apk", 0, apk.length()).use { out ->
                apk.inputStream().use { it.copyTo(out) }
                session.fsync(out)
            }
            var flags = PendingIntent.FLAG_UPDATE_CURRENT
            // The installer fills the status in, so the intent must stay mutable (and explicit, for Android 14)
            if (Build.VERSION.SDK_INT >= 31) flags = flags or PendingIntent.FLAG_MUTABLE
            val status = PendingIntent.getBroadcast(activity, sessionId, Intent(activity, InstallStatusReceiver::class.java), flags)
            session.commit(status.intentSender)
        }
        return "installing"
    }

    private fun digest(file: File): String {
        val md = MessageDigest.getInstance("SHA-256")
        file.inputStream().use { input ->
            val buffer = ByteArray(64 * 1024)
            while (true) {
                val read = input.read(buffer)
                if (read < 0) break
                md.update(buffer, 0, read)
            }
        }
        return md.digest().joinToString("") { "%02x".format(it) }
    }

    companion object {
        const val TAG = "AppUpdater"
    }
}

/** What the installer says about a session: Android's prompt when it wants the user, a log line otherwise. */
class InstallStatusReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        when (val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, PackageInstaller.STATUS_FAILURE)) {
            PackageInstaller.STATUS_PENDING_USER_ACTION -> {
                @Suppress("DEPRECATION")
                val confirm = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT) ?: return
                context.startActivity(confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            }
            PackageInstaller.STATUS_SUCCESS -> Log.i(AppUpdater.TAG, "update installed")
            else -> Log.w(AppUpdater.TAG, "update not installed ($status): ${intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)}")
        }
    }
}

/** The app was just replaced by its update: open it again, so a till does not sit on the home screen. */
class UpdatedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
        try {
            context.startActivity(launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (e: Exception) {
            // Android may refuse a start from the background without device-owner rights; the staff open it
            Log.w(AppUpdater.TAG, "could not reopen after the update", e)
        }
    }
}
