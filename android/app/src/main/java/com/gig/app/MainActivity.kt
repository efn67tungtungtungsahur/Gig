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
import com.google.mlkit.vision.barcode.common.Barcode
import com.google.mlkit.vision.codescanner.GmsBarcodeScannerOptions
import com.google.mlkit.vision.codescanner.GmsBarcodeScanning
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URL
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class MainActivity : Activity() {
    private lateinit var statusView: TextView
    private lateinit var botStatusView: TextView
    private lateinit var pairButton: Button
    private lateinit var serverEdit: EditText
    private lateinit var topicEdit: EditText
    private lateinit var historyView: LinearLayout
    private lateinit var emptyView: TextView

    private val prefsListener = SharedPreferences.OnSharedPreferenceChangeListener { _, key ->
        when (key) {
            Store.KEY_STATUS, Store.KEY_BOT_SEEN, Store.KEY_TOPIC -> renderStatus()
            Store.KEY_HISTORY -> renderHistory()
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        applySystemBarInsets(findViewById(R.id.root))

        statusView = findViewById(R.id.status)
        botStatusView = findViewById(R.id.bot_status)
        pairButton = findViewById(R.id.pair)
        serverEdit = findViewById(R.id.server)
        topicEdit = findViewById(R.id.topic)
        historyView = findViewById(R.id.history)
        emptyView = findViewById(R.id.empty)

        serverEdit.setText(Store.server(this))
        topicEdit.setText(Store.topic(this))

        pairButton.setOnClickListener { scanPairingCode() }
        findViewById<Button>(R.id.save).setOnClickListener { saveManual() }
        findViewById<Button>(R.id.test).setOnClickListener { sendTest() }
        findViewById<Button>(R.id.stop).setOnClickListener { stopListening() }
        findViewById<Button>(R.id.battery).setOnClickListener { askBatteryExemption(quiet = false) }
        val advanced = findViewById<View>(R.id.advanced)
        findViewById<View>(R.id.advanced_toggle).setOnClickListener {
            advanced.visibility = if (advanced.visibility == View.VISIBLE) View.GONE else View.VISIBLE
        }

        AppNotifications.createChannels(this)
        onboard()
        handleIntent(intent)
        if (Store.isEnabled(this) && Store.isPaired(this)) ListenerService.start(this)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleIntent(intent)
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

    // --- Einrichtung ----------------------------------------------------------

    /** Beim ersten Start: Benachrichtigungen erlauben, dann Akku-Optimierung abschalten lassen. */
    private fun onboard() {
        val prefs = Store.prefs(this)
        if (prefs.getBoolean(Store.KEY_ONBOARDED, false)) return
        prefs.edit().putBoolean(Store.KEY_ONBOARDED, true).apply()
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) {
            requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), REQUEST_NOTIFICATIONS)
        } else {
            askBatteryExemption(quiet = true)
        }
    }

    override fun onRequestPermissionsResult(requestCode: Int, permissions: Array<out String>, grantResults: IntArray) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults)
        if (requestCode == REQUEST_NOTIFICATIONS) askBatteryExemption(quiet = true)
    }

    private fun handleIntent(intent: Intent?) {
        val data = intent?.data ?: return
        if (data.scheme == "gig") pairWith(data.toString())
    }

    private fun scanPairingCode() {
        val options = GmsBarcodeScannerOptions.Builder()
            .setBarcodeFormats(Barcode.FORMAT_QR_CODE)
            .build()
        GmsBarcodeScanning.getClient(this, options).startScan()
            .addOnSuccessListener { barcode -> pairWith(barcode.rawValue) }
            .addOnFailureListener {
                toast("Scanner nicht verfügbar. Du kannst den Kanal unter „Erweitert“ eintippen.")
            }
    }

    private fun pairWith(raw: String?) {
        val uri = raw?.let { Uri.parse(it) }?.takeIf { it.scheme == "gig" && it.host == "pair" }
        val topic = uri?.getQueryParameter("topic")?.trim()
        if (uri == null || topic.isNullOrEmpty()) {
            toast("Das ist kein Gig-Code – scanne den rechten Code im Fenster auf dem Laptop.")
            return
        }
        val server = uri.getQueryParameter("server")?.trim()?.ifBlank { null } ?: Store.DEFAULT_SERVER
        connect(server, topic)
        publish(server, topic, "📱 Handy gekoppelt", "Die Gig-App ist verbunden.", listOf(GigMessage.PAIRED_TAG))
        toast("Gekoppelt ✓ – ab jetzt musst du nichts mehr tun.")
    }

    private fun connect(server: String, topic: String) {
        val edit = Store.prefs(this).edit()
        if (topic != Store.topic(this) || server != Store.server(this)) edit.remove(Store.KEY_LAST_TIME)
        edit.putString(Store.KEY_SERVER, server)
            .putString(Store.KEY_TOPIC, topic)
            .putBoolean(Store.KEY_ENABLED, true)
            .apply()
        serverEdit.setText(server)
        topicEdit.setText(topic)
        ListenerService.stop(this)
        ListenerService.start(this)
        renderStatus()
    }

    private fun saveManual() {
        val server = serverEdit.text.toString().trim().ifBlank { Store.DEFAULT_SERVER }
        val topic = topicEdit.text.toString().trim()
        if (topic.isEmpty()) {
            toast("Bitte den Kanal eintragen")
            return
        }
        if (!server.startsWith("http://") && !server.startsWith("https://")) {
            toast("Server muss mit https:// beginnen")
            return
        }
        connect(server, topic)
        toast("Gespeichert – verbinde …")
    }

    private fun stopListening() {
        Store.prefs(this).edit().putBoolean(Store.KEY_ENABLED, false).apply()
        ListenerService.stop(this)
        toast("Gestoppt – du bekommst keine Benachrichtigungen mehr")
    }

    private fun sendTest() {
        if (!Store.isPaired(this)) {
            toast("Erst mit dem Laptop koppeln")
            return
        }
        publish(Store.server(this), Store.topic(this), "✅ Test von der App",
            "Wenn das als Benachrichtigung kommt, ist alles richtig eingerichtet.", emptyList(), feedback = true)
    }

    /** Schickt eine Nachricht in den Kanal (im Hintergrund). */
    private fun publish(server: String, topic: String, title: String, message: String, tags: List<String>,
                        feedback: Boolean = false) {
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
                    .put("title", title)
                    .put("message", message)
                    .put("priority", 4)
                    .put("tags", JSONArray(tags))
                conn.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
                val code = conn.responseCode
                conn.disconnect()
                code in 200..299
            } catch (e: Exception) {
                false
            }
            if (feedback || !ok) {
                runOnUiThread {
                    toast(if (ok) "Test gesendet – kommt gleich als Benachrichtigung" else "Keine Verbindung zum Server – Internet prüfen")
                }
            }
        }.start()
    }

    private fun askBatteryExemption(quiet: Boolean) {
        val pm = getSystemService(PowerManager::class.java)
        if (pm.isIgnoringBatteryOptimizations(packageName)) {
            if (!quiet) toast("Akku-Optimierung ist schon aus ✓")
            return
        }
        try {
            startActivity(Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:$packageName")))
        } catch (e: Exception) {
            startActivity(Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS))
        }
    }

    // --- Anzeige ----------------------------------------------------------------

    private fun applySystemBarInsets(root: View) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.R) return
        root.setOnApplyWindowInsetsListener { v, insets ->
            val bars = insets.getInsets(WindowInsets.Type.systemBars() or WindowInsets.Type.ime())
            v.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
    }

    private fun renderStatus() {
        val paired = Store.isPaired(this)
        pairButton.setText(if (paired) R.string.repair else R.string.pair)
        statusView.text = when {
            !paired -> "Noch nicht gekoppelt – tippe auf „Mit Laptop koppeln“ und scanne den Code auf dem Laptop."
            !Store.isEnabled(this) -> "Gestoppt"
            else -> Store.status(this)
        }
        val seen = Store.botSeen(this)
        val minutes = (System.currentTimeMillis() / 1000 - seen) / 60
        botStatusView.text = when {
            !paired -> ""
            seen == 0L -> "Laptop-Bot: noch kein Lebenszeichen"
            minutes > 75 -> "⚠️ Laptop-Bot seit ${ago(minutes)} still – ist der Laptop an und mit dem Internet verbunden?"
            else -> "💻 Laptop-Bot aktiv (zuletzt vor ${ago(minutes)}) · ${Store.botText(this)}"
        }
    }

    private fun ago(minutes: Long): String = when {
        minutes < 1 -> "weniger als 1 Min."
        minutes < 120 -> "$minutes Min."
        minutes < 48 * 60 -> "${minutes / 60} Std."
        else -> "${minutes / 1440} Tagen"
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

    companion object {
        private const val REQUEST_NOTIFICATIONS = 1
    }
}
