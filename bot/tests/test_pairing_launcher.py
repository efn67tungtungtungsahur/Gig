import importlib.util
import io
import json
import os
import threading
import zipfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

import pytest
from conftest import BOT_DIR

from gig.pairing import PAIRED_TAG, pair_link, pairing_page, wait_for_pairing


class FakeServer(BaseHTTPRequestHandler):
    """Spielt ntfy (Kanal abfragen) und GitHub-Releases (gig-bot.zip) nach."""

    messages: list = []
    files: dict = {}

    def log_message(self, *args):
        pass

    def do_GET(self):
        url = urlparse(self.path)
        if url.path in self.files:
            body = self.files[url.path]
        elif url.path.endswith("/json"):
            assert parse_qs(url.query)["poll"] == ["1"]
            body = "".join(json.dumps(m) + "\n" for m in self.messages).encode()
        else:
            self.send_response(404)
            self.end_headers()
            return
        self.send_response(200)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


@pytest.fixture
def server():
    FakeServer.messages = []
    FakeServer.files = {}
    httpd = ThreadingHTTPServer(("127.0.0.1", 0), FakeServer)
    threading.Thread(target=httpd.serve_forever, daemon=True).start()
    yield f"http://127.0.0.1:{httpd.server_port}"
    httpd.shutdown()


def test_pair_link_and_page(cfg):
    cfg.ntfy_topic = "gig-abc123"
    assert pair_link(cfg) == "gig://pair?server=https%3A%2F%2Fntfy.sh&topic=gig-abc123"
    page = pairing_page(cfg, "ferdi_<123>")
    assert page.count("<svg") == 2
    assert "u/ferdi_&lt;123&gt;" in page


def test_wait_for_pairing(cfg, server):
    cfg.ntfy_server = server
    cfg.ntfy_topic = "gig-abc123"
    FakeServer.messages = [{"id": "1", "event": "message", "title": "Test", "tags": []}]
    assert not wait_for_pairing(cfg, 0, timeout=1)
    FakeServer.messages.append({"id": "2", "event": "message", "title": "📱", "tags": [PAIRED_TAG]})
    assert wait_for_pairing(cfg, 0, timeout=5)


@pytest.fixture
def launcher(tmp_path, monkeypatch, server):
    spec = importlib.util.spec_from_file_location("gig_launcher", BOT_DIR / "launcher.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    monkeypatch.setattr(mod, "APP_DIR", tmp_path)
    monkeypatch.setattr(mod, "DATA_DIR", tmp_path / "data")
    monkeypatch.setattr(mod, "BASE_URL", server + "/release")
    (tmp_path / "data").mkdir()
    return mod


def _zip(files: dict) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        for name, content in files.items():
            zf.writestr(name, content)
    return buf.getvalue()


def test_update_keeps_user_data(launcher, tmp_path):
    (tmp_path / "config.toml").write_text("meine Einstellungen")
    (tmp_path / "data" / "state.json").write_text("{}")
    FakeServer.files["/release/gig-bot.zip"] = _zip({
        "gig_bot.py": "neu", "gig/bot.py": "neu", "config.toml": "überschreiben!", "data/state.json": "weg!",
    })
    assert launcher.update() is True
    assert (tmp_path / "gig_bot.py").read_text() == "neu"
    assert (tmp_path / "gig" / "bot.py").read_text() == "neu"
    assert (tmp_path / "config.toml").read_text() == "meine Einstellungen"
    assert (tmp_path / "data" / "state.json").read_text() == "{}"
    assert launcher.update() is False  # gleiche Version → nichts zu tun

    FakeServer.files["/release/gig-bot.zip"] = _zip({"gig_bot.py": "noch neuer"})
    assert launcher.update() is True
    assert (tmp_path / "gig_bot.py").read_text() == "noch neuer"


def test_update_offline_is_harmless(launcher, monkeypatch):
    monkeypatch.setattr(launcher, "BASE_URL", "http://127.0.0.1:9")
    assert launcher.update() is False


def test_deps_only_when_requirements_change(launcher, tmp_path, monkeypatch):
    calls = []
    monkeypatch.setattr(launcher, "run", lambda cmd, **kw: calls.append(cmd[2:4]) or 0)
    (tmp_path / "requirements.txt").write_text("playwright\n")
    launcher.ensure_deps()
    assert calls == [["pip", "install"], ["playwright", "install"]]
    launcher.ensure_deps()
    assert len(calls) == 2
    (tmp_path / "requirements.txt").write_text("playwright\nqrcode\n")
    launcher.ensure_deps()
    assert len(calls) == 4


def test_single_instance(launcher, monkeypatch):
    monkeypatch.setattr(launcher, "LOCK_PORT", 47000 + os.getpid() % 1000)
    monkeypatch.setattr(launcher.time, "sleep", lambda s: None)
    first = launcher.single_instance()
    assert first is not None
    assert launcher.single_instance() is None
    first.close()
