# Gig – Reddit-Giveaway-Bot 🎁⌚

> **⏹ Gig ist zurzeit abgeschaltet.** Installierte Bots beenden sich beim nächsten Update von selbst
> (spätestens nach 6 Stunden oder beim nächsten Laptop-Start) und melden „⏹ Gig ist abgeschaltet“ aufs Handy.
> Wieder einschalten: in `bot/SWITCH` `on` statt `off` eintragen.

Gig läuft unsichtbar auf deinem Laptop. Er sucht in r/RepWatchClud und weiteren Rep-Uhren-Communities nach Giveaways, liest die Teilnahmebedingungen und nimmt teil. Wenn du gewinnst, vibriert dein **Handy**.

```
Laptop: Gig (startet automatisch, aktualisiert sich selbst)  ──►  ntfy.sh  ──►  Handy: Gig-App
```

## Einrichten – das musst du selbst machen (einmalig, ca. 6 Minuten)

Alles andere läuft automatisch. Diese Schritte gehen nicht ohne dich: Software auf deinem Laptop installieren, dich bei Reddit anmelden und eine App auf deinem Handy installieren.

### Schritt 1 – Laptop

**Windows**
1. Die **Windows-Taste** drücken, `PowerShell` tippen und **Enter** drücken.
2. Diese Zeile kopieren, ins blaue Fenster einfügen (**Rechtsklick**) und **Enter** drücken:
   ```
   irm https://github.com/efn67tungtungtungsahur/Gig/releases/download/app-latest/install.ps1 | iex
   ```
3. Ein paar Minuten warten, bis sich ein **Browserfenster** öffnet.

**Mac**
1. **Cmd + Leertaste** drücken, `Terminal` tippen und **Enter** drücken.
2. Diese Zeile einfügen und **Enter** drücken:
   ```
   curl -fsSL https://github.com/efn67tungtungtungsahur/Gig/releases/download/app-latest/install.sh | bash
   ```

### Schritt 2 – Bei Reddit einloggen

Im Browserfenster, das sich geöffnet hat, bei Reddit einloggen. Google- oder Apple-Login geht auch.

Danach zeigt das Fenster **zwei QR-Codes**. Lass es offen.

### Schritt 3 – Handy (Android)

1. Den **linken QR-Code** mit der Handy-Kamera scannen und `gig.apk` herunterladen.
2. Die Datei öffnen und installieren. Fragt Android, ob dein Browser Apps installieren darf: **Zulassen**.
3. Die **Gig-App** öffnen und zweimal **Zulassen** tippen (Benachrichtigungen und Akku).
4. In der App auf **„📷 Mit Laptop koppeln“** tippen und den **rechten QR-Code** scannen.

Danach steht im Laptop-Fenster **„✅ Handy verbunden“**, und auf dem Handy kommt **„✅ Gig ist verbunden“**.

### Schritt 4 (nur Windows) – eine Frage beantworten

Das PowerShell-Fenster fragt zum Schluss, ob Gig auch bei **zugeklapptem** Laptop weiterlaufen soll, solange das Ladekabel steckt. **Enter** heißt Ja.

**Fertig.** Ab jetzt startet Gig automatisch mit dem Laptop, hält sich selbst aktuell und startet sich nach Fehlern neu. In der App siehst du jederzeit, ob der Laptop-Bot läuft.

## Was dann automatisch passiert

**Giveaways finden**
- Alle 60 Sekunden prüft der Bot r/RepWatchClud, r/RepCulture_Timepieces, r/RepWatch, r/RepTime, r/ChinaTime, r/repwatchbuysell, r/1688Time und r/RepTimeQC auf frische Giveaways.
- Alle 5 Minuten durchsucht er ganz Reddit nach Uhren-Giveaways. Findet er dabei ein neues Uhren-Subreddit, nimmt er es von selbst in die Liste auf.
- Einmal am Tag geht er tiefer (je Subreddit 400 Posts, Suche über einen Monat) und findet so auch ältere Giveaways, die noch laufen.
- Er erkennt, ob ein Giveaway vorbei ist:
  - Enddatum in der Beschreibung („ends in 48h“, „closes Oct 25“, „winner picked Sunday“)
  - Flair „Ended“ oder „Closed“
  - gesperrter Post
  - der Host hat im Thread schon Gewinner verkündet
- Was bald endet, kommt zuerst dran.

**Die Beschreibung lesen und teilnehmen**

| Verlangt das Giveaway … | macht der Bot |
|---|---|
| `comment "Sprite"` | kommentiert genau „Sprite“ |
| „pick a number 1–100“ | sucht sich eine Zahl, die noch niemand genommen hat |
| „comment your dream watch“ / „why do you want to win“ | schreibt eine passende Antwort |
| „join r/…“, „follow me / u/…“ | tritt der Community bei bzw. folgt dem Host (und tritt immer dem Subreddit des Giveaways bei) |
| „tag 2 friends“ | markiert Freunde aus `friends = [...]` in der Config. Ohne Eintrag sagt er dir Bescheid. |
| Upvote, Teilen, Telegram-, WhatsApp- oder Discord-Gruppe | macht er **nicht**, sondern schickt dir eine Benachrichtigung mit Liste und Link |

Upvoten und Teilen sind absichtlich ausgelassen: Hosts sehen nicht, wer upvotet hat. Automatisches Abstimmen und Posten von Links erkennt Reddit aber schnell als Manipulation bzw. Spam und sperrt dafür Accounts.

**Gewinne erkennen und melden**
- Erkannt wird:
  - eine Antwort auf deinen Kommentar mit „congrats“ oder „you won“
  - dein Name im Giveaway-Post
  - eine Erwähnung in einem Gewinner-Post
  - eine Nachricht in deiner Reddit-Inbox
- Frische Giveaways prüft er alle 10 Minuten, ältere stündlich, bis eine Woche nach dem Ende.
- Aufs Handy kommen:
  - 🏆 **Gewinn** – laut, mit Vibration. Tippen öffnet den Post.
  - ✅ Teilnahme – mit „👉 noch zu tun“, falls du etwas selbst machen musst
  - 📣 Gewinner verkündet · 🔑 Login nötig · ⚠️ Problem

**Laptop**
- Gig startet automatisch und startet sich nach Abstürzen neu.
- Neue Versionen spielt er von selbst ein.
- Solange das Ladekabel steckt, schläft der Laptop nicht ein.
- Blockt Reddit den unsichtbaren Browser, wechselt Gig zu einem minimierten Fenster.
- Die App zeigt „💻 Laptop-Bot aktiv“ oder warnt, wenn er sich länger nicht gemeldet hat.

## Gut zu wissen

- **Risiko für deinen Account:** Automatisches Kommentieren verstößt gegen die Reddit-Regeln, im schlimmsten Fall wird der Account gesperrt. Gig hält sich deshalb zurück: ein Kommentar pro Giveaway, höchstens 30 am Tag, mindestens 60 Sekunden Abstand. Nur melden statt kommentieren: in `config.toml` `auto_comment = false` setzen.
- **Warum nur auf dem Laptop:** Reddit sperrt Server in Rechenzentren komplett (getestet von GitHub aus: „Blocked“). Gig muss deshalb über dein Internet zu Hause laufen.
- **Reddit-Chats** (das neue Nachrichtensystem) kann Gig nicht lesen. Die meisten Hosts verkünden die Gewinner aber öffentlich.
- **Extra-Schritte** wie Telegram- oder WhatsApp-Gruppen machst du selbst; nach jeder Teilnahme kommt eine Benachrichtigung mit Link.
- **Vorsicht:** Sollst du als „Gewinner“ Versand oder Zoll vorab bezahlen, ist das oft Betrug.
- **Samsung, Xiaomi und ähnliche Handys:** Bleiben die Benachrichtigungen aus, in den Android-Einstellungen bei der Gig-App den Akku auf **„Nicht eingeschränkt“** stellen.

## Wenn mal was ist

Unter Windows findest du im **Startmenü → Gig**:

| Verknüpfung | Wofür |
|---|---|
| Gig – Handy koppeln | QR-Code erneut anzeigen, z. B. für ein neues Handy |
| Gig – Neu bei Reddit einloggen | Reddit-Login wiederholen (die App meldet dir, wenn das nötig ist) |
| Gig – Protokoll ansehen | Nachlesen, was der Bot gemacht hat |
| Gig deinstallieren | Gig wieder entfernen |

Auf dem Mac geht das im Terminal mit `~/.gig/venv/bin/python ~/.gig/app/gig_bot.py pair` bzw. `login`.

Die Einstellungen stehen in `%LOCALAPPDATA%\Gig\app\config.toml` (Mac: `~/.gig/app/config.toml`), z. B. weitere Subreddits oder eigene Kommentartexte. Ändern musst du dort nichts.

## Für Entwickler

```
bot/                  Python-Bot
  gig/reddit.py       Reddit-Zugriff über eingeloggten Browser (Playwright)
  gig/detect.py       Erkennt Giveaways, geforderte Kommentare, Gewinn-Hinweise
  gig/bot.py          Ablauf: suchen → teilnehmen → Gewinne prüfen → melden
  gig/pairing.py      QR-Code-Kopplung mit der App
  launcher.py         Hintergrundbetrieb: Autostart, Neustart, Selbst-Update, wach halten
  tests/              python -m pytest tests
android/              Android-App (Kotlin)
install/              Installationsskripte für Windows und Mac
.github/workflows/    Bauen → Installation auf echtem Windows und Mac testen → Release
```

Jede Änderung wird automatisch gebaut und auf Windows und macOS über genau die Installationsbefehle oben getestet. Erst danach landet sie unter [Releases](https://github.com/efn67tungtungtungsahur/Gig/releases/tag/app-latest), und die installierten Bots spielen sie dann von selbst ein.
