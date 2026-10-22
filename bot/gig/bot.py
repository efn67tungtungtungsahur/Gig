"""Hauptlogik: Giveaways finden, teilnehmen und Gewinne melden."""

from __future__ import annotations

import logging
import random
import time
from pathlib import Path

from .config import Config
from .detect import (
    Signal,
    inbox_signal,
    is_announcement,
    is_giveaway,
    mentions_user,
    requested_comment,
    thread_signals,
)
from .pairing import STATUS_TAG
from .reddit import (
    AccessBlocked,
    BrowserClosed,
    CommentRejected,
    NotLoggedIn,
    RateLimited,
    RedditError,
)
from .state import DAY, Giveaway, State

log = logging.getLogger("gig")

TICK_SECONDS = 15
PROBLEM_REPEAT_SECONDS = 6 * 3600
HEARTBEAT_SECONDS = 30 * 60


class GiveawayBot:
    def __init__(self, cfg: Config, reddit, notifier, state: State, *, dry_run: bool = False,
                 clock=time.time, rng: random.Random | None = None, escalate_login: bool = False,
                 escalate_blocked: bool = False, stop_file: Path | None = None):
        self.cfg = cfg
        self.reddit = reddit
        self.notifier = notifier
        self.state = state
        self.dry_run = dry_run
        self.clock = clock
        self.rng = rng or random.Random()
        self._next_scan = 0.0
        self._next_win_check = 0.0
        self._has_problem = False
        # Bestimmte Probleme an den Aufrufer weitergeben, der sie besser lösen kann
        # (Login-Fenster öffnen bzw. auf sichtbaren Browser wechseln).
        self.escalate_login = escalate_login
        self.escalate_blocked = escalate_blocked
        self.stop_file = stop_file

    @property
    def username(self) -> str:
        return self.reddit.username or ""

    @property
    def auto_enter(self) -> bool:
        return self.cfg.auto_comment and not self.dry_run

    def run_forever(self, sleep=time.sleep) -> None:
        mode = "nimmt automatisch teil" if self.auto_enter else "meldet nur (du kommentierst selbst)"
        log.info("Bot läuft als u/%s und %s. Beenden mit Strg+C.", self.username, mode)
        if not self.state.welcomed:
            what = "nimmt automatisch an Giveaways teil" if self.auto_enter else "meldet dir neue Giveaways"
            if self.notifier.send("🤖 Gig läuft", f"Der Bot auf deinem Laptop {what} (u/{self.username}).",
                                  priority=3):
                self.state.welcomed = True
        while not (self.stop_file and self.stop_file.exists()):
            self.tick()
            sleep(TICK_SECONDS)
        log.info("Stopp-Signal erhalten – Bot wird beendet.")

    def tick(self) -> None:
        now = self.clock()
        try:
            reached_reddit = False
            if now >= self._next_scan:
                self._next_scan = now + self.cfg.poll_seconds
                self.scan()
                reached_reddit = True
            self.enter_due()
            if now >= self._next_win_check:
                self._next_win_check = now + self.cfg.win_check_seconds
                self.check_wins()
                reached_reddit = True
            if reached_reddit:
                self._problem_solved()
        except BrowserClosed:
            raise
        except NotLoggedIn:
            if self.escalate_login:
                raise
            self._problem("login", "⚠️ Bot ist bei Reddit ausgeloggt",
                          "Starte am Laptop: python gig_bot.py login – danach den Bot neu starten.")
        except AccessBlocked as e:
            if self.escalate_blocked:
                raise
            self._problem("blocked", "⚠️ Reddit blockiert den Bot", str(e))
        except RedditError as e:
            log.warning("Reddit-Fehler: %s", e)
        except Exception:
            log.exception("Unerwarteter Fehler – Bot läuft weiter")
        finally:
            self.flush_outbox()
            self._heartbeat(now)
            self.state.prune(now, self.cfg.watch_days)
            self.state.save()

    def _heartbeat(self, now: float) -> None:
        """Lebenszeichen für die App („Laptop-Bot aktiv“), erscheint nicht als Benachrichtigung."""
        if now - self.state.last_heartbeat < HEARTBEAT_SECONDS:
            return
        entered = sum(1 for g in self.state.giveaways.values() if g.entered)
        status = "hat ein Problem" if self._has_problem else "läuft"
        if self.notifier.send("Gig-Status", f"u/{self.username} · {status} · {entered} Teilnahmen",
                              priority=1, tags=(STATUS_TAG,)):
            self.state.last_heartbeat = now

    # --- Giveaways finden -----------------------------------------------------

    def scan(self) -> None:
        posts: list[dict] = []
        for sub in self.cfg.subreddits:
            try:
                posts += self.reddit.new_posts(sub)
            except (NotLoggedIn, AccessBlocked):
                raise
            except RedditError as e:
                log.warning("r/%s: %s", sub, e)
        for query in self.cfg.search_queries:
            posts += self.reddit.search(query)

        now = self.clock()
        new: list[Giveaway] = []
        for post in posts:
            pid = post.get("id")
            if not pid or pid in self.state.seen_posts:
                continue
            self.state.seen_posts[pid] = now
            self._check_post_for_win(post)
            if not self._enterable(post, now):
                continue
            gw = Giveaway.from_post(post, now)
            self.state.giveaways[pid] = gw
            new.append(gw)
            log.info("🎁 Neues Giveaway: %s (r/%s, u/%s)", gw.title, gw.subreddit, gw.author)

        if not new:
            return
        self.sync_my_comments()
        for gw in new:
            if gw.entered:
                log.info("   Schon teilgenommen: %s", gw.title)
            elif not self.auto_enter:
                self._signal(Signal(
                    key=f"new:{gw.id}",
                    title="🎁 Neues Giveaway",
                    message=f"{gw.title}\nr/{gw.subreddit} – tippe zum Öffnen und Kommentieren.",
                    url=gw.url,
                    priority=4,
                ))

    def _enterable(self, post: dict, now: float) -> bool:
        if now - float(post.get("created_utc", now)) > self.cfg.max_post_age_hours * 3600:
            return False
        if post.get("locked") or post.get("archived") or post.get("removed_by_category"):
            return False
        if (post.get("author") or "").lower() == self.username.lower():
            return False
        return is_giveaway(post, self.cfg)

    def _check_post_for_win(self, post: dict) -> None:
        author = post.get("author") or ""
        if author.lower() == self.username.lower():
            return
        url = "https://www.reddit.com" + post.get("permalink", "")
        title = post.get("title", "")
        if mentions_user(f"{title}\n{post.get('selftext', '')}", self.username):
            self._signal(Signal(
                key=f"post:{post['id']}",
                title="🏆 Du wirst in einem Post erwähnt!",
                message=f"{title}\nvon u/{author} – evtl. ein Gewinner-Post. Schnell nachschauen!",
                url=url,
            ))
            return
        hosts = {g.author.lower() for g in self.state.giveaways.values() if g.entered}
        if is_announcement(post, self.cfg) and author.lower() in hosts:
            self._signal(Signal(
                key=f"announce:{post['id']}",
                title="📣 Gewinner wurden verkündet",
                message=f"{title}\nu/{author} hat Gewinner gepostet – schau nach, ob du dabei bist!",
                url=url,
                priority=4,
            ))

    def sync_my_comments(self) -> None:
        """Erkennt Giveaways, an denen du schon (auch von Hand) teilgenommen hast."""
        if not self.username:
            return
        now = self.clock()
        for c in self.reddit.user_comments(self.username):
            gw = self.state.giveaways.get((c.get("link_id") or "").removeprefix("t3_"))
            name = c.get("name")
            if gw is None or not name or name in gw.comment_ids:
                continue
            gw.comment_ids.append(name)
            if not gw.entered:
                gw.entered = True
                gw.entered_at = float(c.get("created_utc", now))
                log.info("✔ Teilnahme erkannt: %s", gw.title)

    # --- Teilnehmen -----------------------------------------------------------

    def _can_comment(self, now: float) -> bool:
        recent = [t for t in self.state.comment_times if now - t < DAY]
        if len(recent) >= self.cfg.max_comments_per_day:
            return False
        if recent and now - max(recent) < self.cfg.min_seconds_between_comments:
            return False
        return True

    def enter_due(self) -> None:
        if not self.auto_enter:
            return
        now = self.clock()
        max_age = self.cfg.max_post_age_hours * 3600
        due = sorted(
            (g for g in self.state.giveaways.values()
             if not g.entered and not g.failed and g.retry_at <= now and now - g.created_utc <= max_age),
            key=lambda g: g.created_utc,
        )
        if due and self._can_comment(now):
            self._enter(due[0], now)

    def _enter(self, gw: Giveaway, now: float) -> None:
        text = requested_comment(gw.selftext) if self.cfg.use_requested_comment else None
        text = text or self.rng.choice(self.cfg.comments)
        try:
            name = self.reddit.post_comment("t3_" + gw.id, text)
        except RateLimited as e:
            gw.retry_at = now + e.seconds + 30
            log.warning("Reddit bremst Kommentare (%s) – neuer Versuch in %d min", e, (e.seconds + 30) // 60)
            return
        except CommentRejected as e:
            gw.failed = str(e)
            log.warning("Teilnahme fehlgeschlagen bei %s: %s", gw.title, e)
            self._signal(Signal(
                key=f"failed:{gw.id}",
                title="❌ Teilnahme fehlgeschlagen",
                message=f"{gw.title}\nReddit: {e}\nTippe, um es von Hand zu versuchen.",
                url=gw.url,
                priority=3,
            ))
            return

        self.state.comment_times.append(now)
        gw.entered = True
        gw.entered_at = now
        gw.comment_text = text
        if name:
            gw.comment_ids.append(name)
        log.info("✅ Teilgenommen: %s – „%s“", gw.title, text)
        if self.cfg.notify_entries:
            self._signal(Signal(
                key=f"entered:{gw.id}",
                title="✅ Bei Giveaway teilgenommen",
                message=(f"{gw.title}\nKommentar: „{text}“\n"
                         "Tippe zum Öffnen – manche Giveaways wollen noch Extra-Schritte (z. B. Telegram)."),
                url=gw.url,
                priority=3,
            ))

    # --- Gewinne erkennen -----------------------------------------------------

    def check_wins(self) -> None:
        self.sync_my_comments()
        self._check_inbox()
        now = self.clock()
        for gw in list(self.state.giveaways.values()):
            if not gw.entered or now - gw.created_utc > self.cfg.watch_days * DAY:
                continue
            try:
                post, comments = self.reddit.thread(gw.id)
            except (NotLoggedIn, AccessBlocked):
                raise
            except (RedditError, LookupError, TypeError) as e:
                log.warning("Thread %s nicht lesbar: %s", gw.id, e)
                continue
            for sig in thread_signals(post, comments, self.username, set(gw.comment_ids), self.cfg):
                self._signal(sig)

    def _check_inbox(self) -> None:
        oldest = self.state.first_run - 2 * DAY
        for item in self.reddit.inbox():
            if float(item.get("data", {}).get("created_utc", 0)) < oldest:
                continue
            sig = inbox_signal(item, self.username, self.state.giveaways, self.cfg)
            if sig:
                self._signal(sig)

    # --- Benachrichtigungen ---------------------------------------------------

    def _signal(self, sig: Signal) -> None:
        """Meldet etwas genau einmal; bei Netzproblemen wird später erneut gesendet."""
        if sig.key in self.state.notified:
            return
        self.state.notified[sig.key] = self.clock()
        self.state.outbox.append(sig.to_dict())
        self.flush_outbox()

    def flush_outbox(self) -> None:
        pending = []
        for item in self.state.outbox:
            if not self.notifier.send(item["title"], item["message"], priority=item["priority"],
                                      click=item["url"]):
                pending.append(item)
        self.state.outbox = pending

    def _problem(self, key: str, title: str, message: str) -> None:
        """Meldet ein Problem – höchstens alle 6 Stunden, solange es besteht."""
        log.error("%s: %s", title, message)
        self._has_problem = True
        now = self.clock()
        if now - self.state.problems.get(key, 0) >= PROBLEM_REPEAT_SECONDS:
            self.state.problems[key] = now
            self.notifier.send(title, message, priority=4)

    def _problem_solved(self) -> None:
        if self._has_problem:
            log.info("Reddit antwortet wieder – Bot läuft normal weiter.")
            self._has_problem = False
