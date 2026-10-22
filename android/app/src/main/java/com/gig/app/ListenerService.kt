package com.gig.app

import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.os.Build
import android.os.IBinder
import android.util.Log
import org.json.JSONObject
import java.io.BufferedReader
import java.io.IOException
import java.io.InputStreamReader
import java.net.HttpURLConnection
import java.net.URL
import java.net.URLEncoder
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Hält eine dauerhafte Verbindung zum ntfy-Kanal offen und zeigt jede neue Nachricht
 * als Benachrichtigung an. Verpasste Nachrichten werden beim Neuverbinden nachgeholt.
 */
class ListenerService : Service() {
    @Volatile
    private var running = false

    @Volatile
    private var connection: HttpURLConnection? = null
    private var worker: Thread? = null

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        AppNotifications.createChannels(this)
        val notification = AppNotifications.serviceNotification(this, "Verbinde …")
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                startForeground(AppNotifications.SERVICE_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE)
            } else {
                startForeground(AppNotifications.SERVICE_ID, notification)
            }
        } catch (e: Exception) {
            // Android erlaubt den Start aus dem Hintergrund nicht immer – beim nächsten Öffnen der App klappt es.
            Log.w("Gig", "Vordergrund-Dienst nicht erlaubt", e)
            stopSelf()
            return START_NOT_STICKY
        }
        if (worker?.isAlive != true) {
            running = true
            worker = Thread({ listen() }, "gig-listener").also { it.start() }
        }
        return START_STICKY
    }

    override fun onDestroy() {
        running = false
        connection?.disconnect()
        worker?.interrupt()
        Store.setStatus(this, "Gestoppt")
        super.onDestroy()
    }

    private fun listen() {
        var backoff = 2_000L
        while (running) {
            val topic = Store.topic(this)
            if (topic.isBlank()) {
                updateStatus("Kein Kanal eingetragen")
                stopSelf()
                return
            }
            try {
                val since = URLEncoder.encode(Store.lastId(this) ?: "12h", "UTF-8")
                val url = URL("${Store.server(this).trimEnd('/')}/${URLEncoder.encode(topic, "UTF-8")}/json?since=$since")
                val conn = (url.openConnection() as HttpURLConnection).apply {
                    connectTimeout = 15_000
                    readTimeout = 90_000 // ntfy schickt alle 45 s ein Lebenszeichen
                    setRequestProperty("User-Agent", "GigApp/1.0")
                }
                connection = conn
                if (conn.responseCode != 200) throw IOException("HTTP ${conn.responseCode}")
                updateStatus("Verbunden ✓ seit ${clock()}")
                backoff = 2_000L
                BufferedReader(InputStreamReader(conn.inputStream, Charsets.UTF_8)).use { reader ->
                    while (running) {
                        val line = reader.readLine() ?: break
                        handleLine(line)
                    }
                }
            } catch (e: Exception) {
                if (!running) break
                updateStatus("Keine Verbindung (${e.javaClass.simpleName}) – neuer Versuch …")
            } finally {
                connection?.disconnect()
                connection = null
            }
            if (!running) break
            try {
                Thread.sleep(backoff)
            } catch (e: InterruptedException) {
                break
            }
            backoff = (backoff * 2).coerceAtMost(60_000L)
        }
    }

    private fun handleLine(line: String) {
        val json = try {
            JSONObject(line)
        } catch (e: Exception) {
            return
        }
        if (json.optString("event") != "message") return
        val msg = GigMessage.fromJson(json) ?: return
        Store.setLastId(this, msg.id)
        if (Store.addToHistory(this, msg)) AppNotifications.show(this, msg)
    }

    private fun updateStatus(status: String) {
        Store.setStatus(this, status)
        AppNotifications.updateService(this, status)
    }

    private fun clock(): String = SimpleDateFormat("HH:mm", Locale.GERMANY).format(Date())

    companion object {
        fun start(ctx: Context) {
            ctx.startForegroundService(Intent(ctx, ListenerService::class.java))
        }

        fun stop(ctx: Context) {
            ctx.stopService(Intent(ctx, ListenerService::class.java))
        }
    }
}
