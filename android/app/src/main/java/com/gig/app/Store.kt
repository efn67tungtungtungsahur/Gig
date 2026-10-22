package com.gig.app

import android.content.Context
import android.content.SharedPreferences
import org.json.JSONArray

/** Einstellungen, Verbindungsstatus und die letzten Benachrichtigungen. */
object Store {
    const val KEY_SERVER = "server"
    const val KEY_TOPIC = "topic"
    const val KEY_ENABLED = "enabled"
    const val KEY_LAST_TIME = "last_time"
    const val KEY_ONBOARDED = "onboarded"
    const val KEY_BOT_SEEN = "bot_seen"
    const val KEY_BOT_TEXT = "bot_text"
    const val KEY_STATUS = "status"
    const val KEY_HISTORY = "history"
    const val DEFAULT_SERVER = "https://ntfy.sh"
    private const val MAX_HISTORY = 100

    fun prefs(ctx: Context): SharedPreferences =
        ctx.getSharedPreferences("gig", Context.MODE_PRIVATE)

    fun server(ctx: Context): String =
        prefs(ctx).getString(KEY_SERVER, null)?.trim()?.ifBlank { null } ?: DEFAULT_SERVER

    fun topic(ctx: Context): String = prefs(ctx).getString(KEY_TOPIC, "")?.trim() ?: ""

    fun isEnabled(ctx: Context): Boolean = prefs(ctx).getBoolean(KEY_ENABLED, false)

    fun isPaired(ctx: Context): Boolean = topic(ctx).isNotBlank()

    /** Zeitpunkt (Unix-Sekunden) der letzten empfangenen Nachricht, für das Nachholen. */
    fun lastTime(ctx: Context): Long = prefs(ctx).getLong(KEY_LAST_TIME, 0L)

    fun setLastTime(ctx: Context, time: Long) = prefs(ctx).edit().putLong(KEY_LAST_TIME, time).apply()

    fun botSeen(ctx: Context): Long = prefs(ctx).getLong(KEY_BOT_SEEN, 0L)

    fun botText(ctx: Context): String = prefs(ctx).getString(KEY_BOT_TEXT, null) ?: ""

    fun setBotStatus(ctx: Context, time: Long, text: String) =
        prefs(ctx).edit().putLong(KEY_BOT_SEEN, time).putString(KEY_BOT_TEXT, text).apply()

    fun status(ctx: Context): String = prefs(ctx).getString(KEY_STATUS, null) ?: "Nicht verbunden"

    fun setStatus(ctx: Context, status: String) = prefs(ctx).edit().putString(KEY_STATUS, status).apply()

    @Synchronized
    fun history(ctx: Context): List<GigMessage> {
        val arr = try {
            JSONArray(prefs(ctx).getString(KEY_HISTORY, "[]"))
        } catch (e: Exception) {
            JSONArray()
        }
        return (0 until arr.length()).mapNotNull { GigMessage.fromJson(arr.optJSONObject(it)) }
    }

    /** Speichert eine Nachricht. Gibt false zurück, wenn sie schon da war. */
    @Synchronized
    fun addToHistory(ctx: Context, msg: GigMessage): Boolean {
        val list = history(ctx)
        if (list.any { it.id == msg.id }) return false
        val arr = JSONArray()
        (listOf(msg) + list).take(MAX_HISTORY).forEach { arr.put(it.toJson()) }
        prefs(ctx).edit().putString(KEY_HISTORY, arr.toString()).apply()
        return true
    }
}
