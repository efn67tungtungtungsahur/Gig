package com.gig.app

import org.json.JSONObject

/** Eine Benachrichtigung vom Bot (Format: ntfy-JSON). */
data class GigMessage(
    val id: String,
    val time: Long,
    val title: String,
    val message: String,
    val priority: Int,
    val click: String?,
) {
    val important: Boolean get() = priority >= 4

    fun toJson(): JSONObject = JSONObject()
        .put("id", id)
        .put("time", time)
        .put("title", title)
        .put("message", message)
        .put("priority", priority)
        .put("click", click ?: "")

    companion object {
        fun fromJson(o: JSONObject?): GigMessage? {
            if (o == null) return null
            val id = o.optString("id")
            if (id.isEmpty()) return null
            return GigMessage(
                id = id,
                time = o.optLong("time", System.currentTimeMillis() / 1000),
                title = o.optString("title").ifBlank { "Gig" },
                message = o.optString("message"),
                priority = o.optInt("priority", 3),
                click = o.optString("click").ifBlank { null },
            )
        }
    }
}
