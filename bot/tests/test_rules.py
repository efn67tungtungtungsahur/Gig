import random
from datetime import datetime, timezone

from conftest import make_comment, make_post

from gig.detect import is_watch_related
from gig.rules import analyze, compose_comment, end_time, host_announced_winner, taken_numbers

# Mittwoch, 22.10.2025 12:00 UTC
CREATED = datetime(2025, 10, 22, 12, 0, tzinfo=timezone.utc).timestamp()
HOUR = 3600


def ts(*args):
    return datetime(*args, tzinfo=timezone.utc).timestamp()


SPRITE = """Hey everyone! 👋😎

It's giveaway time again! 🎁🥳

To enter:
1. Upvote this post
2. Join r/RepWatchClud and follow u/ContributionAble4509
3. Comment "Sprite" below
4. Tag 2 friends
5. Join our Telegram https://t.me/chenwatch or WhatsApp group

Winner will be announced in 72 hours. Good luck!"""


def test_reads_the_whole_description():
    req = analyze(make_post(selftext=SPRITE, created=CREATED), CREATED + HOUR)
    assert req.comment_text == "Sprite"
    assert req.upvote
    assert req.join_subreddits == ["RepWatchClud"]
    assert req.follow_users == ["ContributionAble4509"]
    assert req.tag_friends == 2
    assert req.external == ["https://t.me/chenwatch"]
    assert req.ends_at == CREATED + 73 * HOUR
    assert not req.ended
    assert req.todo_for_user(friends_tagged=False) == ["Upvote", "2 Freund(e) markieren", "https://t.me/chenwatch"]
    assert req.todo_for_user(friends_tagged=True) == ["Upvote", "https://t.me/chenwatch"]


def test_follow_me_means_the_host():
    req = analyze(make_post(selftext="Follow me and comment to enter!", author="Host1"), CREATED)
    assert req.follow_users == ["Host1"]
    assert req.join_subreddits == []


def test_external_groups_without_links():
    req = analyze(make_post(selftext="Join our WhatsApp and Telegram for updates"), CREATED)
    assert req.external == ["Whatsapp-Gruppe beitreten", "Telegram-Gruppe beitreten"]


def test_end_dates():
    assert end_time("Giveaway ends in 48h", CREATED) == CREATED + 49 * HOUR
    assert end_time("Runs for 3 days", CREATED) == CREATED + 3 * 86400 + HOUR
    assert end_time("Winner announced on October 25th!", CREATED) == ts(2025, 10, 25, 23, 59, 59) + 12 * HOUR
    assert end_time("Closes 25.10. at 20:00", CREATED) == ts(2025, 10, 25, 23, 59, 59) + 12 * HOUR
    assert end_time("Ends 10/30", CREATED) == ts(2025, 10, 30, 23, 59, 59) + 12 * HOUR
    assert end_time("Winner picked this Sunday", CREATED) == ts(2025, 10, 26, 23, 59, 59) + 12 * HOUR
    assert end_time("Ends tomorrow", CREATED) == ts(2025, 10, 23, 23, 59, 59) + 12 * HOUR
    assert end_time("Ends Jan 3", CREATED) == ts(2026, 1, 3, 23, 59, 59) + 12 * HOUR  # nächstes Jahr
    assert end_time("72h giveaway!", CREATED) == CREATED + 73 * HOUR
    # erst das Datum, später eine andere Dauer → das Datum zählt
    assert end_time("Ends Oct 25 – shipping takes 7 days", CREATED) == ts(2025, 10, 25, 23, 59, 59) + 12 * HOUR
    assert end_time("Shipping worldwide, QC photos included", CREATED) is None


def test_ended_detection():
    assert analyze(make_post(selftext="Ends in 24h", created=CREATED), CREATED + 30 * HOUR).ended
    assert analyze(make_post(selftext="EDIT: Giveaway has ended, thanks all!"), CREATED).ended
    assert analyze(make_post(selftext="EDIT: The winner is u/someone"), CREATED).ended
    assert analyze(make_post(flair="Giveaway ENDED"), CREATED).ended
    assert analyze(make_post(locked=True), CREATED).ended
    assert not analyze(make_post(selftext="The winner is chosen randomly on Sunday", created=CREATED),
                       CREATED).ended


def test_host_announced_winner_in_comments():
    post = make_post(author="Host1")
    comments = [make_comment("c1", "Host1", "Winners have been picked, check your DMs!", "t3_abc123")["data"]]
    assert host_announced_winner(post, comments)
    comments = [make_comment("c1", "Host1", "Winner will be announced Sunday", "t3_abc123")["data"]]
    assert not host_announced_winner(post, comments)


def test_number_giveaway_picks_free_number(cfg):
    req = analyze(make_post(selftext="Pick a number between 1-5 in the comments!"), CREATED)
    assert req.number_range == (1, 5)
    comments = [make_comment(f"c{n}", "x", f"{n} please!", "t3_abc123")["data"] for n in (1, 2, 4, 5)]
    taken = taken_numbers(comments, req.number_range)
    assert taken == {1, 2, 4, 5}
    assert compose_comment(req, cfg, random.Random(1), taken) == "3 🍀"


def test_comment_styles(cfg):
    rng = random.Random(0)
    watch = analyze(make_post(selftext="Comment your dream watch to enter"), CREATED)
    assert compose_comment(watch, cfg, rng).startswith("My dream watch would be the ")
    why = analyze(make_post(selftext="Tell us why you deserve to win"), CREATED)
    assert compose_comment(why, cfg, rng) in cfg.why_answers
    plain = analyze(make_post(selftext="Just comment below"), CREATED)
    assert compose_comment(plain, cfg, rng) in cfg.comments
    tag = analyze(make_post(selftext="Comment and tag a friend"), CREATED)
    cfg.friends = ["buddy1", "buddy2"]
    assert compose_comment(tag, cfg, rng).endswith(" u/buddy1")
    both = analyze(make_post(selftext='Comment "in" and a number from 1 to 3'), CREATED)
    assert compose_comment(both, cfg, random.Random(0), {1, 2}) == "in 3"


def test_watch_filter_for_reddit_wide_search(cfg):
    assert is_watch_related(make_post(title="Giveaway: VSF Submariner"), cfg)
    assert is_watch_related({"subreddit": "RepWatches", "title": "Giveaway!"}, cfg)
    assert not is_watch_related({"subreddit": "pokemon", "title": "Giveaway, please repost"}, cfg)
