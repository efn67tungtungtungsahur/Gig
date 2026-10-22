from conftest import make_comment, make_post

from gig.bot import GiveawayBot
from gig.detect import flatten_comments
from gig.reddit import CommentRejected, NotLoggedIn, RateLimited
from gig.state import State

NOW = 1_000_000.0 + 3600


class FakeReddit:
    def __init__(self, posts=()):
        self.username = "ferdi_123"
        self.posts = list(posts)
        self.my_comments = []
        self.threads = {}
        self.inbox_items = []
        self.posted = []
        self.fail_with = None

    def new_posts(self, subreddit):
        return list(self.posts)

    def search(self, query):
        return []

    def user_comments(self, username):
        return list(self.my_comments)

    def inbox(self):
        return list(self.inbox_items)

    def thread(self, post_id):
        post = next(p for p in self.posts if p["id"] == post_id)
        return post, flatten_comments(self.threads.get(post_id, []))

    def post_comment(self, fullname, text):
        if self.fail_with:
            raise self.fail_with
        self.posted.append((fullname, text))
        return f"t1_new{len(self.posted)}"


class FakeNotifier:
    def __init__(self):
        self.sent = []
        self.online = True

    def send(self, title, message, priority=3, click=None, tags=()):
        if not self.online:
            return False
        self.sent.append({"title": title, "message": message, "priority": priority, "click": click})
        return True


class Clock:
    def __init__(self, t=NOW):
        self.t = t

    def __call__(self):
        return self.t


def make_bot(cfg, tmp_path, reddit, **kw):
    clock = Clock()
    bot = GiveawayBot(cfg, reddit, FakeNotifier(), State(tmp_path / "state.json"), clock=clock, **kw)
    bot.state.first_run = NOW
    return bot, clock


def test_enters_new_giveaway_once(cfg, tmp_path):
    reddit = FakeReddit([make_post(), make_post("n1", title="QC please", flair="QC")])
    bot, clock = make_bot(cfg, tmp_path, reddit)
    bot.tick()
    assert len(reddit.posted) == 1
    fullname, text = reddit.posted[0]
    assert fullname == "t3_abc123" and text in cfg.comments
    assert bot.notifier.sent[0]["title"].startswith("✅")
    assert bot.notifier.sent[0]["click"].endswith("/comments/abc123/giveaway/")

    clock.t += 3600
    bot.tick()
    assert len(reddit.posted) == 1  # kein zweiter Kommentar

    # Zustand übersteht einen Neustart
    reloaded = State.load(tmp_path / "state.json")
    assert reloaded.giveaways["abc123"].entered
    assert reloaded.giveaways["abc123"].comment_ids == ["t1_new1"]


def test_uses_requested_comment(cfg, tmp_path):
    reddit = FakeReddit([make_post(selftext='Rules: upvote + comment "Sprite" to enter')])
    bot, _ = make_bot(cfg, tmp_path, reddit)
    bot.tick()
    assert reddit.posted[0][1] == "Sprite"


def test_skips_giveaway_already_entered_by_hand(cfg, tmp_path):
    reddit = FakeReddit([make_post()])
    reddit.my_comments = [make_comment("old", "ferdi_123", "in!", "t3_abc123")["data"]]
    bot, _ = make_bot(cfg, tmp_path, reddit)
    bot.tick()
    assert reddit.posted == []
    assert bot.state.giveaways["abc123"].entered


def test_skips_old_locked_and_own_posts(cfg, tmp_path):
    reddit = FakeReddit([
        make_post("old", created=NOW - 30 * 86400),
        make_post("lock", locked=True),
        make_post("mine", author="ferdi_123"),
    ])
    bot, _ = make_bot(cfg, tmp_path, reddit)
    bot.tick()
    assert reddit.posted == []


def test_respects_gap_and_daily_limit(cfg, tmp_path):
    cfg.max_comments_per_day = 2
    reddit = FakeReddit([make_post(f"p{i}", created=1_000_000.0 + i) for i in range(4)])
    bot, clock = make_bot(cfg, tmp_path, reddit)
    bot.tick()
    assert len(reddit.posted) == 1
    clock.t += 30
    bot.tick()
    assert len(reddit.posted) == 1  # Mindestabstand
    clock.t += cfg.min_seconds_between_comments
    bot.tick()
    assert len(reddit.posted) == 2
    clock.t += 3600
    bot.tick()
    assert len(reddit.posted) == 2  # Tageslimit


def test_rate_limit_is_retried_later(cfg, tmp_path):
    reddit = FakeReddit([make_post()])
    reddit.fail_with = RateLimited("try again in 5 minutes", 301)
    bot, clock = make_bot(cfg, tmp_path, reddit)
    bot.tick()
    assert reddit.posted == []
    reddit.fail_with = None
    clock.t += 120
    bot.tick()
    assert reddit.posted == []
    clock.t += 300
    bot.tick()
    assert len(reddit.posted) == 1


def test_rejected_comment_is_reported(cfg, tmp_path):
    reddit = FakeReddit([make_post()])
    reddit.fail_with = CommentRejected("THREAD_LOCKED: thread is locked")
    bot, _ = make_bot(cfg, tmp_path, reddit)
    bot.tick()
    assert bot.notifier.sent[0]["title"].startswith("❌")
    assert bot.state.giveaways["abc123"].failed


def test_notify_only_mode(cfg, tmp_path):
    cfg.auto_comment = False
    reddit = FakeReddit([make_post()])
    bot, _ = make_bot(cfg, tmp_path, reddit)
    bot.tick()
    assert reddit.posted == []
    assert bot.notifier.sent[0]["title"] == "🎁 Neues Giveaway"
    assert bot.notifier.sent[0]["priority"] == 4


def test_dry_run_does_not_comment(cfg, tmp_path):
    reddit = FakeReddit([make_post()])
    bot, _ = make_bot(cfg, tmp_path, reddit, dry_run=True)
    bot.tick()
    assert reddit.posted == []


def test_win_by_host_reply_is_notified_once(cfg, tmp_path):
    reddit = FakeReddit([make_post()])
    bot, clock = make_bot(cfg, tmp_path, reddit)
    bot.tick()
    reddit.threads["abc123"] = [
        make_comment("new1", "ferdi_123", "I'm in!", "t3_abc123"),
        make_comment("w1", "ContributionAble4509", "Congratulations, you won! Please DM me", "t1_new1"),
    ]
    clock.t += cfg.win_check_seconds + 1
    bot.tick()
    wins = [m for m in bot.notifier.sent if m["priority"] == 5]
    assert len(wins) == 1 and "Gewinn" in wins[0]["title"]
    clock.t += cfg.win_check_seconds + 1
    bot.tick()
    assert len([m for m in bot.notifier.sent if m["priority"] == 5]) == 1


def test_winner_post_mentioning_me(cfg, tmp_path):
    reddit = FakeReddit([make_post()])
    bot, clock = make_bot(cfg, tmp_path, reddit)
    bot.tick()
    reddit.posts.append(make_post("w2", title="Sprite giveaway results", selftext="Winner: u/ferdi_123"))
    clock.t += cfg.poll_seconds + 1
    bot.tick()
    assert any(m["title"].startswith("🏆") for m in bot.notifier.sent)
    assert len(reddit.posted) == 1  # Gewinner-Post wird nicht kommentiert


def test_announcement_by_host_without_my_name(cfg, tmp_path):
    reddit = FakeReddit([make_post()])
    bot, clock = make_bot(cfg, tmp_path, reddit)
    bot.tick()
    reddit.posts.append(make_post("w3", title="Giveaway winner is announced!", flair="GIVEAWAY"))
    clock.t += cfg.poll_seconds + 1
    bot.tick()
    assert bot.notifier.sent[-1]["title"] == "📣 Gewinner wurden verkündet"


def test_notifications_are_kept_until_delivered(cfg, tmp_path):
    reddit = FakeReddit([make_post()])
    bot, clock = make_bot(cfg, tmp_path, reddit)
    bot.notifier.online = False
    bot.tick()
    assert len(bot.state.outbox) == 1
    bot.notifier.online = True
    clock.t += 20
    bot.tick()
    assert bot.state.outbox == [] and len(bot.notifier.sent) == 1


def test_logout_is_reported_once_and_bot_keeps_running(cfg, tmp_path):
    reddit = FakeReddit([make_post()])
    reddit.new_posts = lambda sub: (_ for _ in ()).throw(NotLoggedIn("weg"))
    bot, clock = make_bot(cfg, tmp_path, reddit)
    bot.tick()
    clock.t += 20
    bot.tick()  # erfolgreicher Gewinn-Check dazwischen
    clock.t += cfg.poll_seconds + 1
    bot.tick()
    assert [m["title"] for m in bot.notifier.sent] == ["⚠️ Bot ist bei Reddit ausgeloggt"]

    clock.t += 7 * 3600  # besteht das Problem weiter, kommt nach 6 h eine Erinnerung
    bot.tick()
    assert len(bot.notifier.sent) == 2
