#!/usr/bin/env python3
"""Startet Gig im Hintergrund und kümmert sich um alles Weitere.

- hält den Bot am Laufen (Neustart nach Absturz)
- holt sich automatisch neue Versionen von GitHub
- verhindert, dass der Laptop einschläft, solange der Bot läuft
- läuft nur einmal gleichzeitig

    python launcher.py          im Hintergrund laufen (so startet ihn der Autostart)
    python launcher.py --setup  nur Abhängigkeiten installieren (für das Installationsskript)
"""

from __future__ import annotations

import ctypes
import hashlib
import io
import logging
import os
import socket
import subprocess
import sys
import time
import urllib.request
import zipfile
from logging.handlers import RotatingFileHandler
from pathlib import Path

APP_DIR = Path(__file__).resolve().parent
DATA_DIR = APP_DIR / "data"
BASE_URL = os.environ.get(
    "GIG_BASE_URL", "https://github.com/efn67tungtungtungsahur/Gig/releases/download/app-latest"
).rstrip("/")
LOCK_PORT = 47613
UPDATE_EVERY = int(os.environ.get("GIG_UPDATE_EVERY", 6 * 3600))
KEEP = ("data/", "config.toml")  # wird bei Updates nie überschrieben

log = logging.getLogger("gig.launcher")
NO_WINDOW = getattr(subprocess, "CREATE_NO_WINDOW", 0)


def python_exe() -> str:
    """python.exe statt pythonw.exe für Unterprozesse (pip, playwright, Bot)."""
    exe = Path(sys.executable)
    if exe.name.lower() == "pythonw.exe" and exe.with_name("python.exe").exists():
        return str(exe.with_name("python.exe"))
    return str(exe)


def run(cmd: list[str], **kw) -> int:
    log.info("$ %s", " ".join(cmd))
    return subprocess.run(cmd, cwd=APP_DIR, creationflags=NO_WINDOW, **kw).returncode


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


# --- Updates ------------------------------------------------------------------


def update() -> bool:
    """Lädt die neueste Version. Gibt True zurück, wenn sich etwas geändert hat."""
    try:
        with urllib.request.urlopen(f"{BASE_URL}/gig-bot.zip", timeout=60) as resp:
            data = resp.read()
    except Exception as e:
        log.warning("Update-Prüfung fehlgeschlagen: %s", e)
        return False
    digest = sha256(data)
    version_file = APP_DIR / ".version"
    if version_file.exists() and version_file.read_text().strip() == digest:
        return False
    with zipfile.ZipFile(io.BytesIO(data)) as zf:
        for info in zf.infolist():
            name = info.filename
            if info.is_dir() or name.startswith(KEEP) or ".." in name or name.startswith("/"):
                continue
            target = APP_DIR / name
            target.parent.mkdir(parents=True, exist_ok=True)
            target.write_bytes(zf.read(info))
    version_file.write_text(digest)
    log.info("Neue Version installiert (%s)", digest[:12])
    return True


def ensure_deps(force: bool = False) -> None:
    """Python-Pakete und Browser installieren, wenn sich requirements.txt geändert hat."""
    req = APP_DIR / "requirements.txt"
    marker = DATA_DIR / ".deps"
    digest = sha256(req.read_bytes())
    if not force and marker.exists() and marker.read_text().strip() == digest:
        return
    py = python_exe()
    if run([py, "-m", "pip", "install", "--disable-pip-version-check", "-q", "-r", str(req)]) != 0:
        raise RuntimeError("pip install fehlgeschlagen")
    if run([py, "-m", "playwright", "install", "chromium"]) != 0:
        raise RuntimeError("Browser-Installation fehlgeschlagen")
    marker.write_text(digest)


# --- Hintergrundbetrieb -------------------------------------------------------


class _PowerStatus(ctypes.Structure):
    _fields_ = [("ACLineStatus", ctypes.c_ubyte), ("BatteryFlag", ctypes.c_ubyte),
                ("BatteryLifePercent", ctypes.c_ubyte), ("SystemStatusFlag", ctypes.c_ubyte),
                ("BatteryLifeTime", ctypes.c_ulong), ("BatteryFullLifeTime", ctypes.c_ulong)]


def keep_awake() -> None:
    """Verhindert den Ruhezustand, solange der Laptop am Strom hängt (Bildschirm darf ausgehen).

    Unter Windows wird das regelmäßig neu geprüft, damit der Akku im Akkubetrieb nicht leerläuft.
    """
    try:
        if sys.platform == "win32":
            status = _PowerStatus()
            ctypes.windll.kernel32.GetSystemPowerStatus(ctypes.byref(status))
            es_continuous, es_system_required = 0x80000000, 0x00000001
            flags = es_continuous | (es_system_required if status.ACLineStatus != 0 else 0)
            ctypes.windll.kernel32.SetThreadExecutionState(flags)
        elif sys.platform == "darwin" and not getattr(keep_awake, "started", False):
            subprocess.Popen(["caffeinate", "-s", "-w", str(os.getpid())])  # -s: nur am Netzteil
            keep_awake.started = True
    except Exception as e:
        log.warning("Wachhalten nicht möglich: %s", e)


def single_instance() -> socket.socket | None:
    for _ in range(10):  # nach einem Selbst-Update kurz warten, bis die alte Instanz weg ist
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        try:
            sock.bind(("127.0.0.1", LOCK_PORT))
            return sock
        except OSError:
            sock.close()
            time.sleep(1)
    return None


def start_bot() -> subprocess.Popen:
    env = dict(os.environ, GIG_BACKGROUND="1", PYTHONIOENCODING="utf-8")
    errors = open(DATA_DIR / "bot-errors.log", "a", encoding="utf-8")
    return subprocess.Popen([python_exe(), str(APP_DIR / "gig_bot.py"), "run"], cwd=APP_DIR, env=env,
                            stdout=subprocess.DEVNULL, stderr=errors, creationflags=NO_WINDOW)


def stop_bot(proc: subprocess.Popen) -> None:
    (DATA_DIR / "stop").touch()  # Bot beendet sich beim nächsten Durchlauf sauber
    try:
        proc.wait(timeout=90)
    except subprocess.TimeoutExpired:
        proc.terminate()
        proc.wait(timeout=30)


def restart_launcher(lock: socket.socket) -> None:
    lock.close()
    log.info("Launcher wurde aktualisiert – starte neu")
    detached = getattr(subprocess, "DETACHED_PROCESS", 0) | NO_WINDOW
    subprocess.Popen([sys.executable, str(APP_DIR / "launcher.py")], cwd=APP_DIR, creationflags=detached,
                     start_new_session=sys.platform != "win32")
    sys.exit(0)


def supervise() -> int:
    lock = single_instance()
    if lock is None:
        log.info("Gig läuft schon.")
        return 0
    keep_awake()
    launcher_hash = sha256((APP_DIR / "launcher.py").read_bytes())
    if update() and sha256((APP_DIR / "launcher.py").read_bytes()) != launcher_hash:
        restart_launcher(lock)
    ensure_deps()

    backoff = 30
    next_update = time.time() + UPDATE_EVERY
    while True:
        started = time.time()
        proc = start_bot()
        log.info("Bot gestartet (PID %s)", proc.pid)
        updated = False
        while proc.poll() is None:
            time.sleep(20)
            keep_awake()
            if time.time() >= next_update:
                next_update = time.time() + UPDATE_EVERY
                if update():
                    stop_bot(proc)
                    updated = True
        if updated:
            if sha256((APP_DIR / "launcher.py").read_bytes()) != launcher_hash:
                restart_launcher(lock)
            ensure_deps()
            continue
        log.warning("Bot beendet (Code %s)", proc.returncode)
        backoff = 30 if time.time() - started > 1800 else min(backoff * 2, 1800)
        time.sleep(backoff)


def main() -> int:
    DATA_DIR.mkdir(exist_ok=True)
    handlers: list[logging.Handler] = [
        RotatingFileHandler(DATA_DIR / "launcher.log", maxBytes=500_000, backupCount=2, encoding="utf-8")
    ]
    if sys.stdout is not None:
        handlers.append(logging.StreamHandler(sys.stdout))
    logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(message)s", handlers=handlers)

    if "--setup" in sys.argv:
        update()
        ensure_deps(force=True)
        return 0
    return supervise()


if __name__ == "__main__":
    sys.exit(main())
