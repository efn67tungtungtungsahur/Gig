"""Bot liest die Beschreibung, findet mehr Giveaways und nimmt am richtigen zuerst teil."""

from conftest import make_comment, make_post
from test_bot import NOW, FakeReddit, make_bot

SPRITE = """To enter:
1. Upvote this post
2. Join r/RepWatchClud and follow u/ContributionAble4509
3. Comment "Sprite" below
4. Tag 2 friends
5. Join our Telegram https://t.me/chenwatch
Winner will be announced in 72 hours."""


def test_does_everything_the_description_asks_that_it_may(cfg, tmp_path):
    reddit = FakeReddit([make_post(selftext=SPRITE, created=NOW - 600)])
    bot, _ = make_bot(cfg, tmp_path, reddit)
    bot.tick()
    assert reddit.posted == [("t3_abc123", "Sprite")]
    assert reddit.subscribed == ["RepWatchClud", "u_ContributionAble4509"]
    msg = bot.notifier.sent[0]
    assert msg["title"] == "✅ Teilgenommen – noch was zu tun" and msg["priority"] == 4
    assert "Erledigt: r/RepWatchClud beigetreten, u/ContributionAble4509 gefolgt" in msg["message"]
    assert "👉 Noch von dir (1 Tipp): Upvote, 2 Freund(e) markieren, https://t.me/chenwatch" in msg["message"]


def test_joins_each_community_only_once(cfg, tmp_path):
    reddit = FakeReddit([make_post("p1"), make_post("p2", created=1_000_001.0)])
    bot, clock = make_bot(cfg, tmp_path, reddit)
    bot.tick()
    clock.t += cfg.min_seconds_between_comments + 1
    bot.tick()
    assert len(reddit.posted) == 2
    assert reddit.subscribed == ["RepWatchClud"]


def test_skips_giveaway_that_already_ended(cfg, tmp_path):
    reddit = FakeReddit([make_post()])
    reddit.threads["abc123"] = [make_comment("w", "ContributionAble4509", "Winners have been picked!", "t3_abc123")]
    bot, _ = make_bot(cfg, tmp_path, reddit)
    bot.tick()
    assert reddit.posted == []
    assert bot.state.giveaways["abc123"].failed == "schon beendet"


def test_does_not_comment_twice_if_already_in_thread(cfg, tmp_path):
    reddit = FakeReddit([make_post()])
    reddit.threads["abc123"] = [make_comment("mine", "Ferdi_123", "in!", "t3_abc123")]
    bot, _ = make_bot(cfg, tmp_path, reddit)
    bot.tick()
    assert reddit.posted == []
    assert bot.state.giveaways["abc123"].entered


def test_reddit_wide_search_finds_new_watch_subreddits(cfg, tmp_path):
    reddit = FakeReddit([])
    reddit.search_results = [
        make_post("w1", title="Rolex GMT giveaway!", flair=None, subreddit="RepWatchesEU"),
        make_post("g1", title="Steam key giveaway", flair=None, subreddit="pcgaming"),
    ]
    bot, clock = make_bot(cfg, tmp_path, reddit)
    bot.tick()
    assert set(bot.state.giveaways) == {"w1"}
    assert list(bot.state.discovered_subreddits) == ["RepWatchesEU"]
    clock.t += cfg.poll_seconds + 1
    bot.tick()
    assert ("RepWatchesEU", 1) in reddit.polled


def test_deep_search_once_a_day(cfg, tmp_path):
    reddit = FakeReddit([])
    bot, clock = make_bot(cfg, tmp_path, reddit)
    bot.tick()
    assert {p for _, p in reddit.polled} == {cfg.backfill_pages}
    reddit.polled.clear()
    clock.t += cfg.poll_seconds + 1
    bot.tick()
    assert {p for _, p in reddit.polled} == {1}
    reddit.polled.clear()
    clock.t += 86400
    bot.tick()
    assert {p for _, p in reddit.polled} == {cfg.backfill_pages}


def test_unavailable_subreddit_is_skipped_for_a_day(cfg, tmp_path):
    reddit = FakeReddit([])
    reddit.unavailable = {"RepTime"}
    bot, clock = make_bot(cfg, tmp_path, reddit)
    bot.tick()
    reddit.polled.clear()
    clock.t += cfg.poll_seconds + 1
    bot.tick()
    polled = {s for s, _ in reddit.polled}
    assert "RepTime" not in polled and "RepWatchClud" in polled


def test_enters_the_giveaway_that_ends_first(cfg, tmp_path):
    reddit = FakeReddit([
        make_post("later", created=NOW - 600),
        make_post("soon", created=NOW - 7200, selftext="Ends in 3 hours!"),
    ])
    bot, _ = make_bot(cfg, tmp_path, reddit)
    bot.tick()
    assert reddit.posted[0][0] == "t3_soon"


def test_old_but_still_running_giveaway_is_found(cfg, tmp_path):
    created = NOW - 12 * 86400
    reddit = FakeReddit([
        make_post("open", created=created, selftext="Big giveaway, runs for 3 weeks!"),
        make_post("over", created=created, selftext="Ends in 2 days"),
        make_post("noinfo", created=created),
    ])
    bot, _ = make_bot(cfg, tmp_path, reddit)
    bot.tick()
    assert set(bot.state.giveaways) == {"open"}
    assert bot.state.giveaways["open"].ends_at == created + 21 * 86400 + 3600
    assert reddit.posted[0][0] == "t3_open"


def test_notify_only_mode_suggests_comment_and_todo(cfg, tmp_path):
    cfg.auto_comment = False
    reddit = FakeReddit([make_post(selftext=SPRITE, created=NOW - 600)])
    bot, _ = make_bot(cfg, tmp_path, reddit)
    bot.tick()
    msg = bot.notifier.sent[0]
    assert msg["title"] == "🎁 Neues Giveaway"
    assert "Vorschlag: „Sprite“" in msg["message"]
    assert "Upvote" in msg["message"]


def test_win_checks_are_spread_out(cfg, tmp_path, monkeypatch):
    import gig.bot

    monkeypatch.setattr(gig.bot, "THREADS_PER_CHECK", 2)
    reddit = FakeReddit([make_post(f"p{i}", created=NOW - 600) for i in range(3)])
    bot, clock = make_bot(cfg, tmp_path, reddit)
    for gw in bot.state.giveaways.values():
        gw.entered = True
    bot.tick()
    for gw in bot.state.giveaways.values():
        gw.entered = True
    read = []
    reddit.thread = lambda pid, _orig=reddit.thread: read.append(pid) or _orig(pid)
    clock.t += cfg.win_check_seconds + 1
    bot.tick()
    assert len(read) == 2
    clock.t += cfg.win_check_seconds + 1
    bot.tick()
    assert len(read) == 4 and set(read) == {"p0", "p1", "p2"}
