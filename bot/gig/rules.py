"""Liest die Giveaway-Beschreibung: Was wird verlangt, wann endet es, was wird kommentiert."""

from __future__ import annotations

import random
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from .config import Config
from .detect import requested_comment

HOUR = 3600
DAY = 24 * HOUR
_WORD_NUMBERS = {"a": 1, "an": 1, "one": 1, "two": 2, "three": 3, "four": 4, "five": 5, "six": 6, "seven": 7}
_MONTHS = {m: i + 1 for i, m in enumerate(
    ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"])}
_WEEKDAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]

_SUB = re.compile(r"(?<![\w/])/?r/([A-Za-z0-9][A-Za-z0-9_]{1,20})\b")
_USER = re.compile(r"(?<![\w/])/?u/([A-Za-z0-9_-]{3,20})\b")
_JOIN_WORDS = re.compile(r"\b(join\w*|subscrib\w*|member\w*|sub to|follow\w*)\b", re.I)
_FOLLOW_WORDS = re.compile(r"\bfollow\w*\b", re.I)
_FOLLOW_HOST = re.compile(r"\bfollow\s+(?:me|us|my profile|our profile|the host|op)\b", re.I)
_UPVOTE = re.compile(r"\bup-?\s?vot\w*", re.I)
_SHARE = re.compile(r"\b(?:share|cross-?post|repost)\w*\b", re.I)
_TAG = re.compile(r"\b(?:tag|mention)\s+(?:(\d|a|an|one|two|three|four|five)\s+)?(?:of\s+)?(?:your\s+)?"
                  r"(?:friends?|buddies|buddy|mates?|people|users?|redditors?)\b", re.I)
_NUMBER = re.compile(r"\b(?:number|pick|guess|choose)\b[^\n\d]{0,40}?(\d{1,6})\s*(?:-|–|—|to|and|bis)\s*(\d{1,6})",
                     re.I)
_WATCH_QUESTION = re.compile(r"\b(?:favou?rite|dream|grail|which|what|desired|wish)\s+(?:\w+\s+){0,2}?"
                             r"(?:watch|watches|model|piece|reference|ref)\b", re.I)
_WHY_QUESTION = re.compile(r"\bwhy\b[^.?!\n]{0,40}\b(?:win|deserve|want|need)\b", re.I)
_LINK = re.compile(r"https?://[^\s)\]>]+", re.I)
_EXTERNAL_HOSTS = ("t.me", "telegram", "wa.me", "whatsapp", "discord", "instagram", "tiktok", "facebook",
                   "wechat", "x.com", "twitter")
_EXTERNAL_WORDS = re.compile(r"\b(telegram|whats\s?app|discord|instagram|tiktok|wechat)\b", re.I)
_ENDED_TEXT = re.compile(
    r"\b(?:giveaway (?:has |is )?(?:now )?(?:ended|closed|over|finished)|(?:entries|entry) (?:are |is )?(?:now )?closed"
    r"|winners? (?:has|have) been (?:chosen|picked|drawn|announced|selected|contacted)|the winners? (?:is|are):? u/"
    r"|congrat\w* (?:to )?(?:the winners?|u/))",
    re.I,
)
_ENDED_FLAIR = re.compile(r"\b(?:ended|closed|over|finished|done|winners?|complete[d]?)\b", re.I)
_END_KEYWORD = re.compile(
    r"\b(?:ends?|ending|closes?|closing|deadline|until|till|runs?|running|lasts?|open for|draw\w*|announc\w*|"
    r"pick\w*|chosen|selected)\b", re.I)
_RELATIVE = re.compile(r"\b(?:in|for|after|within|next)?\s*(\d{1,3}|one|two|three|four|five|six|seven)\s*"
                       r"(hours?|hrs?|h|days?|d|weeks?)\b", re.I)
_MONTH_DAY = re.compile(r"\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2})(?:st|nd|rd|th)?\b"
                        r"|\b(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)",
                        re.I)
_NUMERIC_DATE = re.compile(r"\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b")
_WEEKDAY = re.compile(r"\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b", re.I)
_TODAY = re.compile(r"\b(today|tonight|tomorrow)\b", re.I)


@dataclass
class Requirements:
    """Was ein Giveaway verlangt – und was davon der Bot selbst erledigen kann."""

    comment_text: str | None = None
    number_range: tuple[int, int] | None = None
    question: str | None = None  # "watch" oder "why"
    tag_friends: int = 0
    join_subreddits: list[str] = field(default_factory=list)
    follow_users: list[str] = field(default_factory=list)
    upvote: bool = False
    share: bool = False
    external: list[str] = field(default_factory=list)
    ends_at: float | None = None
    ended: bool = False

    def todo_for_user(self, friends_tagged: bool) -> list[str]:
        """Schritte, die der Bot nicht für dich erledigt."""
        todo = []
        if self.upvote:
            todo.append("Upvote")
        if self.tag_friends and not friends_tagged:
            todo.append(f"{self.tag_friends} Freund(e) markieren")
        if self.share:
            todo.append("Teilen")
        todo += self.external
        return todo


def _unique(items):
    seen, out = set(), []
    for item in items:
        if item.lower() not in seen:
            seen.add(item.lower())
            out.append(item)
    return out


def _number(word: str) -> int:
    return int(word) if word.isdigit() else _WORD_NUMBERS.get(word.lower(), 1)


def _mentions_with_context(pattern: re.Pattern, context: re.Pattern, text: str, window: int = 80) -> list[str]:
    """Namen, vor denen (in der Nähe) z. B. „join“ oder „follow“ steht."""
    found = []
    for m in pattern.finditer(text):
        before = text[max(0, m.start() - window):m.start()]
        if context.search(before):
            found.append(m.group(1))
    return _unique(found)


def _end_of_day(day: datetime) -> float:
    # Zeitzone des Hosts ist unbekannt → großzügig: Tagesende UTC plus 12 Stunden
    return day.replace(hour=23, minute=59, second=59, tzinfo=timezone.utc).timestamp() + 12 * HOUR


def _from_relative(m: re.Match, start: datetime, created: float) -> float | None:
    n = _number(m.group(1))
    unit = m.group(2).lower()
    seconds = HOUR if unit.startswith("h") else (7 * DAY if unit.startswith("w") else DAY)
    return created + n * seconds + HOUR


def _from_month_day(m: re.Match, start: datetime, created: float) -> float | None:
    month = _MONTHS[(m.group(1) or m.group(4)).lower()[:3]]
    day = int(m.group(2) or m.group(3))
    for year in (start.year, start.year + 1):
        try:
            when = datetime(year, month, day, tzinfo=timezone.utc)
        except ValueError:
            return None
        if when >= start - timedelta(days=1):
            return _end_of_day(when)
    return None


def _from_numeric_date(m: re.Match, start: datetime, created: float) -> float | None:
    a, b = int(m.group(1)), int(m.group(2))
    candidates = [(a, b), (b, a)] if a <= 12 and b <= 12 else ([(b, a)] if a > 12 else [(a, b)])
    options = []
    for month, day in candidates:  # Tag/Monat ist oft unklar → nächstes passendes Datum
        for year in (start.year, start.year + 1):
            try:
                when = datetime(year, month, day, tzinfo=timezone.utc)
            except ValueError:
                continue
            if when >= start - timedelta(days=1):
                options.append(when)
                break
    return _end_of_day(min(options)) if options else None


def _from_weekday(m: re.Match, start: datetime, created: float) -> float | None:
    target = _WEEKDAYS.index(m.group(1).lower())
    ahead = (target - start.weekday()) % 7 or 7
    return _end_of_day(start + timedelta(days=ahead))


def _from_today(m: re.Match, start: datetime, created: float) -> float | None:
    return _end_of_day(start + timedelta(days=1 if m.group(1).lower() == "tomorrow" else 0))


_END_PARSERS = [(_RELATIVE, _from_relative), (_MONTH_DAY, _from_month_day), (_NUMERIC_DATE, _from_numeric_date),
                (_WEEKDAY, _from_weekday), (_TODAY, _from_today)]


def _parse_end(window: str, created: float) -> float | None:
    """Nimmt die Zeitangabe, die im Fenster zuerst kommt."""
    start = datetime.fromtimestamp(created, timezone.utc)
    hits = [(m.start(), parse, m) for pattern, parse in _END_PARSERS if (m := pattern.search(window))]
    for _, parse, m in sorted(hits, key=lambda h: h[0]):
        result = parse(m, start, created)
        if result:
            return result
    return None


def end_time(text: str, created: float) -> float | None:
    """Erkennt das Ende aus Sätzen wie „ends in 48h“, „winner announced Oct 25“ oder „closes Sunday“."""
    for m in _END_KEYWORD.finditer(text):
        found = _parse_end(text[m.end():m.end() + 60], created)
        if found:
            return found
    m = re.search(r"\b(\d{1,3})\s*-?\s*(hours?|hrs?|h|days?|d)\s+giveaway\b", text, re.I)
    if m:
        return _parse_end(m.group(0), created)
    return None


def analyze(post: dict, now: float) -> Requirements:
    title = post.get("title") or ""
    body = post.get("selftext") or ""
    text = f"{title}\n{body}"
    created = float(post.get("created_utc") or now)
    req = Requirements()

    req.comment_text = requested_comment(body)
    m = _NUMBER.search(text)
    if m:
        lo, hi = int(m.group(1)), int(m.group(2))
        if lo < hi:
            req.number_range = (lo, hi)
    if _WATCH_QUESTION.search(body):
        req.question = "watch"
    elif _WHY_QUESTION.search(body):
        req.question = "why"
    m = _TAG.search(text)
    if m:
        req.tag_friends = _number(m.group(1) or "1")

    req.join_subreddits = _mentions_with_context(_SUB, _JOIN_WORDS, text)
    req.follow_users = _mentions_with_context(_USER, _FOLLOW_WORDS, text)
    host = post.get("author") or ""
    if host and host != "[deleted]" and _FOLLOW_HOST.search(text):
        req.follow_users = _unique(req.follow_users + [host])
    req.upvote = bool(_UPVOTE.search(text))
    req.share = bool(_SHARE.search(text))

    links = [link for link in _LINK.findall(body) if any(h in link.lower() for h in _EXTERNAL_HOSTS)]
    named = [w.title().replace(" ", "") for w in _EXTERNAL_WORDS.findall(text)]
    req.external = _unique(links) or [f"{name}-Gruppe beitreten" for name in _unique(named)]

    req.ends_at = end_time(text, created)
    req.ended = bool(
        _ENDED_TEXT.search(body)
        or _ENDED_FLAIR.search(post.get("link_flair_text") or "")
        or post.get("locked")
        or post.get("archived")
        or (req.ends_at is not None and now > req.ends_at)
    )
    return req


def host_announced_winner(post: dict, comments: list[dict]) -> bool:
    """Hat der Host im Thread schon Gewinner verkündet?"""
    host = (post.get("author") or "").lower()
    return any((c.get("author") or "").lower() == host and _ENDED_TEXT.search(c.get("body") or "")
               for c in comments)


def taken_numbers(comments: list[dict], number_range: tuple[int, int]) -> set[int]:
    lo, hi = number_range
    taken = set()
    for c in comments:
        m = re.search(r"\b(\d{1,6})\b", c.get("body") or "")
        if m and lo <= int(m.group(1)) <= hi:
            taken.add(int(m.group(1)))
    return taken


def compose_comment(req: Requirements, cfg: Config, rng: random.Random, taken: set[int] = frozenset()) -> str:
    """Baut den Kommentar so, wie die Beschreibung es verlangt."""
    parts = []
    if req.comment_text:
        parts.append(req.comment_text)
    if req.number_range:
        lo, hi = req.number_range
        if hi - lo <= 10000:
            free = [n for n in range(lo, hi + 1) if n not in taken] or list(range(lo, hi + 1))
            number = rng.choice(free)
        else:
            number = rng.randint(lo, hi)
        parts.append(str(number) if req.comment_text else f"{number} 🍀")
    if not parts:
        if req.question == "watch" and cfg.dream_watches:
            parts.append(f"My dream watch would be the {rng.choice(cfg.dream_watches)} ⌚🔥 Thanks for the giveaway!")
        elif req.question == "why" and cfg.why_answers:
            parts.append(rng.choice(cfg.why_answers))
        else:
            parts.append(rng.choice(cfg.comments))
    if req.tag_friends and cfg.friends:
        parts.append(" ".join(f"u/{f}" for f in cfg.friends[: req.tag_friends]))
    return " ".join(parts)
