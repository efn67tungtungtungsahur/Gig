"""Speichert, was der Bot schon gesehen, kommentiert und gemeldet hat (data/state.json)."""

from __future__ import annotations

import json
import logging
import os
import time
from dataclasses import asdict, dataclass, field, fields
from pathlib import Path

from .detect import REDDIT

log = logging.getLogger("gig")
DAY = 86400


@dataclass
class Giveaway:
    id: str
    title: str
    url: str
    author: str
    subreddit: str
    created_utc: float
    found_at: float
    selftext: str = ""
    entered: bool = False
    entered_at: float | None = None
    comment_ids: list[str] = field(default_factory=list)
    comment_text: str | None = None
    retry_at: float = 0.0
    failed: str | None = None
    ends_at: float | None = None
    next_check: float = 0.0

    @classmethod
    def from_post(cls, post: dict, now: float) -> "Giveaway":
        return cls(
            id=post["id"],
            title=post.get("title", ""),
            url=REDDIT + post.get("permalink", f"/comments/{post['id']}/"),
            author=post.get("author") or "",
            subreddit=post.get("subreddit", ""),
            created_utc=float(post.get("created_utc", now)),
            found_at=now,
            selftext=(post.get("selftext") or "")[:5000],
        )

    @classmethod
    def from_dict(cls, d: dict) -> "Giveaway":
        known = {f.name for f in fields(cls)}
        return cls(**{k: v for k, v in d.items() if k in known})


class State:
    def __init__(self, path: Path):
        self.path = path
        self.first_run = time.time()
        self.giveaways: dict[str, Giveaway] = {}
        self.seen_posts: dict[str, float] = {}
        self.notified: dict[str, float] = {}
        self.outbox: list[dict] = []
        self.comment_times: list[float] = []
        self.problems: dict[str, float] = {}
        self.welcomed = False
        self.last_heartbeat = 0.0
        self.force_visible_browser = False
        self.last_deep_scan = 0.0
        self.discovered_subreddits: dict[str, float] = {}
        self.unavailable_subreddits: dict[str, float] = {}
        self.joined: dict[str, float] = {}

    @classmethod
    def load(cls, path: Path) -> "State":
        state = cls(path)
        if not path.exists():
            return state
        try:
            raw = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, ValueError) as e:
            log.warning("state.json nicht lesbar (%s) – starte mit leerem Zustand", e)
            return state
        state.first_run = raw.get("first_run", state.first_run)
        state.giveaways = {k: Giveaway.from_dict(v) for k, v in raw.get("giveaways", {}).items()}
        state.seen_posts = raw.get("seen_posts", {})
        state.notified = raw.get("notified", {})
        state.outbox = raw.get("outbox", [])
        state.comment_times = raw.get("comment_times", [])
        state.problems = raw.get("problems", {})
        state.welcomed = raw.get("welcomed", False)
        state.last_heartbeat = raw.get("last_heartbeat", 0.0)
        state.force_visible_browser = raw.get("force_visible_browser", False)
        state.last_deep_scan = raw.get("last_deep_scan", 0.0)
        state.discovered_subreddits = raw.get("discovered_subreddits", {})
        state.unavailable_subreddits = raw.get("unavailable_subreddits", {})
        state.joined = raw.get("joined", {})
        return state

    def save(self) -> None:
        raw = {
            "first_run": self.first_run,
            "giveaways": {k: asdict(v) for k, v in self.giveaways.items()},
            "seen_posts": self.seen_posts,
            "notified": self.notified,
            "outbox": self.outbox,
            "comment_times": self.comment_times,
            "problems": self.problems,
            "welcomed": self.welcomed,
            "last_heartbeat": self.last_heartbeat,
            "force_visible_browser": self.force_visible_browser,
            "last_deep_scan": self.last_deep_scan,
            "discovered_subreddits": self.discovered_subreddits,
            "unavailable_subreddits": self.unavailable_subreddits,
            "joined": self.joined,
        }
        tmp = self.path.with_suffix(".tmp")
        tmp.write_text(json.dumps(raw, ensure_ascii=False, indent=1), encoding="utf-8")
        os.replace(tmp, self.path)

    def prune(self, now: float, watch_days: int) -> None:
        self.seen_posts = {k: t for k, t in self.seen_posts.items() if now - t < 60 * DAY}
        self.notified = {k: t for k, t in self.notified.items() if now - t < 90 * DAY}
        self.comment_times = [t for t in self.comment_times if now - t < DAY]
        self.problems = {k: t for k, t in self.problems.items() if now - t < DAY}
        self.discovered_subreddits = {k: t for k, t in self.discovered_subreddits.items() if now - t < 60 * DAY}
        self.unavailable_subreddits = {k: t for k, t in self.unavailable_subreddits.items() if now - t < DAY}
        keep = (watch_days + 7) * DAY
        self.giveaways = {k: g for k, g in self.giveaways.items() if now - g.created_utc < keep}
