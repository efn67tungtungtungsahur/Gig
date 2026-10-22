package com.gig.app

import android.Manifest
import android.app.Activity
import android.content.Intent
import android.content.SharedPreferences
import android.content.pm.PackageManager
import android.graphics.Typeface
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.PowerManager
import android.provider.Settings
import android.text.SpannableStringBuilder
import android.text.Spanned
import android.text.style.ForegroundColorSpan
import android.text.style.StyleSpan
import android.view.View
import android.view.WindowInsets
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : Activity() {
    private lateinit var statusView: TextView
    private lateinit var serverEdit: EditText
    private lateinit var topicEdit: EditText
    private lateinit var historyView: LinearLayout
    private lateinit var emptyView: TextView

    private val prefsListener = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
        when (key) {
            Store.KEY_STATUS -> renderStatus()
            Store.KEY_HISTORY -> renderHistory()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        applySystemBarInsets(findViewById(R.id.root))

        statusView = findViewById(R.id.status)
        serverEdit = findViewById(R.id.server)
        topicEdit = findViewById(R.id.topic)
        historyView = findViewById(R.id.history)
        emptyView = findViewById(R.id.empty)

        serverEdit.setText(Store.server(this))
        topicEdit.setText(Store.topic(this))

        findViewById<Button>(R.id.save).setOnClickListener { save() }
        findViewById<Button>(R.id.test).setOnClickListener { sendTest() }
        findViewById<Button>(R.id.stop).setOnClickListener { stopListening() }
        findViewById<Button>(R.id.battery).setOnClickListener { askBatteryExemption() }

        AppNotifications.createChannels(this)
        requestNotificationPermission()
        if (Store.isEnabled(this) && Store.topic(this).isNotBlank()) ListenerService.start(this)
    }

    override fun onResume() {
        super.onResume()
        Store.prefs(this).registerOnSharedPreferenceChangeListener(prefsListener)
        renderStatus()
        renderHistory()
    }

    override fun onPause() {
        Store.prefs(this).unregisterOnSharedPreferenceChangeListener(prefsListener)
        super.onPause()
    }

    private fun applySystemBarInsets(root: View) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return
        root.setOnApplyWindowInsetsListener { v, insets ->
            val bars = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.ime())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
    }

    private fun save() {
        val server = serverEdit.text.toString().trim().ifBlank { Store.DEFAULT_SERVER }
        val topic = topicEdit.text.toString().trim()
        if (topic.isEmpty()) {
            toast("Bitte den Kanal eintragen (steht im Bot-Fenster am Laptop)")
            return
        }
        if (!server.startsWith("http://") && !server.startsWith("https://")) {
            toast("Server muss mit https:// beginnen")
            return
        }
        val edit = Store.prefs(this).edit()
        if (topic != Store.topic(this) || server != Store.server(this)) edit.remove(Store.KEY_LAST_ID)
        edit.putString(Store.KEY_SERVER, server)
            .putString(Store.KEY_TOPIC, topic)
            .putBoolean(Store.KEY_ENABLED, true)
            .apply()
        requestNotificationPermission()
        ListenerService.stop(this)
        ListenerService.start(this)
        toast("Gespeichert – verbinde …")
    }

    private fun stopListening() {
        Store.prefs(this).edit().putBoolean(Store.KEY_ENABLED, false).apply()
        ListenerService.stop(this)
        toast("Gestoppt – du bekommst keine Benachrichtigungen mehr")
    }

    private fun sendTest() {
        val server = Store.server(this)
        val topic = Store.topic(this)
        if (topic.isBlank()) {
            toast("Erst Kanal eintragen und speichern")
            return
        }
        Thread {
            val ok = try {
                val conn = URL(server.trimEnd('/') + "/").openConnection() as HttpURLConnection
                conn.requestMethod = "POST"
                conn.doOutput = true
                conn.connectTimeout = 15_000
                conn.readTimeout = 15_000
                conn.setRequestProperty("Content-Type", "application/json")
                val body = JSONObject()
                    .put("topic", topic)
                    .put("title", "✅ Test von der App")
                    .put("message", "Wenn das als Benachrichtigung kommt, ist alles richtig eingerichtet.")
                    .put("priority", 4)
                conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
                val code = conn.responseCode
                conn.disconnect()
                code in 200..299
            } catch (e: Exception) {
                false
            }
            runOnUiThread {
                toast(if (ok) "Test gesendet – kommt gleich als Benachrichtigung" else "Senden fehlgeschlagen – Internet/Server prüfen")
            }
        }.start()
    }

    private fun askBatteryExemption() {
        val pm = getSystemService(PowerManager::class.java)
        if (pm.isIgnoringBatteryOptimizations(packageName)) {
            toast("Akku-Optimierung ist schon aus ✓")
            return
        }
        try {
            startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName")))
        } catch (e: Exception) {
            startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
        }
    }

    private fun requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)
        }
    }

    private fun renderStatus() {
        val enabled = Store.isEnabled(this)
        statusView.text = if (enabled) Store.status(this) else "Gestoppt"
    }

    private fun renderHistory() {
        val list = Store.history(this)
        historyView.removeAllViews()
        emptyView.visibility = if (list.isEmpty()) View.VISIBLE else View.GONE
        val format = SimpleDateFormat("dd.MM. HH:mm", Locale.GERMANY)
        val dp = resources.displayMetrics.density
        for (msg in list.take(50)) {
            val content = SpannableStringBuilder()
            content.append(msg.title, StyleSpan(Typeface.BOLD), Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            if (msg.important) {
                content.setSpan(ForegroundColorSpan(getColor(R.color.purple)), 0, content.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)
            }
            content.append("\n").append(msg.message).append("\n")
            val start = content.length
            content.append(format.format(Date(msg.time * 1000)))
            content.setSpan(ForegroundColorSpan(getColor(R.color.muted)), start, content.length, Spanned.SPAN_EXCLUSIVE_EXCLUSIVE)

            val item = TextView(this).apply {
                setText(content)
                textSize = 14f
                setPadding(0, (10 * dp).toInt(), 0, (10 * dp).toInt())
                msg.click?.let { url ->
                    setOnClickListener { startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url))) }
                }
            }
            historyView.addView(item)
            historyView.addView(View(this).apply {
                setBackgroundColor(getColor(R.color.divider))
                layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, dp.toInt().coerceAtLeast(1))
            })
        }
    }

    private fun toast(text: String) = Toast.makeText(this, text, Toast.LENGTH_LONG).show()
}
