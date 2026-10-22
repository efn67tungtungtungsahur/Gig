"""Kommandozeile: python gig_bot.py [run|setup|login|pair|check|test|status]"""

from __future__ import annotations

import argparse
import logging
import os
import sys
import time
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path

from .bot import PROBLEM_REPEAT_SECONDS, GiveawayBot
from .config import DEFAULT_PATH, Config, ConfigError, load_config
from .detect import is_giveaway
from .notify import Notifier
from .pairing import show_pairing
from .reddit import (
    AccessBlocked,
    BrowserClosed,
    NotLoggedIn,
    RedditError,
    RedditSession,
    interactive_login,
    login_in_window,
    open_browser,
)
from .state import State

log = logging.getLogger("gig")


def _setup_logging(cfg: Config, verbose: bool) -> None:
    fmt = logging.Formatter("%(asctime)s  %(message)s", "%d.%m. %H:%M:%S")
    handlers: list[logging.Handler] = [
        RotatingFileHandler(cfg.data_dir / "bot.log", maxBytes=1_000_000, backupCount=3, encoding="utf-8")
    ]
    if sys.stdout is not None:  # unter pythonw (Hintergrund) gibt es keine Konsole
        handlers.append(logging.StreamHandler(sys.stdout))
    for h in handlers:
        h.setFormatter(fmt)
    log.handlers[:] = handlers
    log.setLevel(logging.DEBUG if verbose else logging.INFO)


def _background() -> bool:
    return os.environ.get("GIG_BACKGROUND") == "1"


def _print_pairing(cfg: Config) -> None:
    print("\n📱 Handy-App: Am einfachsten mit  python gig_bot.py pair  per QR-Code koppeln.")
    print(f"   Von Hand: Server {cfg.ntfy_server}  ·  Kanal {cfg.ntfy_topic}\n")


def cmd_login(cfg: Config, args) -> int:
    interactive_login(cfg)
    return 0


def cmd_setup(cfg: Config, args) -> int:
    """Einrichtung in einem Fenster: Reddit-Login, dann Handy per QR-Code koppeln."""
    state = State.load(cfg.data_dir / "state.json")
    notifier = Notifier(cfg.ntfy_server, cfg.ntfy_topic)
    try:
        with open_browser(cfg, headless=False) as (ctx, page):
            name = login_in_window(ctx, page, cfg)
            if show_pairing(cfg, page, notifier, name):
                state.welcomed = False  # „Gig läuft“ kommt dann vom Bot selbst
            else:
                print("Handy noch nicht gekoppelt – später geht das über die Verknüpfung „Gig – Handy koppeln“.")
    except BrowserClosed:
        print("Fenster geschlossen.")
    state.save()
    return 0


def cmd_pair(cfg: Config, args) -> int:
    with open_browser(cfg, headless=False) as (ctx, page):
        try:
            show_pairing(cfg, page, Notifier(cfg.ntfy_server, cfg.ntfy_topic), None)
        except Exception:  # Fenster geschlossen
            pass
    return 0


def cmd_test(cfg: Config, args) -> int:
    ok = Notifier(cfg.ntfy_server, cfg.ntfy_topic).send(
        "✅ Gig ist verbunden", "Wenn du das auf dem Handy siehst, klappen die Benachrichtigungen.",
        priority=4)
    print("Test-Benachrichtigung gesendet ✅" if ok else "❌ Senden fehlgeschlagen – Internet/Server prüfen.")
    return 0 if ok else 1


def cmd_check(cfg: Config, args) -> int:
    print("Prüfe Reddit-Zugriff …")
    with open_browser(cfg) as (_, page):
        reddit = RedditSession(page, cfg.reddit_url)
        try:
            print(f"✅ Eingeloggt als u/{reddit.me()}")
        except NotLoggedIn:
            print("❌ Nicht eingeloggt. Erst: python gig_bot.py login")
            return 1
        except AccessBlocked as e:
            print(f"❌ {e}")
            return 3
        for sub in cfg.subreddits:
            try:
                posts = reddit.new_posts(sub)
            except RedditError as e:
                print(f"❌ r/{sub}: {e}")
                continue
            found = [p for p in posts if is_giveaway(p, cfg)]
            print(f"✅ r/{sub}: {len(posts)} neue Posts gelesen, davon {len(found)} Giveaways")
            for p in found[:10]:
                age_h = (time.time() - float(p.get("created_utc", 0))) / 3600
                print(f"     🎁 {p.get('title')}  (vor {age_h:.0f} h)")
        try:
            print(f"✅ Inbox lesbar ({len(reddit.inbox())} Einträge)")
        except RedditError as e:
            print(f"❌ Inbox: {e}")
    return cmd_test(cfg, args)


def cmd_status(cfg: Config, args) -> int:
    state = State.load(cfg.data_dir / "state.json")
    if not state.giveaways:
        print("Noch keine Giveaways gefunden.")
        return 0
    for gw in sorted(state.giveaways.values(), key=lambda g: g.created_utc, reverse=True):
        when = datetime.fromtimestamp(gw.created_utc).strftime("%d.%m. %H:%M")
        mark = "✅ teilgenommen" if gw.entered else (f"❌ {gw.failed}" if gw.failed else "⏳ offen")
        print(f"{when}  {mark:16}  {gw.title}\n               {gw.url}")
    return 0


def _notify_problem(state: State, notifier: Notifier, key: str, title: str, message: str) -> None:
    """Problem aufs Handy melden – aber höchstens alle 6 Stunden, auch über Neustarts hinweg."""
    if time.time() - state.problems.get(key, 0) >= PROBLEM_REPEAT_SECONDS:
        if notifier.send(title, message, priority=4):
            state.problems[key] = time.time()
            state.save()


def cmd_run(cfg: Config, args) -> int:
    state = State.load(cfg.data_dir / "state.json")
    notifier = Notifier(cfg.ntfy_server, cfg.ntfy_topic)
    stop_file = cfg.data_dir / "stop"
    stop_file.unlink(missing_ok=True)
    background = _background()
    if state.force_visible_browser:
        cfg.headless = False
    if not background:
        _print_pairing(cfg)

    failures = 0
    while True:
        try:
            with open_browser(cfg, minimized=True) as (_, page):
                reddit = RedditSession(page, cfg.reddit_url)
                try:
                    reddit.me()
                    bot = GiveawayBot(cfg, reddit, notifier, state, dry_run=args.dry_run, escalate_login=True,
                                      escalate_blocked=cfg.headless, stop_file=stop_file)
                    bot.run_forever()
                    return 0
                except NotLoggedIn:
                    log.warning("Nicht (mehr) bei Reddit eingeloggt – öffne Login-Fenster")
            if background:
                _notify_problem(state, notifier, "login", "🔑 Reddit-Login nötig",
                                "Am Laptop ist ein Fenster offen – bitte dort einmal bei Reddit einloggen.")
            interactive_login(cfg, timeout=12 * 3600 if background else 900)
        except AccessBlocked as e:
            if cfg.headless:
                log.warning("Reddit blockt den unsichtbaren Browser – wechsle zu normalem (minimiertem) Fenster.")
                cfg.headless = False
                state.force_visible_browser = True
                continue
            log.error("❌ %s", e)
            _notify_problem(state, notifier, "blocked", "⚠️ Reddit blockiert den Bot", str(e))
            return 3
        except RedditError as e:  # z. B. direkt nach dem Hochfahren noch kein WLAN
            failures += 1
            log.warning("Reddit nicht erreichbar (%s) – neuer Versuch in 1 Minute", e)
            if failures >= 3:
                _notify_problem(state, notifier, "unreachable", "⚠️ Reddit nicht erreichbar",
                                f"{e}\nGig versucht es automatisch weiter.")
            time.sleep(60)
        except BrowserClosed:
            log.error("Der Browser wurde geschlossen – Bot beendet.")
            return 1
        except KeyboardInterrupt:
            log.info("Bot beendet.")
            return 0
        finally:
            state.save()


COMMANDS = {
    "run": cmd_run,
    "setup": cmd_setup,
    "login": cmd_login,
    "pair": cmd_pair,
    "check": cmd_check,
    "test": cmd_test,
    "status": cmd_status,
}


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="gig_bot.py", description="Reddit-Giveaway-Bot mit Handy-Benachrichtigung")
    parser.add_argument("command", nargs="?", default="run", choices=list(COMMANDS),
                        help="run = Bot starten (Standard), setup = Login + Handy koppeln, login = bei Reddit "
                             "einloggen, pair = Handy per QR-Code koppeln, check = Zugriff testen, "
                             "test = Test-Benachrichtigung, status = gefundene Giveaways anzeigen")
    parser.add_argument("--dry-run", action="store_true", help="nichts kommentieren, nur melden")
    parser.add_argument("--config", type=Path, default=DEFAULT_PATH, help="Pfad zur config.toml")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args(argv)

    if sys.stdout is not None and hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # Emojis in der Windows-Konsole
    try:
        cfg = load_config(args.config)
    except ConfigError as e:
        print(f"❌ Konfiguration: {e}")
        return 2
    _setup_logging(cfg, args.verbose)

    try:
        return COMMANDS[args.command](cfg, args)
    except KeyboardInterrupt:
        return 0
    except (NotLoggedIn, BrowserClosed) as e:
        print(f"❌ {e}")
        return 1
