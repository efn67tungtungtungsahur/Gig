from conftest import make_comment, make_post

from gig.detect import (
    flatten_comments,
    inbox_signal,
    is_announcement,
    is_giveaway,
    mentions_user,
    post_id_from_url,
    requested_comment,
    thread_signals,
)
from gig.state import Giveaway


def test_example_post_from_screenshot_is_giveaway(cfg):
    assert is_giveaway(make_post(), cfg)


def test_flair_alone_is_enough(cfg):
    assert is_giveaway(make_post(title="Rolex Sprite for one lucky member", flair="🎁GIVEAWAY🎁"), cfg)


def test_normal_posts_are_ignored(cfg):
    assert not is_giveaway(make_post(title="QC help: VSF Sprite", flair="QC"), cfg)
    assert not is_giveaway(make_post(title="Just arrived", flair=None), cfg)


def test_winner_posts_are_announcements_not_giveaways(cfg):
    post = make_post(title="Giveaway winner is ...!")
    assert not is_giveaway(post, cfg)
    assert is_announcement(post, cfg)
    assert not is_announcement(make_post(), cfg)


def test_requested_comment():
    assert requested_comment('To enter: upvote and comment "Sprite" below!') == "Sprite"
    assert requested_comment("Comment the word “Chen Watch” to enter") == "Chen Watch"
    assert requested_comment("Just comment: 'I want it'") == "I want it"
    assert requested_comment("Upvote, comment and follow. Winner in 48h") is None
    assert requested_comment("The comment's section is open") is None
    assert requested_comment("") is None


def test_mentions_user():
    assert mentions_user("Winner: u/Ferdi_123 congrats!", "ferdi_123")
    assert mentions_user("ferdi_123 won", "Ferdi_123")
    assert not mentions_user("u/Ferdi_1234 won", "Ferdi_123")
    assert not mentions_user("xFerdi_123", "Ferdi_123")


def test_post_id_from_url():
    assert post_id_from_url("/r/RepWatchClud/comments/1abc2d/giveaway/xyz/?context=3") == "1abc2d"
    assert post_id_from_url("") is None


def test_flatten_comments_includes_nested_replies():
    reply = make_comment("c2", "host", "Congrats, you won!", "t1_c1")
    top = make_comment("c1", "ferdi_123", "I'm in", "t3_abc123",
                       replies={"kind": "Listing", "data": {"children": [reply, {"kind": "more", "data": {}}]}})
    assert [c["id"] for c in flatten_comments([top])] == ["c1", "c2"]


def test_thread_signals(cfg):
    post = make_post(selftext="Winners: u/someone_else")
    comments = flatten_comments([
        make_comment("c1", "ferdi_123", "I'm in!", "t3_abc123"),
        make_comment("c2", "ContributionAble4509", "Congratulations, you won! DM me", "t1_c1"),
        make_comment("c3", "random", "Good luck all", "t3_abc123"),
    ])
    sigs = thread_signals(post, comments, "ferdi_123", {"t1_c1"}, cfg)
    assert [s.key for s in sigs] == ["comment:t1_c2"]
    assert sigs[0].priority == 5

    post = make_post(selftext="EDIT: The winner is u/FERDI_123 🎉")
    assert [s.key for s in thread_signals(post, [], "ferdi_123", set(), cfg)] == ["selftext:abc123"]


def test_inbox_signals(cfg):
    gw = Giveaway.from_post(make_post(), 0)
    gw.entered = True
    giveaways = {gw.id: gw}

    def item(kind, **data):
        base = {"name": f"{kind}_x1", "id": "x1", "author": "ContributionAble4509", "subject": "", "body": "",
                "created_utc": 1.0}
        base.update(data)
        return {"kind": kind, "data": base}

    ctx = "/r/RepWatchClud/comments/abc123/giveaway/c2/?context=3"
    win = inbox_signal(item("t1", body="Congrats, you won!", context=ctx, type="comment_reply"), "ferdi_123", giveaways, cfg)
    assert win.priority == 5
    info = inbox_signal(item("t1", body="Good luck!", context=ctx, type="comment_reply"), "ferdi_123", giveaways, cfg)
    assert info.priority == 3
    # "Congrats" unter einem normalen Post ist kein Gewinn
    other = "/r/RepTime/comments/zzz999/my_new_watch/c9/?context=3"
    assert inbox_signal(item("t1", body="Congrats on the watch!", context=other), "ferdi_123", giveaways, cfg) is None
    # Erwähnung in einem fremden Gewinner-Post
    mention = item("t1", body="Winners: u/ferdi_123", context=other, type="username_mention", link_title="Giveaway results")
    assert inbox_signal(mention, "ferdi_123", giveaways, cfg).priority == 5
    # Private Nachricht vom Giveaway-Host
    pm = inbox_signal(item("t4", subject="Giveaway", body="You won the Sprite, congrats!"), "ferdi_123", giveaways, cfg)
    assert pm.priority == 5
    assert inbox_signal(item("t4", author="spam", subject="hi", body="hello"), "ferdi_123", giveaways, cfg) is None
