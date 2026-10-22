"""Reddit-Zugriff über einen echten, eingeloggten Browser (Playwright).

Reddits offizielle API ist für neue Apps praktisch geschlossen. Deshalb nutzt der Bot
deinen normalen Reddit-Login in einem eigenen Browser-Profil und ruft von dort dieselben
Adressen auf, die auch die Reddit-Webseite (old.reddit.com) selbst benutzt.
"""

from __future__ import annotations

import json
import logging
import re
import time
from contextlib import contextmanager
from urllib.parse import urlencode

from .config import Config
from .detect import flatten_comments

try:
    from playwright.sync_api import Error as PlaywrightError
except ImportError:  # erlaubt die Tests ohne installiertes Playwright
    class PlaywrightError(Exception):
        pass

log = logging.getLogger("gig")

LOGIN_URL = "https://www.reddit.com/login/"


class RedditError(Exception):
    pass


class NotLoggedIn(RedditError):
    pass


class AccessBlocked(RedditError):
    pass


class RateLimited(RedditError):
    def __init__(self, message: str, seconds: int):
        super().__init__(message)
        self.seconds = seconds


class CommentRejected(RedditError):
    pass


class BrowserClosed(Exception):
    pass


_FETCH_JS = """
async ([method, url, form]) => {
  const opts = { method, credentials: 'include', headers: { 'Accept': 'application/json' } };
  if (form) {
    opts.body = new URLSearchParams(form).toString();
    opts.headers['Content-Type'] = 'application/x-www-form-urlencoded';
  }
  const r = await fetch(url, opts);
  return { status: r.status, retryAfter: r.headers.get('retry-after'), text: await r.text() };
}
"""


def _origin(url: str) -> str | None:
    m = re.match(r"https?://[^/]+", url or "")
    return m.group(0) if m else None


def _ratelimit_seconds(message: str, payload: dict) -> int:
    if isinstance(payload.get("ratelimit"), (int, float)):
        return int(payload["ratelimit"]) + 1
    m = re.search(r"(\d+)\s*(second|minute|hour)", message or "", re.IGNORECASE)
    if not m:
        return 600
    factor = {"second": 1, "minute": 60, "hour": 3600}[m.group(2).lower()]
    return int(m.group(1)) * factor + 1


class RedditSession:
    def __init__(self, page, base_url: str = "https://old.reddit.com", sleep=time.sleep):
        self.page = page
        self.base = base_url.rstrip("/")
        self.username: str | None = None
        self._modhash: str | None = None
        self._sleep = sleep

    # --- Grundlagen ---------------------------------------------------------

    def _ensure_origin(self) -> None:
        if _origin(self.page.url) == self.base:
            return
        try:
            self.page.goto(self.base + "/", wait_until="domcontentloaded", timeout=60000)
        except PlaywrightError as e:
            self._raise_browser_error(e)
        origin = _origin(self.page.url)
        if origin and origin != self.base:
            log.info("Reddit leitet auf %s um – nutze diese Adresse", origin)
            self.base = origin

    @staticmethod
    def _raise_browser_error(e: Exception):
        msg = str(e)
        if "closed" in msg.lower():
            raise BrowserClosed(msg) from e
        raise RedditError("Netzwerkfehler: " + msg.splitlines()[0]) from e

    def _call(self, method: str, path: str, params: dict | None = None, form: dict | None = None):
        self._ensure_origin()
        url = self.base + path + ("?" + urlencode(params) if params else "")
        for _ in range(3):
            try:
                res = self.page.evaluate(_FETCH_JS, [method, url, form])
            except PlaywrightError as e:
                self._raise_browser_error(e)
            status = res["status"]
            if status == 429:
                wait = min(int(res.get("retryAfter") or 60), 300)
                log.warning("Reddit: zu viele Anfragen – warte %ss", wait)
                self._sleep(wait)
                continue
            text = res.get("text") or ""
            if status in (401, 403):
                reason = self._reason(text)
                if reason:
                    raise RedditError(f"{path}: nicht zugänglich ({reason})")
                raise AccessBlocked(
                    f"Reddit verweigert den Zugriff (HTTP {status}). Bist du noch eingeloggt? "
                    "Falls ja: in config.toml headless = false setzen."
                )
            if status >= 400:
                raise RedditError(f"HTTP {status} bei {path}")
            try:
                return json.loads(text)
            except ValueError:
                raise AccessBlocked(
                    f"Reddit hat statt Daten eine Webseite geliefert ({path}) – evtl. Captcha oder "
                    "Sperrseite. Setze in config.toml headless = false und starte neu."
                ) from None
        raise RedditError("Reddit: dauerhaft zu viele Anfragen (429)")

    @staticmethod
    def _reason(text: str) -> str | None:
        try:
            data = json.loads(text)
        except ValueError:
            return None
        return data.get("reason") if isinstance(data, dict) else None

    # --- Lesen --------------------------------------------------------------

    def me(self) -> str:
        data = self._call("GET", "/api/me.json")
        d = data.get("data", data) if isinstance(data, dict) else {}
        name = d.get("name")
        if not name:
            raise NotLoggedIn("Nicht bei Reddit eingeloggt")
        self.username = name
        self._modhash = d.get("modhash") or self._modhash
        return name

    @staticmethod
    def _children(data, kind: str | None = None) -> list:
        children = data.get("data", {}).get("children", []) if isinstance(data, dict) else []
        return [c for c in children if kind is None or c.get("kind") == kind]

    def new_posts(self, subreddit: str, limit: int = 50) -> list[dict]:
        data = self._call("GET", f"/r/{subreddit}/new.json", {"limit": limit, "raw_json": 1})
        return [c["data"] for c in self._children(data, "t3")]

    def search(self, query: str, limit: int = 50) -> list[dict]:
        params = {"q": query, "sort": "new", "t": "week", "type": "link", "limit": limit, "raw_json": 1}
        data = self._call("GET", "/search.json", params)
        return [c["data"] for c in self._children(data, "t3")]

    def thread(self, post_id: str, limit: int = 300) -> tuple[dict, list[dict]]:
        data = self._call("GET", f"/comments/{post_id}.json", {"sort": "new", "limit": limit, "raw_json": 1})
        post = data[0]["data"]["children"][0]["data"]
        comments = flatten_comments(data[1]["data"]["children"]) if len(data) > 1 else []
        return post, comments

    def user_comments(self, username: str, limit: int = 100) -> list[dict]:
        data = self._call("GET", f"/user/{username}/comments.json", {"limit": limit, "sort": "new", "raw_json": 1})
        return [c["data"] for c in self._children(data, "t1")]

    def inbox(self, limit: int = 50) -> list[dict]:
        data = self._call("GET", "/message/inbox.json", {"limit": limit, "raw_json": 1})
        return self._children(data)

    # --- Schreiben ----------------------------------------------------------

    def post_comment(self, fullname: str, text: str) -> str:
        """Kommentiert einen Post. Gibt die ID des neuen Kommentars zurück (t1_...)."""
        if not self._modhash:
            self.me()
        form = {"thing_id": fullname, "text": text, "uh": self._modhash or "", "api_type": "json"}
        try:
            data = self._call("POST", "/api/comment", form=form)
        except AccessBlocked:
            self.me()  # Sicherheits-Token (modhash) erneuern und einmal wiederholen
            form["uh"] = self._modhash or ""
            data = self._call("POST", "/api/comment", form=form)

        payload = data.get("json", {}) if isinstance(data, dict) else {}
        errors = payload.get("errors") or []
        if errors:
            code = errors[0][0] if errors[0] else "ERROR"
            message = errors[0][1] if len(errors[0]) > 1 else ""
            if code == "RATELIMIT":
                raise RateLimited(message, _ratelimit_seconds(message, payload))
            if code in ("USER_REQUIRED", "BAD_CSRF"):
                self._modhash = None
                raise NotLoggedIn(f"{code}: {message}")
            raise CommentRejected(f"{code}: {message}")

        things = payload.get("data", {}).get("things") or []
        if not things:
            raise RedditError("Unerwartete Antwort von Reddit beim Kommentieren")
        d = things[0].get("data", {})
        return d.get("name") or ("t1_" + d["id"] if d.get("id") else "")


# --- Browser ----------------------------------------------------------------


@contextmanager
def open_browser(cfg: Config, headless: bool | None = None):
    """Startet den Browser mit eigenem, dauerhaftem Profil (Login bleibt gespeichert)."""
    from playwright.sync_api import sync_playwright

    profile = cfg.data_dir / "browser-profile"
    profile.mkdir(parents=True, exist_ok=True)
    kwargs: dict = {"headless": cfg.headless if headless is None else headless}
    if cfg.browser_executable:
        kwargs["executable_path"] = cfg.browser_executable
    elif cfg.browser_channel:
        kwargs["channel"] = cfg.browser_channel
    pw = sync_playwright().start()
    try:
        ctx = pw.chromium.launch_persistent_context(str(profile), **kwargs)
        try:
            page = ctx.pages[0] if ctx.pages else ctx.new_page()
            yield ctx, page
        finally:
            try:
                ctx.close()
            except Exception:  # Browser ist evtl. schon beendet (z. B. nach Strg+C)
                pass
    finally:
        try:
            pw.stop()
        except Exception:
            pass


def _logged_in_name(ctx, base_url: str) -> str | None:
    try:
        resp = ctx.request.get(base_url + "/api/me.json", timeout=15000)
        data = resp.json() if resp.ok else {}
    except (PlaywrightError, ValueError):
        return None
    d = data.get("data", data) if isinstance(data, dict) else {}
    return d.get("name")


def interactive_login(cfg: Config, timeout: int = 900) -> str:
    """Öffnet ein sichtbares Browserfenster, in dem du dich bei Reddit einloggst."""
    with open_browser(cfg, headless=False) as (ctx, page):
        name = _logged_in_name(ctx, cfg.reddit_url)
        if name:
            print(f"✅ Schon eingeloggt als u/{name}")
            return name
        page.goto(LOGIN_URL)
        print("\n👉 Im geöffneten Browserfenster bei Reddit einloggen (auch Google/Apple-Login geht).")
        print("   Das Fenster schließt sich danach automatisch.\n")
        deadline = time.time() + timeout
        while time.time() < deadline:
            time.sleep(3)
            if page.is_closed():
                raise BrowserClosed("Login-Fenster wurde geschlossen")
            name = _logged_in_name(ctx, cfg.reddit_url)
            if name:
                print(f"✅ Eingeloggt als u/{name}")
                return name
        raise NotLoggedIn("Login nicht innerhalb von 15 Minuten abgeschlossen")
