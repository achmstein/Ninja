package com.ninja.rider

import android.app.Activity
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInfo
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.util.Log
import io.flutter.plugin.common.MethodCall
import io.flutter.plugin.common.MethodChannel
import java.io.File
import java.security.MessageDigest

/**
 * The rider app updating itself from the platform's download page. Dart finds and
 * downloads the new APK; this checks it and installs it through Android's
 * PackageInstaller, with Android's own "update this app?" prompt. Two checks come
 * first, so a download is never installed on trust: its SHA-256 must be the one the
 * page published (no checksum, no install), and it must be signed with the same
 * certificate as the app already on the phone.
 */
class AppUpdater(private val activity: Activity) : MethodChannel.MethodCallHandler {
    override fun onMethodCall(call: MethodCall, result: MethodChannel.Result) {
        when (call.method) {
            "installedVersion" -> {
                val info = activity.packageManager.getPackageInfo(activity.packageName, 0)
                val build = if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else @Suppress("DEPRECATION") info.versionCode.toLong()
                result.success(mapOf("version" to (info.versionName ?: ""), "build" to build))
            }
            "install" -> {
                val path = call.argument<String>("path")
                val sha256 = call.argument<String>("sha256")
                if (path == null) return result.error("install", "no path", null)
                if (sha256.isNullOrBlank()) return result.error("install", "no checksum", null)
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

    /** "installing" once the session is committed; "needsPermission" when Android first wants "install unknown apps" allowed for us. */
    private fun install(apk: File, sha256: String): String {
        if (!apk.exists()) throw IllegalStateException("the download is gone")
        if (!sha256.equals(digest(apk), ignoreCase = true)) {
            apk.delete()
            throw IllegalStateException("checksum mismatch")
        }
        if (!signedLikeThisApp(apk)) {
            apk.delete()
            throw IllegalStateException("signature mismatch")
        }

        if (Build.VERSION.SDK_INT >= 26 && !activity.packageManager.canRequestPackageInstalls()) {
            activity.startActivity(
                Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:${activity.packageName}"))
            )
            return "needsPermission"
        }

        val installer = activity.packageManager.packageInstaller
        val params = PackageInstaller.SessionParams(PackageInstaller.SessionParams.MODE_FULL_INSTALL).apply {
            setAppPackageName(activity.packageName)
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

    /** The download is our own package, signed with the certificate the installed app carries */
    private fun signedLikeThisApp(apk: File): Boolean {
        val pm = activity.packageManager
        val archive = archiveInfo(pm, apk) ?: return false
        if (archive.packageName != activity.packageName) return false
        val installed = installedInfo(pm)
        val theirs = certificates(archive)
        val ours = certificates(installed)
        return theirs.isNotEmpty() && theirs == ours
    }

    private fun archiveInfo(pm: PackageManager, apk: File): PackageInfo? =
        if (Build.VERSION.SDK_INT >= 28) pm.getPackageArchiveInfo(apk.path, PackageManager.GET_SIGNING_CERTIFICATES)
        else @Suppress("DEPRECATION") pm.getPackageArchiveInfo(apk.path, PackageManager.GET_SIGNATURES)

    private fun installedInfo(pm: PackageManager): PackageInfo =
        if (Build.VERSION.SDK_INT >= 28) pm.getPackageInfo(activity.packageName, PackageManager.GET_SIGNING_CERTIFICATES)
        else @Suppress("DEPRECATION") pm.getPackageInfo(activity.packageName, PackageManager.GET_SIGNATURES)

    /** The signing certificates as hex digests, in a set so their order does not matter */
    private fun certificates(info: PackageInfo): Set<String> {
        val signatures = if (Build.VERSION.SDK_INT >= 28) {
            val signing = info.signingInfo ?: return emptySet()
            if (signing.hasMultipleSigners()) signing.apkContentsSigners else signing.signingCertificateHistory
        } else {
            @Suppress("DEPRECATION") info.signatures
        } ?: return emptySet()
        return signatures.map { sig -> MessageDigest.getInstance("SHA-256").digest(sig.toByteArray()).joinToString("") { "%02x".format(it) } }.toSet()
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

/** The app was just replaced by its update: open it again, so the rider is back on their deliveries. */
class UpdatedReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_MY_PACKAGE_REPLACED) return
        val launch = context.packageManager.getLaunchIntentForPackage(context.packageName) ?: return
        try {
            context.startActivity(launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        } catch (e: Exception) {
            // Android may refuse a start from the background; the rider opens it
            Log.w(AppUpdater.TAG, "could not reopen after the update", e)
        }
    }
}
