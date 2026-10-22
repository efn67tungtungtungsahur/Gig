"""Lädt config.toml und legt sie beim ersten Start aus der Vorlage an."""

from __future__ import annotations

import re
import secrets
import shutil
import string
import tomllib
from dataclasses import dataclass
from pathlib import Path

BOT_DIR = Path(__file__).resolve().parent.parent
EXAMPLE_PATH = BOT_DIR / "config.example.toml"
DEFAULT_PATH = BOT_DIR / "config.toml"


class ConfigError(Exception):
    pass


@dataclass
class Config:
    subreddits: list[str]
    search_queries: list[str]
    giveaway_keywords: list[str]
    exclude_keywords: list[str]
    max_post_age_hours: float
    auto_comment: bool
    comments: list[str]
    use_requested_comment: bool
    max_comments_per_day: int
    min_seconds_between_comments: int
    win_keywords: list[str]
    watch_days: int
    ntfy_server: str
    ntfy_topic: str
    notify_entries: bool
    poll_seconds: int
    win_check_seconds: int
    headless: bool
    browser_channel: str
    browser_executable: str
    reddit_url: str
    data_dir: Path


def new_topic() -> str:
    alphabet = string.ascii_lowercase + string.digits
    return "gig-" + "".join(secrets.choice(alphabet) for _ in range(10))


def _lower(words) -> list[str]:
    return [str(w).lower() for w in words if str(w).strip()]


def from_dict(raw: dict, data_dir: Path) -> Config:
    search = raw.get("search", {})
    enter = raw.get("enter", {})
    wins = raw.get("wins", {})
    notify = raw.get("notify", {})
    bot = raw.get("bot", {})

    cfg = Config(
        subreddits=[s.strip().removeprefix("r/") for s in search.get("subreddits", []) if s.strip()],
        search_queries=[q for q in search.get("search_queries", []) if q.strip()],
        giveaway_keywords=_lower(search.get("giveaway_keywords", ["giveaway"])),
        exclude_keywords=_lower(search.get("exclude_keywords", [])),
        max_post_age_hours=float(search.get("max_post_age_hours", 168)),
        auto_comment=bool(enter.get("auto_comment", True)),
        comments=[c for c in enter.get("comments", []) if c.strip()],
        use_requested_comment=bool(enter.get("use_requested_comment", True)),
        max_comments_per_day=int(enter.get("max_comments_per_day", 20)),
        min_seconds_between_comments=int(enter.get("min_seconds_between_comments", 90)),
        win_keywords=_lower(wins.get("win_keywords", ["congrat", "you won", "winner"])),
        watch_days=int(wins.get("watch_days", 21)),
        ntfy_server=str(notify.get("ntfy_server", "https://ntfy.sh")).rstrip("/"),
        ntfy_topic=str(notify.get("ntfy_topic", "")).strip(),
        notify_entries=bool(notify.get("notify_entries", True)),
        poll_seconds=max(60, int(bot.get("poll_seconds", 180))),
        win_check_seconds=max(120, int(bot.get("win_check_seconds", 600))),
        headless=bool(bot.get("headless", True)),
        browser_channel=str(bot.get("browser_channel", "")).strip(),
        browser_executable=str(bot.get("browser_executable", "")).strip(),
        reddit_url=str(bot.get("reddit_url", "https://old.reddit.com")).rstrip("/"),
        data_dir=data_dir,
    )
    if not cfg.subreddits and not cfg.search_queries:
        raise ConfigError("In [search] muss mindestens ein Subreddit oder eine Suche stehen.")
    if cfg.auto_comment and not cfg.comments:
        raise ConfigError("In [enter] fehlen Kommentare (comments = [...]).")
    if not cfg.ntfy_topic:
        raise ConfigError("In [notify] fehlt ntfy_topic.")
    return cfg


def load_config(path: Path = DEFAULT_PATH) -> Config:
    if not path.exists():
        shutil.copy(EXAMPLE_PATH, path)
    text = path.read_text(encoding="utf-8")
    try:
        raw = tomllib.loads(text)
    except tomllib.TOMLDecodeError as e:
        raise ConfigError(f"{path.name} ist fehlerhaft: {e}") from e

    # Beim ersten Start einen geheimen ntfy-Kanal erzeugen und speichern.
    if not str(raw.get("notify", {}).get("ntfy_topic", "")).strip():
        topic = new_topic()
        text, n = re.subn(r'(?m)^ntfy_topic\s*=\s*""', f'ntfy_topic = "{topic}"', text, count=1)
        if not n:
            raise ConfigError('Trage in config.toml unter [notify] eine Zeile ntfy_topic = "..." ein.')
        path.write_text(text, encoding="utf-8")
        raw = tomllib.loads(text)

    data_dir = path.resolve().parent / "data"
    data_dir.mkdir(exist_ok=True)
    return from_dict(raw, data_dir)
