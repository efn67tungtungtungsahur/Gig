"""Prüft von GitHub aus, ob Reddit erreichbar ist und wie echte Giveaway-Posts aussehen."""
import json
import sys
import time
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "bot"))

from playwright.sync_api import sync_playwright  # noqa: E402

from gig.config import from_dict  # noqa: E402
from gig.detect import is_announcement, is_giveaway, requested_comment  # noqa: E402
from gig.reddit import RedditError, RedditSession  # noqa: E402

raw = tomllib.loads((ROOT / "bot" / "config.example.toml").read_text(encoding="utf-8"))
raw["notify"]["ntfy_topic"] = raw["notify"].get("ntfy_topic") or "probe"
cfg = from_dict(raw, Path("/tmp"))

with sync_playwright() as p:
    for base in ("https://old.reddit.com", "https://www.reddit.com"):
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        reddit = RedditSession(page, base)
        print(f"\n===== {base} =====")
        try:
            posts = reddit.new_posts("RepWatchClud", limit=100)
        except RedditError as e:
            print("FEHLER:", type(e).__name__, e)
            print("Seite:", page.url, page.title())
            browser.close()
            continue
        print(f"{len(posts)} Posts gelesen (Origin: {reddit.base})")
        giveaways = []
        for post in posts:
            age_h = (time.time() - post["created_utc"]) / 3600
            tag = "GIVEAWAY" if is_giveaway(post, cfg) else ("ANNOUNCE" if is_announcement(post, cfg) else "-")
            print(f"[{tag:8}] {age_h:6.1f}h  flair={post.get('link_flair_text')!r:28} u/{post.get('author')}: {post.get('title')}")
            if tag == "GIVEAWAY":
                giveaways.append(post)
        for post in giveaways[:3]:
            print(f"\n--- Giveaway {post['id']} ---")
            print("selftext:", post.get("selftext", "")[:1500])
            print("requested_comment ->", requested_comment(post.get("selftext")))
            print("locked/archived:", post.get("locked"), post.get("archived"), "num_comments:", post.get("num_comments"))
            try:
                thread, comments = reddit.thread(post["id"], limit=50)
                print(f"{len(comments)} Kommentare geladen; OP-Kommentare:")
                for c in comments:
                    if c.get("author") == post.get("author"):
                        print("   OP:", json.dumps(c.get("body", "")[:200], ensure_ascii=False))
                print("Beispiel-Kommentare:", [c.get("body", "")[:60] for c in comments[:8]])
            except RedditError as e:
                print("Thread-Fehler:", e)
        try:
            print("\n/api/me.json (ausgeloggt):", reddit._call("GET", "/api/me.json"))
        except RedditError as e:
            print("/api/me.json Fehler:", e)
        browser.close()
