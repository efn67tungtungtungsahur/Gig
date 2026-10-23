> **⏹ Gig ist zurzeit abgeschaltet.** Bitte nicht neu installieren. Bereits installierte Bots beenden sich von selbst.

## 🎁 Gig einrichten – 2 Schritte, danach läuft alles von selbst

### 1. Laptop (einmalig, ca. 5 Minuten)

**Windows:**
1. Windows-Taste drücken, `PowerShell` tippen, Enter.
2. Diese Zeile einfügen (Rechtsklick) und Enter drücken:
   ```
   irm https://github.com/efn67tungtungtungsahur/Gig/releases/download/app-latest/install.ps1 | iex
   ```

**Mac:** Programm „Terminal“ öffnen, diese Zeile einfügen und Enter drücken:
```
curl -fsSL https://github.com/efn67tungtungtungsahur/Gig/releases/download/app-latest/install.sh | bash
```

Danach öffnet sich ein Browserfenster. Logg dich dort bei Reddit ein. Anschließend zeigt das Fenster zwei QR-Codes für Schritt 2.

### 2. Handy (einmalig, ca. 1 Minute)

1. Den **linken** QR-Code mit der Handy-Kamera scannen, dann `gig.apk` herunterladen und öffnen. Fragt Android, ob die Installation aus dieser Quelle erlaubt ist: **Zulassen**.
2. Die Gig-App öffnen und zweimal **Zulassen** tippen (Benachrichtigungen und Akku).
3. Auf **„📷 Mit Laptop koppeln“** tippen und den **rechten** QR-Code scannen.

Fertig. Der Bot startet ab jetzt automatisch mit dem Laptop und hält sich selbst aktuell. Wenn du gewinnst, vibriert dein Handy. 🏆

---
Die Dateien unten werden bei jeder Änderung automatisch neu gebaut und auf Windows und macOS getestet:
- `gig.apk` – die Handy-App
- `gig-bot.zip` – der Bot
- `install.ps1` / `install.sh` – die Installationsskripte
