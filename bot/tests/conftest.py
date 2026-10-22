import sys
import tomllib
from pathlib import Path

import pytest

BOT_DIR = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(BOT_DIR))

from gig.config import from_dict  # noqa: E402


@pytest.fixture
def cfg(tmp_path):
    raw = tomllib.loads((BOT_DIR / "config.example.toml").read_text(encoding="utf-8"))
    raw["notify"]["ntfy_topic"] = "gig-test"
    return from_dict(raw, tmp_path)


def make_post(pid="abc123", title="🎉🎁 Giveaway Time! Rolex GMT-Master II 126720 “Sprite” — VSF DD3285 V2",
              flair="🎁GIVEAWAY🎁", author="ContributionAble4509", created=1_000_000.0, selftext="",
              subreddit="RepWatchClud", **extra):
    post = {
        "id": pid,
        "name": f"t3_{pid}",
        "title": title,
        "link_flair_text": flair,
        "author": author,
        "subreddit": subreddit,
        "created_utc": created,
        "permalink": f"/r/{subreddit}/comments/{pid}/giveaway/",
        "selftext": selftext,
        "locked": False,
        "archived": False,
    }
    post.update(extra)
    return post


def make_comment(cid, author, body, parent_id, post_id="abc123", replies=""):
    return {
        "kind": "t1",
        "data": {
            "id": cid,
            "name": f"t1_{cid}",
            "author": author,
            "body": body,
            "parent_id": parent_id,
            "link_id": f"t3_{post_id}",
            "permalink": f"/r/RepWatchClud/comments/{post_id}/giveaway/{cid}/",
            "created_utc": 1_000_100.0,
            "replies": replies,
        },
    }
