"""Testet den Browser-Zugriff gegen einen lokalen Fake-Reddit-Server.

Läuft nur, wenn Playwright installiert ist und GIG_TEST_BROWSER auf eine Chromium-Datei
zeigt (oder "bundled" für den von Playwright installierten Chromium).
"""

import json
import os
import threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import pytest

pytest.importorskip("playwright.sync_api")
BROWSER = os.environ.get("GIG_TEST_BROWSER")
pytestmark = pytest.mark.skipif(not BROWSER, reason="GIG_TEST_BROWSER nicht gesetzt")

from conftest import make_comment, make_post  # noqa: E402

from gig.reddit import (  # noqa: E402
    AccessBlocked,
    NotLoggedIn,
    RateLimited,
    RedditError,
    RedditSession,
    Unavailable,
    open_browser,
)

POSTED = []
SUBSCRIBED = []


class FakeReddit(BaseHTTPRequestHandler):
    def log_message(self, *args):
        pass

    def _send(self, status, body, ctype="application/json"):
        data = body if isinstance(body, bytes) else json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _logged_in(self):
        return "session=ok" in (self.headers.get("Cookie") or "")

    def do_GET(self):
        url = urlparse(self.path)
        if url.path == "/":
            return self._send(200, b"<html><body>fake reddit</body></html>", "text/html")
        if url.path == "/api/me.json":
            return self._send(200, {"kind": "t2", "data": {"name": "ferdi_123", "modhash": "mh123"}}
                              if self._logged_in() else {})
        if url.path == "/r/RepWatchClud/new.json":
            query = parse_qs(url.query)
            assert query["raw_json"] == ["1"]
            if query.get("after") == ["t3_p2"]:  # zweite Seite
                return self._send(200, {"kind": "Listing", "data": {"after": None, "children": [
                    {"kind": "t3", "data": make_post("p3", title="Older giveaway")}]}})
            return self._send(200, {"kind": "Listing", "data": {"after": "t3_p2", "children": [
                {"kind": "t3", "data": make_post()}, {"kind": "t3", "data": make_post("p2", title="QC")}]}})
        if url.path == "/r/private/new.json":
            return self._send(403, {"reason": "private", "error": 403})
        if url.path == "/blocked/new.json":
            return self._send(403, b"<html>blocked by network security</html>", "text/html")
        if url.path == "/r/captcha/new.json":
            return self._send(200, b"<html>are you a robot?</html>", "text/html")
        if url.path == "/comments/abc123.json":
            listing = {"kind": "Listing", "data": {"children": [{"kind": "t3", "data": make_post()}]}}
            reply = make_comment("c2", "host", "Congrats!", "t1_c1")
            top = make_comment("c1", "ferdi_123", "in", "t3_abc123",
                               replies={"kind": "Listing", "data": {"children": [reply]}})
            return self._send(200, [listing, {"kind": "Listing", "data": {"children": [top]}}])
        return self._send(404, {"error": 404})

    def do_POST(self):
        length = int(self.headers.get("Content-Length") or 0)
        form = {k: v[0] for k, v in parse_qs(self.rfile.read(length).decode()).items()}
        path = urlparse(self.path).path
        if not self._logged_in() or form.get("uh") != "mh123":
            return self._send(403, {"error": 403})
        if path == "/api/subscribe":
            SUBSCRIBED.append((form["action"], form["sr_name"]))
            return self._send(200, {})
        if path != "/api/comment":
            return self._send(404, {})
        if form["text"] == "ratelimit":
            return self._send(200, {"json": {"ratelimit": 299.5, "errors": [
                ["RATELIMIT", "Looks like you've been doing that a lot. Take a break for 5 minutes", "ratelimit"]]}})
        if form["text"] == "locked":
            return self._send(200, {"json": {"errors": [["THREAD_LOCKED", "that thread is locked", "parent"]]}})
        POSTED.append(form)
        return self._send(200, {"json": {"errors": [], "data": {"things": [
            {"kind": "t1", "data": {"id": "new1", "name": "t1_new1"}}]}}})


@pytest.fixture(scope="module")
def server():
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), FakeReddit)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{httpd.server_port}"
    httpd.shutdown()


@pytest.fixture
def browser(cfg, server):
    if BROWSER != "bundled":
        cfg.browser_executable = BROWSER
    with open_browser(cfg, headless=True) as (ctx, page):
        yield ctx, page


def test_not_logged_in(browser, server):
    _, page = browser
    with pytest.raises(NotLoggedIn):
        RedditSession(page, server).me()


def test_reads_and_comments(browser, server):
    ctx, page = browser
    ctx.add_cookies([{"name": "session", "value": "ok", "url": server}])
    reddit = RedditSession(page, server)
    assert reddit.me() == "ferdi_123"

    posts = reddit.new_posts("RepWatchClud")
    assert [p["id"] for p in posts] == ["abc123", "p2"]
    assert [p["id"] for p in reddit.new_posts("RepWatchClud", pages=4)] == ["abc123", "p2", "p3"]

    reddit.subscribe("RepWatchClud")
    reddit.subscribe("u_ContributionAble4509")
    assert SUBSCRIBED == [("sub", "RepWatchClud"), ("sub", "u_ContributionAble4509")]

    post, comments = reddit.thread("abc123")
    assert post["id"] == "abc123"
    assert [c["id"] for c in comments] == ["c1", "c2"]

    assert reddit.post_comment("t3_abc123", "I'm in! 🍀 äöü") == "t1_new1"
    assert POSTED[-1] == {"thing_id": "t3_abc123", "text": "I'm in! 🍀 äöü", "uh": "mh123", "api_type": "json"}

    with pytest.raises(RateLimited) as e:
        reddit.post_comment("t3_abc123", "ratelimit")
    assert e.value.seconds == 300

    with pytest.raises(RedditError, match="THREAD_LOCKED"):
        reddit.post_comment("t3_abc123", "locked")


def test_errors(browser, server):
    ctx, page = browser
    ctx.add_cookies([{"name": "session", "value": "ok", "url": server}])
    reddit = RedditSession(page, server)
    with pytest.raises(Unavailable, match="private"):
        reddit.new_posts("private")
    with pytest.raises(Unavailable, match="404"):
        reddit.new_posts("doesnotexist")
    with pytest.raises(AccessBlocked):
        reddit._call("GET", "/blocked/new.json")
    with pytest.raises(AccessBlocked):
        reddit.new_posts("captcha")
