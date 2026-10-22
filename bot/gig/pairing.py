"""Handy-App per QR-Code koppeln: Der Laptop zeigt einen Code, die App scannt ihn."""

from __future__ import annotations

import html
import json
import logging
import time
import urllib.request
from urllib.parse import quote, urlencode

from .config import Config

log = logging.getLogger("gig")

APK_URL = "https://github.com/efn67tungtungtungsahur/Gig/releases/download/app-latest/gig.apk"
PAIRED_TAG = "gig_paired"
STATUS_TAG = "gig_status"


def pair_link(cfg: Config) -> str:
    return "gig://pair?" + urlencode({"server": cfg.ntfy_server, "topic": cfg.ntfy_topic})


def qr_svg(data: str) -> str:
    import qrcode
    import qrcode.image.svg

    img = qrcode.make(data, image_factory=qrcode.image.svg.SvgPathImage, box_size=12, border=2)
    return img.to_string(encoding="unicode")


def pairing_page(cfg: Config, username: str | None) -> str:
    """HTML-Seite mit zwei QR-Codes: App herunterladen und App koppeln."""
    who = f"Eingeloggt als <b>u/{html.escape(username)}</b> ✅" if username else ""
    return f"""<!doctype html>
<html lang="de"><head><meta charset="utf-8"><title>Gig – Handy koppeln</title>
<style>
  body {{ font-family: system-ui, sans-serif; background: #f5f3ff; color: #1f1147; margin: 0; padding: 24px; }}
  h1 {{ margin: 0 0 4px; }} .who {{ color: #5b21b6; margin-bottom: 16px; }}
  .row {{ display: flex; gap: 24px; flex-wrap: wrap; }}
  .card {{ background: #fff; border-radius: 16px; padding: 20px; width: 300px; box-shadow: 0 2px 12px #0001; }}
  .card h2 {{ font-size: 18px; margin: 0 0 8px; }} .card p {{ margin: 0 0 12px; font-size: 14px; }}
  .qr svg {{ width: 260px; height: 260px; background: #fff; }}
  #status {{ margin-top: 20px; font-size: 20px; font-weight: bold; }}
  .ok {{ color: #15803d; }}
</style></head><body>
<h1>🎁 Gig – letzter Schritt: Handy koppeln</h1>
<div class="who">{who}</div>
<div class="row">
  <div class="card"><h2>1. App aufs Handy</h2>
    <p>Noch keine Gig-App? Diesen Code mit der Handy-Kamera scannen, <b>gig.apk</b> herunterladen und installieren.</p>
    <div class="qr">{qr_svg(APK_URL)}</div></div>
  <div class="card"><h2>2. Koppeln</h2>
    <p>In der Gig-App auf <b>„Mit Laptop koppeln“</b> tippen und diesen Code scannen.</p>
    <div class="qr">{qr_svg(pair_link(cfg))}</div></div>
</div>
<div id="status">⏳ Warte auf dein Handy …</div>
</body></html>"""


def wait_for_pairing(cfg: Config, since: float, timeout: float, is_cancelled=lambda: False) -> bool:
    """Wartet, bis die App sich über den ntfy-Kanal meldet."""
    url = f"{cfg.ntfy_server}/{quote(cfg.ntfy_topic)}/json?poll=1&since={int(since)}"
    deadline = time.time() + timeout
    while time.time() < deadline and not is_cancelled():
        try:
            with urllib.request.urlopen(url, timeout=20) as resp:
                for line in resp.read().decode("utf-8").splitlines():
                    try:
                        msg = json.loads(line)
                    except ValueError:
                        continue
                    if PAIRED_TAG in (msg.get("tags") or []):
                        return True
        except Exception as e:  # kurz offline o. ä. – einfach weiter warten
            log.debug("Kopplungs-Abfrage fehlgeschlagen: %s", e)
        time.sleep(3)
    return False


def show_pairing(cfg: Config, page, notifier, username: str | None, timeout: float = 1800) -> bool:
    """Zeigt die Kopplungsseite im (sichtbaren) Browserfenster und wartet auf das Handy."""
    started = time.time() - 5
    page.set_content(pairing_page(cfg, username))
    page.bring_to_front()
    print("\n📱 Im Browserfenster sind jetzt zwei QR-Codes: App installieren und App koppeln.")
    paired = wait_for_pairing(cfg, started, timeout, is_cancelled=page.is_closed)
    if paired and not page.is_closed():
        page.evaluate(
            "document.getElementById('status').innerHTML = "
            "'<span class=\"ok\">✅ Handy verbunden! Fertig – das Fenster schließt sich gleich.</span>'"
        )
        notifier.send("✅ Gig ist verbunden", "Ab jetzt bekommst du hier Bescheid, wenn du ein Giveaway gewinnst.",
                      priority=4)
        print("✅ Handy verbunden!")
        time.sleep(6)
    return paired
