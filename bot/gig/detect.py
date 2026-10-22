"""Erkennungslogik ohne Netzwerkzugriff: Giveaways, Kommentar-Vorgaben, Gewinn-Hinweise."""

from __future__ import annotations

import re
from dataclasses import asdict, dataclass

from .config import Config

REDDIT = "https://www.reddit.com"

# 'comment "Sprite" to enter' / "Comment the word “Sprite”" / "comment: 'I'm in'"
_REQUESTED_COMMENT = re.compile(
    r"\bcomment(?:ing)?\b[^\n\"“”„'‘’]{0,25}?"
    r"(?:[\"“„]([^\"“”„\n]{1,80})[\"”“]|[\s:]['‘]([^'‘’\n]{1,80})['’])",
    re.IGNORECASE,
)
_POST_ID_IN_URL = re.compile(r"/comments/([a-z0-9]+)")


@dataclass
class Signal:
    """Etwas, das aufs Handy gemeldet werden soll (dedupliziert über key)."""

    key: str
    title: str
    message: str
    url: str
    priority: int = 5

    def to_dict(self) -> dict:
        return asdict(self)


def contains_any(text: str | None, words: list[str]) -> bool:
    t = (text or "").lower()
    return any(w in t for w in words)


def _giveaway_words(post: dict, cfg: Config) -> bool:
    return contains_any(post.get("title"), cfg.giveaway_keywords) or contains_any(
        post.get("link_flair_text"), cfg.giveaway_keywords
    )


def is_giveaway(post: dict, cfg: Config) -> bool:
    """Ein Giveaway, an dem man noch teilnehmen kann (keine Gewinner-Bekanntgabe)."""
    if contains_any(post.get("title"), cfg.exclude_keywords):
        return False
    return _giveaway_words(post, cfg)


def is_announcement(post: dict, cfg: Config) -> bool:
    """Gewinner-Bekanntgabe oder beendetes Giveaway."""
    return contains_any(post.get("title"), cfg.exclude_keywords) and _giveaway_words(post, cfg)


def requested_comment(selftext: str | None) -> str | None:
    """Liefert den Text, den der Post als Kommentar verlangt (falls angegeben)."""
    m = _REQUESTED_COMMENT.search(selftext or "")
    if not m:
        return None
    text = (m.group(1) or m.group(2) or "").strip()
    return text or None


def mentions_user(text: str | None, username: str) -> bool:
    if not text or not username:
        return False
    pattern = rf"(?<![A-Za-z0-9_-]){re.escape(username)}(?![A-Za-z0-9_-])"
    return re.search(pattern, text, re.IGNORECASE) is not None


def post_id_from_url(url: str | None) -> str | None:
    m = _POST_ID_IN_URL.search(url or "")
    return m.group(1) if m else None


def flatten_comments(children: list) -> list[dict]:
    """Kommentarbaum (Reddit-JSON) in eine flache Liste umwandeln."""
    out: list[dict] = []
    stack = list(reversed(children or []))
    while stack:
        child = stack.pop()
        if child.get("kind") != "t1":
            continue
        data = child.get("data", {})
        out.append(data)
        replies = data.get("replies")
        if isinstance(replies, dict):
            stack.extend(reversed(replies.get("data", {}).get("children", [])))
    return out


def _snippet(text: str, limit: int = 220) -> str:
    text = " ".join((text or "").split())
    return text if len(text) <= limit else text[: limit - 1] + "…"


def thread_signals(
    post: dict, comments: list[dict], username: str, my_comment_names: set[str], cfg: Config
) -> list[Signal]:
    """Gewinn-Hinweise in einem Giveaway-Thread, an dem man teilgenommen hat."""
    signals: list[Signal] = []
    me = username.lower()
    title = post.get("title", "Giveaway")
    post_url = REDDIT + post.get("permalink", "")

    if (post.get("author") or "").lower() != me and mentions_user(post.get("selftext"), username):
        signals.append(
            Signal(
                key=f"selftext:{post.get('id')}",
                title="🏆 Du stehst im Giveaway-Post!",
                message=f"{title}\nDer Post erwähnt dich – wahrscheinlich als Gewinner. Schnell nachschauen!",
                url=post_url,
            )
        )

    for c in comments:
        author = c.get("author") or ""
        if author.lower() == me:
            continue
        body = c.get("body") or ""
        url = REDDIT + c.get("permalink", "") if c.get("permalink") else post_url
        if mentions_user(body, username):
            signals.append(
                Signal(
                    key=f"comment:{c.get('name')}",
                    title="🏆 Du wurdest im Giveaway erwähnt!",
                    message=f"{title}\nu/{author}: „{_snippet(body)}“",
                    url=url,
                )
            )
        elif c.get("parent_id") in my_comment_names and contains_any(body, cfg.win_keywords):
            signals.append(
                Signal(
                    key=f"comment:{c.get('name')}",
                    title="🏆 Möglicher Gewinn!",
                    message=f"{title}\nu/{author} hat auf deinen Kommentar geantwortet: „{_snippet(body)}“",
                    url=url,
                )
            )
    return signals


def inbox_signal(item: dict, username: str, giveaways: dict, cfg: Config) -> Signal | None:
    """Bewertet eine Inbox-Nachricht (Antwort, Erwähnung oder private Nachricht)."""
    kind = item.get("kind")
    d = item.get("data", {})
    name = d.get("name")
    if not name:
        return None
    author = d.get("author") or "Reddit"
    subject = d.get("subject") or ""
    body = d.get("body") or ""
    text = f"{subject}\n{body}"
    has_win = contains_any(text, cfg.win_keywords)

    if kind == "t1":
        context = d.get("context") or ""
        url = REDDIT + context if context else REDDIT + "/message/inbox/"
        gw = giveaways.get(post_id_from_url(context))
        link_title = d.get("link_title") or (gw.title if gw else "")
        mention = d.get("type") == "username_mention" or subject.lower() == "username mention"
        if gw is not None:
            if has_win or mention:
                return Signal(
                    key=name,
                    title="🏆 Möglicher Gewinn!" if has_win else "🏆 Du wurdest im Giveaway erwähnt!",
                    message=f"{link_title}\nu/{author}: „{_snippet(body)}“",
                    url=url,
                )
            return Signal(
                key=name,
                title="💬 Antwort in einem Giveaway",
                message=f"{link_title}\nu/{author}: „{_snippet(body)}“",
                url=url,
                priority=3,
            )
        if mention and (has_win or contains_any(link_title, cfg.giveaway_keywords)):
            return Signal(
                key=name,
                title="🏆 Du wurdest in einem Giveaway-Post erwähnt!",
                message=f"{link_title}\nu/{author}: „{_snippet(body)}“",
                url=url,
            )
        return None

    if kind == "t4":
        url = f"{REDDIT}/message/messages/{d.get('id', '')}"
        host_authors = {gw.author.lower() for gw in giveaways.values() if gw.entered}
        from_host = author.lower() in host_authors
        about_giveaway = from_host or contains_any(text, cfg.giveaway_keywords)
        if has_win and about_giveaway:
            return Signal(
                key=name,
                title="🏆 Gewinn-Nachricht!",
                message=f"Von u/{author}: {subject}\n„{_snippet(body)}“",
                url=url,
            )
        if about_giveaway:
            return Signal(
                key=name,
                title="✉️ Nachricht zu einem Giveaway",
                message=f"Von u/{author}: {subject}\n„{_snippet(body)}“",
                url=url,
                priority=4,
            )
    return None
