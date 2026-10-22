"""Kommandozeile: python gig_bot.py [run|login|check|test|status]"""

from __future__ import annotations

import argparse
import logging
import sys
import time
from datetime import datetime
from logging.handlers import RotatingFileHandler
from pathlib import Path

from .bot import GiveawayBot
from .config import DEFAULT_PATH, Config, ConfigError, load_config
from .detect import is_giveaway
from .notify import Notifier
from .reddit import (
    AccessBlocked,
    BrowserClosed,
    NotLoggedIn,
    RedditError,
    RedditSession,
    interactive_login,
    open_browser,
)
from .state import State

log = logging.getLogger("gig")


def _setup_logging(cfg: Config, verbose: bool) -> None:
    fmt = logging.Formatter("%(asctime)s  %(message)s", "%d.%m. %H:%M:%S")
    console = logging.StreamHandler(sys.stdout)
    console.setFormatter(fmt)
    file = RotatingFileHandler(cfg.data_dir / "bot.log", maxBytes=1_000_000, backupCount=3, encoding="utf-8")
    file.setFormatter(fmt)
    log.handlers[:] = [console, file]
    log.setLevel(logging.DEBUG if verbose else logging.INFO)


def _print_pairing(cfg: Config) -> None:
    print("\n📱 Handy-App einrichten – diese zwei Werte in der Gig-App eintragen:")
    print(f"   Server: {cfg.ntfy_server}")
    print(f"   Kanal:  {cfg.ntfy_topic}\n")


def cmd_login(cfg: Config, args) -> int:
    interactive_login(cfg)
    return 0


def cmd_test(cfg: Config, args) -> int:
    _print_pairing(cfg)
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
            return 1
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


def cmd_run(cfg: Config, args) -> int:
    state = State.load(cfg.data_dir / "state.json")
    notifier = Notifier(cfg.ntfy_server, cfg.ntfy_topic)
    _print_pairing(cfg)
    while True:
        try:
            with open_browser(cfg) as (_, page):
                reddit = RedditSession(page, cfg.reddit_url)
                try:
                    reddit.me()
                except NotLoggedIn:
                    print("Noch nicht bei Reddit eingeloggt – öffne Login-Fenster …")
                else:
                    GiveawayBot(cfg, reddit, notifier, state, dry_run=args.dry_run).run_forever()
                    return 0
            interactive_login(cfg)
        except AccessBlocked as e:
            log.error("❌ %s", e)
            return 1
        except BrowserClosed:
            log.error("Der Browser wurde geschlossen – Bot beendet.")
            return 1
        except KeyboardInterrupt:
            log.info("Bot beendet.")
            return 0
        finally:
            state.save()


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="gig_bot.py", description="Reddit-Giveaway-Bot mit Handy-Benachrichtigung")
    parser.add_argument("command", nargs="?", default="run", choices=["run", "login", "check", "test", "status"],
                        help="run = Bot starten (Standard), login = bei Reddit einloggen, check = Zugriff testen, "
                             "test = Test-Benachrichtigung, status = gefundene Giveaways anzeigen")
    parser.add_argument("--dry-run", action="store_true", help="nichts kommentieren, nur melden")
    parser.add_argument("--config", type=Path, default=DEFAULT_PATH, help="Pfad zur config.toml")
    parser.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args(argv)

    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # Emojis in der Windows-Konsole
    try:
        cfg = load_config(args.config)
    except ConfigError as e:
        print(f"❌ Konfiguration: {e}")
        return 2
    _setup_logging(cfg, args.verbose)

    commands = {"run": cmd_run, "login": cmd_login, "check": cmd_check, "test": cmd_test, "status": cmd_status}
    try:
        return commands[args.command](cfg, args)
    except KeyboardInterrupt:
        return 0
    except (NotLoggedIn, BrowserClosed) as e:
        print(f"❌ {e}")
        return 1
