package com.chillax.client

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.res.Configuration
import android.content.res.Resources
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Path
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.util.Base64
import android.view.View
import android.widget.RemoteViews
import androidx.core.app.NotificationCompat
import org.json.JSONObject
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * The customer's live delivery card: one notification for the whole delivery,
 * updated in place. Title, a line under it, a straight track from the café to
 * the door with the app's icon (the café's logo) riding it, and buttons that
 * change with where the delivery has got to.
 *
 * It needs no Flutter engine: a `delivery_card` data push redraws it with the
 * app closed ([SessionFcmService]), from the delivery's state kept here and
 * from what the app handed over the last time it ran ([configure]: the words
 * in the customer's language, the café's name and colour, the branch's
 * number, where to say "I'm coming down").
 */
object DeliveryCard {
    const val CHANNEL_NAME = "com.chillax.client/delivery_card"
    const val NOTIFICATION_ID = 9002
    const val CHANNEL_ID = "delivery_card_channel"
    const val ACTION_COMING = "com.chillax.client.ACTION_DELIVERY_COMING"
    const val EXTRA_ACTION = "delivery_action"
    const val EXTRA_ORDER_ID = "delivery_order_id"

    private const val PREFS = "delivery_card"
    private const val KEY_STATE = "state"
    private const val KEY_CONFIG = "config"

    /** A card that reached its end (delivered, or not) leaves by itself after this long. */
    private const val LINGER_MS = 30 * 60 * 1000L

    /** Where the second stop sits on the track: the order is with its rider. */
    private const val WITH_RIDER = 0.3f

    private val FALLBACK = mapOf(
        "preparing" to "Preparing your order",
        "ready" to "Ready, leaving soon",
        "onTheWay" to "On the way to you",
        "near" to "Almost there",
        "delivered" to "Delivered",
        "notDelivered" to "Not delivered",
        "order" to "Order #{number}",
        "about" to "about {minutes} min",
        "bringing" to "{rider} is bringing it",
        "nearRider" to "{rider} is about a minute away",
        "nearNoRider" to "About a minute away",
        "knows" to "{rider} knows you are coming down",
        "knowsNoRider" to "The rider knows you are coming down",
        "enjoy" to "Enjoy! How was it?",
        "failed" to "The rider couldn't deliver it.",
        "call" to "Call rider",
        "coming" to "I'm coming down",
        "told" to "✓ Rider told",
        "rate" to "Rate your order",
        "callCafe" to "Call the café",
        "door" to "Your door",
    )

    private fun prefs(context: Context) = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    private fun read(context: Context, key: String): JSONObject =
        try {
            JSONObject(prefs(context).getString(key, null) ?: "{}")
        } catch (_: Exception) {
            JSONObject()
        }

    /** What the app knows and the card needs to draw and act by itself; kept until the app says otherwise. */
    fun configure(context: Context, args: Map<*, *>) {
        val config = JSONObject()
        for (key in listOf("locale", "cafeName", "color", "branchPhone", "apiBaseUrl")) {
            (args[key] as? String)?.let { config.put(key, it) }
        }
        (args["branchId"] as? Number)?.let { config.put("branchId", it.toLong()) }
        (args["strings"] as? Map<*, *>)?.let { strings ->
            val words = JSONObject()
            for ((key, value) in strings) if (key is String && value is String) words.put(key, value)
            config.put("strings", words)
        }
        prefs(context).edit().putString(KEY_CONFIG, config.toString()).apply()

        // A card already up follows a change of language at once
        val state = read(context, KEY_STATE)
        if (state.has("orderId") && !expired(state)) render(context, state, alert = false)
    }

    /**
     * The delivery moved: from the app (everything, typed) or from a push (text, and for a progress
     * update only what moved). Older news than what the card shows is dropped.
     */
    fun apply(context: Context, data: Map<String, Any?>) {
        val orderId = data["orderId"]?.toString()?.toLongOrNull() ?: return
        val version = data["version"]?.toString()?.toIntOrNull() ?: 0
        var state = read(context, KEY_STATE)

        if (state.optLong("orderId", -1) != orderId) {
            state = JSONObject().put("orderId", orderId)
        } else if (version < state.optInt("version", 0)) {
            return
        }
        val sameStep = version == state.optInt("version", -1)

        state.put("version", version)
        (data["stage"] as? String)?.takeIf { it.isNotBlank() }?.let { state.put("stage", it) }
        for (key in listOf("riderName", "riderPhone", "failureReason", "accessToken")) {
            if (!data.containsKey(key)) continue
            val text = data[key]?.toString()?.trim().orEmpty()
            // The app passes a token only when it has one; a push never does
            if (key == "accessToken" && text.isEmpty()) continue
            if (text.isEmpty()) state.remove(key) else state.put(key, text)
        }
        for (key in listOf("progress", "etaMinutes")) {
            if (!data.containsKey(key)) continue
            val number = data[key]?.toString()?.toDoubleOrNull()?.roundToInt()
            if (number == null) {
                state.remove(key)
            } else if (key == "progress" && sameStep) {
                // Within one step the logo only goes forwards
                state.put(key, max(number, state.optInt(key, 0)))
            } else {
                state.put(key, number)
            }
        }
        for (key in listOf("nearby", "coming")) {
            if (data.containsKey(key)) state.put(key, truthy(data[key]))
        }
        if (isOver(state)) {
            if (!state.has("endedAt")) state.put("endedAt", System.currentTimeMillis())
        } else {
            state.remove("endedAt")
        }

        prefs(context).edit().putString(KEY_STATE, state.toString()).apply()
        if (expired(state)) return
        render(context, state, alert = truthy(data["alert"]))
    }

    /** The customer said they are coming down, from the card: shown at once, before the server's own word arrives. */
    fun markComing(context: Context) {
        val state = read(context, KEY_STATE)
        if (!state.has("orderId")) return
        state.put("coming", true)
        prefs(context).edit().putString(KEY_STATE, state.toString()).apply()
        render(context, state, alert = false)
    }

    /** The token the app left was refused: forgotten, so the card's button opens the app to say it. */
    fun dropToken(context: Context) {
        val state = read(context, KEY_STATE)
        if (!state.has("orderId")) return
        state.remove("accessToken")
        prefs(context).edit().putString(KEY_STATE, state.toString()).apply()
        if (!expired(state)) render(context, state, alert = false)
    }

    fun dismiss(context: Context) {
        prefs(context).edit().remove(KEY_STATE).apply()
        (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).cancel(NOTIFICATION_ID)
    }

    fun orderId(context: Context): Long = read(context, KEY_STATE).optLong("orderId", -1)

    fun accessToken(context: Context): String? = read(context, KEY_STATE).optString("accessToken").takeIf { it.isNotEmpty() }

    fun config(context: Context): JSONObject = read(context, KEY_CONFIG)

    private fun truthy(value: Any?): Boolean = when (value) {
        is Boolean -> value
        is Number -> value.toInt() != 0
        else -> value?.toString().let { it == "1" || it.equals("true", ignoreCase = true) }
    }

    private fun stage(state: JSONObject): String = state.optString("stage", "Waiting")

    private fun isOver(state: JSONObject): Boolean = stage(state) in setOf("Delivered", "Failed", "Returned")

    private fun expired(state: JSONObject): Boolean =
        state.has("endedAt") && System.currentTimeMillis() - state.optLong("endedAt") > LINGER_MS

    /**
     * Whether the token the app left is still good, by its own expiry: the card says "I'm coming
     * down" by itself only with a token the server will take, and opens the app to say it otherwise.
     */
    private fun tokenFresh(state: JSONObject): Boolean {
        val token = state.optString("accessToken")
        val parts = token.split(".")
        if (parts.size < 2) return false
        return try {
            val payload = JSONObject(String(Base64.decode(parts[1], Base64.URL_SAFE or Base64.NO_PADDING or Base64.NO_WRAP)))
            payload.optLong("exp", 0) * 1000 - System.currentTimeMillis() > 20_000
        } catch (_: Exception) {
            false
        }
    }

    // ---- words -------------------------------------------------------------------------------

    private class Words(private val strings: JSONObject?) {
        fun of(key: String): String = strings?.optString(key)?.takeIf { it.isNotEmpty() } ?: FALLBACK[key].orEmpty()

        fun of(key: String, name: String, value: String): String = of(key).replace("{$name}", value)
    }

    private fun titleAndBody(state: JSONObject, words: Words): Pair<String, String> {
        val rider = state.optString("riderName").takeIf { it.isNotEmpty() }
        val minutes = if (state.has("etaMinutes")) words.of("about", "minutes", state.optInt("etaMinutes").toString()) else null
        val order = words.of("order", "number", state.optLong("orderId").toString())
        val coming = state.optBoolean("coming")
        fun join(vararg parts: String?) = parts.filterNotNull().joinToString(" · ")
        val knows = if (rider != null) words.of("knows", "rider", rider) else words.of("knowsNoRider")

        return when (stage(state)) {
            "Assigned" -> words.of("ready") to join(if (rider != null) words.of("bringing", "rider", rider) else order, minutes)
            "OnTheWay" -> when {
                state.optBoolean("nearby") -> words.of("near") to when {
                    coming -> knows
                    rider != null -> words.of("nearRider", "rider", rider)
                    else -> words.of("nearNoRider")
                }
                coming -> words.of("onTheWay") to knows
                else -> words.of("onTheWay") to join(rider, minutes).ifEmpty { order }
            }
            "Delivered" -> words.of("delivered") to words.of("enjoy")
            "Failed", "Returned" -> words.of("notDelivered") to words.of("failed")
            else -> words.of("preparing") to join(order, minutes)
        }
    }

    /** How far along the track the logo sits, 0 to 1. */
    private fun position(state: JSONObject): Float = when (stage(state)) {
        "Assigned" -> WITH_RIDER
        "OnTheWay", "Failed", "Returned" -> {
            val progress = if (state.has("progress")) state.optInt("progress") / 100f else 0f
            val along = WITH_RIDER + (1 - WITH_RIDER) * progress.coerceIn(0f, 1f)
            // Near the door reads as near the door, whatever the straight line said
            if (state.optBoolean("nearby")) max(along, 0.92f) else min(along, 0.92f)
        }
        "Delivered" -> 1f
        else -> 0f
    }

    // ---- drawing -----------------------------------------------------------------------------

    private fun systemIsDark(): Boolean =
        Resources.getSystem().configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK == Configuration.UI_MODE_NIGHT_YES

    private fun brandColor(config: JSONObject): Int =
        try {
            Color.parseColor(config.optString("color").ifEmpty { "#2563EB" })
        } catch (_: Exception) {
            Color.parseColor("#2563EB")
        }

    /** The colour the track is drawn in: the café's, lifted where it would vanish into a dark shade. */
    private fun trackColor(state: JSONObject, config: JSONObject): Int {
        val dark = systemIsDark()
        return when (stage(state)) {
            "Delivered" -> if (dark) 0xFF5FD39A.toInt() else 0xFF2FA66A.toInt()
            "Failed", "Returned" -> if (dark) 0xFFFF8A80.toInt() else 0xFFC93A3A.toInt()
            else -> {
                val brand = brandColor(config)
                val luminance = (0.299 * Color.red(brand) + 0.587 * Color.green(brand) + 0.114 * Color.blue(brand)) / 255
                when {
                    dark && luminance < 0.45 -> blend(brand, Color.WHITE, 0.55f)
                    !dark && luminance > 0.8 -> blend(brand, Color.BLACK, 0.4f)
                    else -> brand
                }
            }
        }
    }

    private fun blend(from: Int, to: Int, amount: Float): Int = Color.rgb(
        (Color.red(from) + (Color.red(to) - Color.red(from)) * amount).roundToInt(),
        (Color.green(from) + (Color.green(to) - Color.green(from)) * amount).roundToInt(),
        (Color.blue(from) + (Color.blue(to) - Color.blue(from)) * amount).roundToInt(),
    )

    /** The app's icon, which a business's own build carries as its logo, cut to a circle. */
    private fun logo(context: Context, size: Int): Bitmap {
        val bitmap = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val clip = Path().apply { addCircle(size / 2f, size / 2f, size / 2f, Path.Direction.CW) }
        canvas.clipPath(clip)
        canvas.drawColor(Color.WHITE)
        try {
            val icon = context.packageManager.getApplicationIcon(context.packageName)
            // A little past the circle: a launcher icon keeps a margin round its mark
            val over = (size * 0.1f).roundToInt()
            icon.setBounds(-over, -over, size + over, size + over)
            icon.draw(canvas)
        } catch (_: Exception) {
        }
        return bitmap
    }

    /** The track as a picture: the rail, what is covered, the three stops, and the logo where the delivery is. */
    private fun track(context: Context, state: JSONObject, config: JSONObject, heightDp: Int, rtl: Boolean): Bitmap {
        val density = context.resources.displayMetrics.density
        val width = (min(context.resources.displayMetrics.widthPixels, context.resources.displayMetrics.heightPixels) - 64 * density)
            .roundToInt().coerceAtLeast(200)
        val height = (heightDp * density).roundToInt()
        val bitmap = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)

        val marker = height - 4 * density
        val inset = marker / 2 + 2 * density
        val y = height / 2f
        val start = inset
        val end = width - inset
        val go = trackColor(state, config)
        val rail = if (systemIsDark()) 0x55FFFFFF else 0x33000000
        val at = position(state)
        // In Arabic the café is on the right and the door on the left
        fun x(share: Float) = if (rtl) end - (end - start) * share else start + (end - start) * share

        val paint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
            strokeCap = Paint.Cap.ROUND
            strokeWidth = 4 * density
            style = Paint.Style.STROKE
        }
        paint.color = rail
        canvas.drawLine(start, y, end, y, paint)
        paint.color = go
        if (at > 0f) canvas.drawLine(x(0f), y, x(at), y, paint)

        paint.style = Paint.Style.FILL
        for (stop in floatArrayOf(0f, WITH_RIDER, 1f)) {
            paint.color = if (at >= stop) go else blend(if (systemIsDark()) 0xFF2A2D34.toInt() else 0xFFF2F3F5.toInt(), if (systemIsDark()) Color.WHITE else Color.BLACK, 0.35f)
            canvas.drawCircle(x(stop), y, 5 * density, paint)
        }

        // The logo, on a white disc ringed in the track's colour
        val cx = x(at)
        paint.color = go
        canvas.drawCircle(cx, y, marker / 2, paint)
        val inner = (marker - 5 * density).roundToInt()
        canvas.drawBitmap(logo(context, inner), cx - inner / 2f, y - inner / 2f, null)
        return bitmap
    }

    // ---- the notification --------------------------------------------------------------------

    private fun ensureChannel(context: Context, name: String) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
        val manager = context.getSystemService(NotificationManager::class.java)
        val channel = NotificationChannel(CHANNEL_ID, name, NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Your delivery, followed to the door"
            enableVibration(true)
            setShowBadge(false)
        }
        manager.createNotificationChannel(channel)
    }

    private fun open(context: Context, requestCode: Int, action: String?, orderId: Long): PendingIntent {
        val intent = context.packageManager.getLaunchIntentForPackage(context.packageName)?.apply {
            putExtra("navigate_to", "/bills")
            if (action != null) {
                putExtra(EXTRA_ACTION, action)
                putExtra(EXTRA_ORDER_ID, orderId)
            }
        }
        return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun dial(context: Context, requestCode: Int, phone: String): PendingIntent {
        val number = phone.filter { it.isDigit() || it == '+' }
        val intent = Intent(Intent.ACTION_DIAL, Uri.parse("tel:$number")).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun render(context: Context, state: JSONObject, alert: Boolean) {
        val config = read(context, KEY_CONFIG)
        val words = Words(config.optJSONObject("strings"))
        val cafe = config.optString("cafeName").ifEmpty { context.applicationInfo.loadLabel(context.packageManager).toString() }
        val rtl = config.optString("locale") == "ar"
        val orderId = state.optLong("orderId")
        val stage = stage(state)
        val over = isOver(state)
        val (title, body) = titleAndBody(state, words)
        ensureChannel(context, cafe)

        fun view(layout: Int, trackHeightDp: Int) = RemoteViews(context.packageName, layout).apply {
            setInt(R.id.delivery_root, "setLayoutDirection", if (rtl) View.LAYOUT_DIRECTION_RTL else View.LAYOUT_DIRECTION_LTR)
            setTextViewText(R.id.delivery_title, title)
            setTextViewText(R.id.delivery_body, body)
            setImageViewBitmap(R.id.delivery_track, track(context, state, config, trackHeightDp, rtl))
            if (layout == R.layout.notification_delivery_expanded) {
                setTextViewText(R.id.delivery_from, cafe)
                setTextViewText(R.id.delivery_to, words.of("door"))
            }
        }

        val builder = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(brandColor(config))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.DecoratedCustomViewStyle())
            .setCustomContentView(view(R.layout.notification_delivery, 26))
            .setCustomBigContentView(view(R.layout.notification_delivery_expanded, 40))
            .setContentIntent(open(context, 20, null, orderId))
            .setOngoing(!over)
            .setAutoCancel(over)
            .setOnlyAlertOnce(!alert)
            .setSilent(!alert)
            .setShowWhen(false)
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setCategory(if (over) NotificationCompat.CATEGORY_STATUS else NotificationCompat.CATEGORY_PROGRESS)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)

        if (over) {
            val left = LINGER_MS - (System.currentTimeMillis() - state.optLong("endedAt", System.currentTimeMillis()))
            builder.setTimeoutAfter(left.coerceAtLeast(1000))
        }

        val riderPhone = state.optString("riderPhone")
        val branchPhone = config.optString("branchPhone")
        when (stage) {
            "OnTheWay" -> {
                if (riderPhone.isNotEmpty()) builder.addAction(0, words.of("call"), dial(context, 21, riderPhone))
                if (state.optBoolean("coming")) {
                    // Said: the button stays as a tick, and does nothing more
                    builder.addAction(NotificationCompat.Action.Builder(0, words.of("told"), null).build())
                } else if (tokenFresh(state)) {
                    val coming = Intent(context, DeliveryActionReceiver::class.java).setAction(ACTION_COMING).putExtra(EXTRA_ORDER_ID, orderId)
                    builder.addAction(0, words.of("coming"), PendingIntent.getBroadcast(
                        context, 22, coming, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE))
                } else {
                    // The app's sign-in has to be renewed first: the app opens and says it
                    builder.addAction(0, words.of("coming"), open(context, 23, "coming", orderId))
                }
            }
            "Delivered" -> builder.addAction(0, words.of("rate"), open(context, 24, "rate", orderId))
            "Failed", "Returned" ->
                if (branchPhone.isNotEmpty()) builder.addAction(0, words.of("callCafe"), dial(context, 25, branchPhone))
        }

        try {
            (context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(NOTIFICATION_ID, builder.build())
        } catch (_: SecurityException) {
            // The customer has notifications off for the app
        }
    }
}

/**
 * "I'm coming down", tapped on the card: said to the server from here with the
 * token the app left, so the app need not open. Shown as said only once the
 * server took it; refused (the token went stale after the card was drawn), the
 * card is redrawn so the next tap opens the app, which says it.
 */
class DeliveryActionReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != DeliveryCard.ACTION_COMING) return
        val orderId = intent.getLongExtra(DeliveryCard.EXTRA_ORDER_ID, DeliveryCard.orderId(context))
        if (orderId <= 0) return

        val app = context.applicationContext
        val config = DeliveryCard.config(app)
        val base = config.optString("apiBaseUrl")
        val token = DeliveryCard.accessToken(app)
        val pending = goAsync()

        Thread {
            var said = false
            try {
                if (base.isNotEmpty() && token != null) {
                    val url = java.net.URL("$base$orderId/delivery/coming?api-version=1.0")
                    val connection = url.openConnection() as java.net.HttpURLConnection
                    connection.requestMethod = "PUT"
                    connection.connectTimeout = 8000
                    connection.readTimeout = 8000
                    connection.setRequestProperty("Authorization", "Bearer $token")
                    connection.setRequestProperty("Content-Length", "0")
                    if (config.has("branchId")) connection.setRequestProperty("X-Branch-Id", config.optLong("branchId").toString())
                    connection.doOutput = true
                    connection.outputStream.use { }
                    said = connection.responseCode in 200..299
                    connection.disconnect()
                }
            } catch (_: Exception) {
            }

            if (said) {
                DeliveryCard.markComing(app)
                // The app, if it is open, catches up with the server
                Handler(Looper.getMainLooper()).post {
                    MainActivity.deliveryChannel?.invokeMethod("onAction", mapOf("action" to "said", "orderId" to orderId))
                }
            } else {
                // The card is redrawn with a button that opens the app instead
                DeliveryCard.dropToken(app)
            }
            pending.finish()
        }.start()
    }
}
