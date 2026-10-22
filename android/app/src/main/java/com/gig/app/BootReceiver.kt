package com.gig.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/** Startet das Zuhören nach einem Neustart des Handys oder einem App-Update wieder. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (!Store.isEnabled(context) || Store.topic(context).isBlank()) return
        try {
            ListenerService.start(context)
        } catch (e: Exception) {
            Log.w("Gig", "Dienst konnte nicht gestartet werden", e)
        }
    }
}
