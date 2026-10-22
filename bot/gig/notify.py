"""Push-Benachrichtigungen ans Handy über ntfy (https://ntfy.sh)."""

from __future__ import annotations

import json
import logging
import urllib.request

log = logging.getLogger("gig")


class Notifier:
    def __init__(self, server: str, topic: str, opener=urllib.request.urlopen):
        self.server = server.rstrip("/")
        self.topic = topic
        self._open = opener

    def send(self, title: str, message: str, priority: int = 3, click: str | None = None,
             tags: tuple[str, ...] = ()) -> bool:
        payload = {"topic": self.topic, "title": title, "message": message, "priority": priority}
        if tags:
            payload["tags"] = list(tags)
        if click:
            payload["click"] = click
        req = urllib.request.Request(
            self.server + "/",
            data=json.dumps(payload).encode("utf-8"),
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        try:
            with self._open(req, timeout=15) as resp:
                ok = 200 <= resp.status < 300
        except Exception as e:  # Netzwerkfehler dürfen den Bot nicht stoppen
            log.warning("Benachrichtigung fehlgeschlagen (%s): %s", title, e)
            return False
        if ok:
            log.info("📱 %s – %s", title, message.splitlines()[0] if message else "")
        else:
            log.warning("ntfy antwortete mit HTTP %s", resp.status)
        return ok
