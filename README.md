# Gig – Reddit-Giveaway-Bot 🎁⌚

Gig läuft auf deinem Laptop und sucht in **r/RepWatchClud** (und weiteren Subreddits, die du einträgst) nach Giveaways für Rep-Uhren. Wenn er eins findet, kommentiert er und nimmt so teil. Danach prüft er regelmäßig, ob du gewonnen hast. Wenn ja, bekommst du eine **Push-Benachrichtigung aufs Handy**, über die eigene Android-App (APK).

```
Laptop: Gig-Bot (Python + Browser)  ──►  ntfy.sh  ──►  Handy: Gig-App (APK)
```

## ⚠️ Vorher wissen

- **Kein Reddit-API-Schlüssel nötig, aber auch nicht möglich:** Reddit hat seine offizielle API für neue Entwickler dichtgemacht. Neue Anträge gehen nur noch bis 31.10.2026, RSS-Feeds enden am 13.11.2026, und die öffentliche API wird im März 2027 ganz abgeschaltet. Der Bot benutzt deshalb deinen normalen Reddit-Login in einem eigenen Browser-Profil und ruft dieselben Adressen auf wie die Reddit-Webseite.
- **Risiko für deinen Account:** Automatisches Kommentieren verstößt gegen die Nutzungsbedingungen von Reddit, und manche Subreddits verbieten Bots. Reddit kann deinen Account deswegen einschränken oder sperren. Deshalb ist der Bot bewusst zurückhaltend:
  - pro Giveaway nur **ein** Kommentar
  - höchstens 20 Kommentare am Tag
  - mindestens 90 Sekunden Abstand zwischen zwei Kommentaren

  Wenn du das Risiko nicht willst, stell `auto_comment = false` ein. Dann meldet dir der Bot neue Giveaways nur, und du kommentierst selbst mit einem Tipp auf die Benachrichtigung.
- **Extra-Schritte:** Der Bot kann nur kommentieren. Verlangt ein Giveaway mehr (Upvote, WhatsApp- oder Telegram-Gruppe), bekommst du eine Benachrichtigung mit Link und erledigst den Rest selbst.
- **Vorsicht bei „Gewinnen“, die Geld kosten:** Bei Rep-Giveaways sollen angebliche Gewinner manchmal Versand oder Zoll vorab bezahlen. Ein echtes Giveaway kostet dich nichts.
- **Der Laptop muss an sein** (kein Standby), sonst arbeitet der Bot nicht.

## 1. Laptop einrichten (Windows)

1. **Python 3.11 oder neuer** installieren: <https://www.python.org/downloads/>. Beim Installieren den Haken bei **„Add python.exe to PATH“** setzen.
2. Dieses Repository herunterladen (grüner Button **Code → Download ZIP**) und entpacken.
3. Im Ordner `bot` doppelt auf **`start_windows.bat`** klicken.
   - Beim ersten Start wird alles installiert. Das dauert ein paar Minuten.
   - Ein Browserfenster öffnet sich. Logg dich dort bei Reddit ein (Google- oder Apple-Login geht auch). Danach schließt sich das Fenster, und der Bot arbeitet unsichtbar weiter.
   - Im schwarzen Fenster steht dein **Kanal**, z. B. `gig-k3m9x2qa7b`. Den brauchst du gleich fürs Handy.
4. Das Fenster offen lassen. Beenden kannst du den Bot mit `Strg+C`.

Auf Mac oder Linux startest du den Bot so: `cd bot && ./start.sh`

## 2. Handy einrichten (Android)

1. Auf dem Handy die App herunterladen: **<https://github.com/efn67tungtungtungsahur/Gig/releases/tag/app-latest>**, Datei `gig.apk`.
2. Datei öffnen und installieren. Android fragt eventuell, ob dein Browser Apps installieren darf; das musst du erlauben.
3. App öffnen, Benachrichtigungen erlauben, den **Kanal** vom Laptop eintragen und auf **„Speichern & verbinden“** tippen.
4. **„Akku-Optimierung ausschalten“** antippen. Sonst kann Android die Verbindung im Hintergrund trennen.
5. Auf **„Test senden“** tippen. Nach ein paar Sekunden sollte eine Benachrichtigung kommen.

Auch vom Laptop aus kannst du eine Test-Nachricht schicken: `start_windows.bat test`

> Alternative: Die offizielle **ntfy**-App (Play Store / F-Droid) funktioniert genauso. Dort einfach denselben Kanal abonnieren.

## Was aufs Handy kommt

| Benachrichtigung | Wann |
|---|---|
| 🏆 **Möglicher Gewinn!** / **Du wurdest erwähnt** | Mögliche Auslöser: Jemand antwortet auf deinen Giveaway-Kommentar mit „congrats“ oder „you won“. Der Giveaway-Post wird mit deinem Namen bearbeitet. Du wirst in einem Gewinner-Post erwähnt. Du bekommst eine Gewinn-Nachricht. |
| 📣 **Gewinner wurden verkündet** | Ein Host, bei dessen Giveaway du mitmachst, postet die Gewinner. Die stehen oft auf einem Bild, also selbst nachschauen. |
| ✅ **Bei Giveaway teilgenommen** | Der Bot hat kommentiert. |
| 🎁 **Neues Giveaway** | Nur bei `auto_comment = false`: Du sollst selbst kommentieren. |
| ⚠️ **Problem** | Der Bot ist ausgeloggt oder wird von Reddit blockiert. |

Gewinn-Meldungen kommen mit hoher Priorität (laut, mit Vibration). Tippst du darauf, öffnet sich der Reddit-Post.

Reddit-**Chats** (das neue Nachrichtensystem) kann der Bot nicht lesen. Die meisten Hosts verkünden die Gewinner aber öffentlich oder antworten direkt auf deinen Kommentar. Chat-Nachrichten zeigt dir außerdem die Reddit-App selbst an.

## Einstellungen

Die Einstellungen stehen in `bot/config.toml`. Die Datei wird beim ersten Start angelegt und ist kommentiert. Die wichtigsten Einträge:

| Einstellung | Bedeutung |
|---|---|
| `subreddits` | In welchen Subreddits gesucht wird, z. B. `["RepWatchClud", "AnderesSub"]` |
| `search_queries` | Optional: Reddit-weite Suche, z. B. `["rep watch giveaway"]` |
| `auto_comment` | `true` = automatisch teilnehmen, `false` = nur melden |
| `comments` | Kommentare, aus denen zufällig einer gewählt wird. Verlangt ein Post einen bestimmten Text (z. B. `comment "Sprite"`), wird genau der genommen. |
| `notify_entries` | `false` = nur Gewinne und Probleme melden |
| `headless` | `false` = Browserfenster sichtbar lassen (hilft, wenn Reddit blockt) |
| `browser_channel` | `"msedge"` = vorinstallierten Edge benutzen statt eigenem Chromium |

Nach einer Änderung den Bot neu starten.

## Befehle

Unter Windows startest du alles über `start_windows.bat <befehl>`, auf Mac/Linux über `./start.sh <befehl>`:

| Befehl | Was er macht |
|---|---|
| *(nichts)* | Bot starten |
| `login` | Neu bei Reddit einloggen |
| `check` | Testen, ob Reddit-Zugriff und Benachrichtigungen funktionieren; zeigt gefundene Giveaways |
| `test` | Nur eine Test-Benachrichtigung schicken |
| `status` | Liste aller gefundenen Giveaways mit Teilnahme-Status |
| `--dry-run` | Bot laufen lassen, ohne zu kommentieren |

## Probleme?

- **„Reddit blockiert den Bot“** oder **„Webseite statt Daten“**: In `config.toml` `headless = false` setzen und neu starten. Das Browserfenster bleibt dann sichtbar; minimieren ist okay, schließen nicht.
- **Ausgeloggt:** `start_windows.bat login`
- **Keine Benachrichtigungen:**
  - Steht in der App derselbe Kanal wie im Bot-Fenster?
  - Ist die Akku-Optimierung ausgeschaltet?
  - Mit `start_windows.bat test` testen.
- **Der Bot kommentiert nicht:**
  - Mit `start_windows.bat status` nachsehen, was er gefunden hat.
  - Das Protokoll steht in `bot/data/bot.log`.
  - Hinweis: Reddit bremst neue oder Accounts mit wenig Karma beim Kommentieren. Der Bot wartet dann und versucht es später noch einmal.

## Aufbau

```
bot/                Python-Bot (läuft auf dem Laptop)
  gig/reddit.py     Reddit-Zugriff über eingeloggten Browser (Playwright)
  gig/detect.py     Erkennt Giveaways, geforderte Kommentare, Gewinn-Hinweise
  gig/bot.py        Ablauf: suchen → teilnehmen → Gewinne prüfen → melden
  gig/notify.py     Push über ntfy
  tests/            Tests (python -m pytest tests)
android/            Android-App (Kotlin), empfängt die Meldungen
.github/workflows/  baut die APK automatisch und stellt sie unter „Releases“ bereit
```

Die App wird bei jeder Änderung im Ordner `android/` von GitHub automatisch neu gebaut. Die neueste `gig.apk` liegt dann wieder unter dem Release-Link oben.
