# Gig – Reddit-Giveaway-Bot 🎁⌚

Gig läuft unsichtbar auf deinem Laptop. Er sucht in **r/RepWatchClud** nach Giveaways für Rep-Uhren und nimmt per Kommentar teil. Wenn du gewinnst, vibriert dein **Handy**.

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

| Wer | Was |
|---|---|
| Laptop | Sucht alle 3 Minuten nach neuen Giveaways und kommentiert. Verlangt ein Post einen bestimmten Text (z. B. `comment "Sprite"`), wird genau der genommen. |
| Laptop | Prüft alle 10 Minuten, ob du gewonnen hast. Erkannt wird: eine Antwort auf deinen Kommentar mit „congrats“ oder „you won“, ein Giveaway-Post, der mit deinem Namen bearbeitet wurde, eine Erwähnung in einem Gewinner-Post oder eine Nachricht in deiner Reddit-Inbox. |
| Laptop | Verhindert den Ruhezustand, solange das Ladekabel steckt. Startet nach Absturz neu. Spielt neue Versionen von selbst ein. |
| Laptop | Blockt Reddit den unsichtbaren Browser, wechselt Gig von selbst zu einem minimierten Browserfenster. |
| Handy | 🏆 **Gewinn** – laut, mit Vibration. Tippen öffnet den Reddit-Post. |
| Handy | ✅ Teilnahme · 📣 Gewinner verkündet · 🔑 Login nötig · ⚠️ Problem |
| App | Zeigt „💻 Laptop-Bot aktiv“ oder eine Warnung, wenn der Laptop sich länger als 75 Minuten nicht gemeldet hat. |

## Gut zu wissen

- **Risiko für deinen Account:** Automatisches Kommentieren verstößt gegen die Reddit-Regeln, im schlimmsten Fall wird der Account gesperrt. Gig hält sich deshalb zurück: ein Kommentar pro Giveaway, höchstens 20 am Tag, mindestens 90 Sekunden Abstand. Nur melden statt kommentieren: in `config.toml` `auto_comment = false` setzen.
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
