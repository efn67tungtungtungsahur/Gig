package com.gig.app

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.net.Uri

object AppNotifications {
    private const val CHANNEL_WINS = "wins"
    private const val CHANNEL_INFO = "info"
    private const val CHANNEL_SERVICE = "service"
    const val SERVICE_ID = 1

    private fun manager(ctx: Context): NotificationManager =
        ctx.getSystemService(NotificationManager::class.java)

    fun createChannels(ctx: Context) {
        val wins = NotificationChannel(CHANNEL_WINS, "Gewinne & Wichtiges", NotificationManager.IMPORTANCE_HIGH).apply {
            description = "Gewinne, Erwähnungen in Giveaways und Probleme mit dem Bot"
            enableVibration(true)
            vibrationPattern = longArrayOf(0, 400, 200, 400, 200, 800)
            enableLights(true)
        }
        val info = NotificationChannel(CHANNEL_INFO, "Teilnahmen & neue Giveaways", NotificationManager.IMPORTANCE_DEFAULT).apply {
            description = "Wenn der Bot teilnimmt oder ein neues Giveaway findet"
        }
        val service = NotificationChannel(CHANNEL_SERVICE, "Hintergrund-Verbindung", NotificationManager.IMPORTANCE_MIN).apply {
            description = "Dauerhafte Anzeige, solange die App auf Nachrichten wartet"
            setShowBadge(false)
        }
        manager(ctx).createNotificationChannels(listOf(wins, info, service))
    }

    fun show(ctx: Context, msg: GigMessage) {
        val target = msg.click?.let { Intent(Intent.ACTION_VIEW, Uri.parse(it)) }
            ?: Intent(ctx, MainActivity::class.java)
        target.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        val pending = PendingIntent.getActivity(
            ctx, msg.id.hashCode(), target,
            PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
        )
        val notification = Notification.Builder(ctx, if (msg.important) CHANNEL_WINS else CHANNEL_INFO)
            .setSmallIcon(R.drawable.ic_notification)
            .setColor(ctx.getColor(R.color.purple))
            .setContentTitle(msg.title)
            .setContentText(msg.message)
            .setStyle(Notification.BigTextStyle().bigText(msg.message))
            .setContentIntent(pending)
            .setAutoCancel(true)
            .setWhen(msg.time * 1000)
            .setShowWhen(true)
            .setCategory(if (msg.important) Notification.CATEGORY_MESSAGE else Notification.CATEGORY_SOCIAL)
            .build()
        manager(ctx).notify(msg.id.hashCode(), notification)
    }

    fun serviceNotification(ctx: Context, status: String): Notification {
        val open = PendingIntent.getActivity(
            ctx, 0, Intent(ctx, MainActivity::class.java), PendingIntent.FLAG_IMMUTABLE,
        )
        return Notification.Builder(ctx, CHANNEL_SERVICE)
            .setSmallIcon(R.drawable.ic_notification)
            .setContentTitle("Gig wartet auf Giveaway-News")
            .setContentText(status)
            .setOngoing(true)
            .setContentIntent(open)
            .build()
    }

    fun updateService(ctx: Context, status: String) {
        manager(ctx).notify(SERVICE_ID, serviceNotification(ctx, status))
    }
}
