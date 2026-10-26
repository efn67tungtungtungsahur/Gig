# Gig – Fitness, Gesundheit & Schule in einer App

Gig ist eine Android-App, die deinen **Google Kalender**, **Fitbit**, **Withings**, **Liftoff** (inkl. Rangliste & Errungenschaften) und deine **Oral-B iO** zusammenführt, alles auswertet und dir an einer Stelle zeigt.

## 📲 Herunterladen & installieren

1. Öffne auf deinem Android-Handy diesen Link:
   **https://github.com/efn67tungtungtungsahur/gig/releases/latest/download/Gig.apk**
   (oder auf GitHub unter **Releases → „Gig – neueste Version“ → Assets → `Gig.apk`**).
2. Datei öffnen. Fragt Android nach „Unbekannte Apps installieren“, erlaube das für deinen Browser.
3. Fertig. Neue Versionen installierst du genauso; sie überschreiben die alte, und deine Daten bleiben erhalten.

> Die APK wird bei jeder Änderung automatisch von GitHub Actions gebaut (Workflow „Android-App bauen“).
> Voraussetzung: Android 8 oder neuer. Für Fitbit/Withings brauchst du **Health Connect** (ab Android 14 vorinstalliert, sonst aus dem Play Store).

**iPhone:** Eine iOS-App lässt sich ohne Apple-Entwicklerkonto (99 €/Jahr) und App Store/TestFlight nicht verteilen. Der Code ist plattformübergreifend (Capacitor) und kann später für iOS gebaut werden.

## ✨ Funktionen

| Bereich | Was Gig macht |
|---|---|
| **Übersicht** | Gesamt-Score und Scores pro Bereich (Schlaf, Aktivität, Körper, Training, Zahnpflege), nächste Tests/Klausuren, Ferien-Countdown, alle Daten einheitlich auf einen Blick |
| **Schlaf** | Analyse von Dauer, Regelmäßigkeit, Effizienz und Tief-/REM-Schlaf. Sagt dir, ob du deinen Schlaf verbessern solltest, und schlägt eine Bettzeit vor. **Keine Schlaf-Erinnerungen in der Lernphase:** liegt laut Kalender eine Klausur in den nächsten 7 Tagen (einstellbar) oder steht „Lernen“ im Kalender, bleibt die Erinnerung aus |
| **Raum-Scan** | Fotografiere deinen Trainingsraum. Die KI (Claude) erkennt die sichtbaren Geräte. Gig schlägt dann für jedes Training aus deinem Kalender („Push“, „Beine“, „Ganzkörper“ …) passende Übungen mit Sätzen, Wiederholungen und Pausen vor |
| **Erinnerungen** | **Test:** 1 Woche, 3 Tage und 2 Tage vorher · **Klausur:** 2 Wochen, 1 Woche, 3 Tage und 2 Tage vorher (Uhrzeit und Abstände einstellbar) |
| **Ferien** | Alle 2 Wochen eine Benachrichtigung, wie viele Tage (und Schultage) es noch bis zu den nächsten Ferien in Brandenburg sind |
| **Gesamt-Update** | Wöchentliche Benachrichtigung plus Bericht mit Stärken, Verbesserungen und den nächsten Tagen; optional eine KI-Zusammenfassung mit drei konkreten nächsten Schritten |
| **Liftoff** | Rang, Platz in der Rangliste (mit Auf-/Abstieg), XP, Serie und Errungenschaften (neu freigeschaltete werden hervorgehoben) sowie deine Workouts |
| **Oral-B iO** | Putzhäufigkeit, Dauer, Abdeckung, Druckwarnungen, Serie, Tipps |
| **Körper** | Gewicht, Körperfett und Blutdruck von Withings mit Verlauf |

Ohne Konten kannst du alles im **Demo-Modus** ausprobieren.

## 🔌 Einrichtung (in der App unter „Einstellungen“)

### Google Kalender
Google Kalender im Browser öffnen → ⚙️ **Einstellungen** → links deinen Kalender wählen → **Kalender integrieren** → **„Geheime Adresse im iCal-Format“** kopieren → in Gig einfügen. Mehrere Kalender (Schule, privat) gehen auch.

Gig erkennt Termine automatisch an Stichwörtern (anpassbar):
- **Klausur:** „Klausur“, „Prüfung“, „Abitur“
- **Test:** „Test“, „Leistungskontrolle“, „Kontrolle“, „Klassenarbeit“, „Quiz“
- **Training:** „Training“, „Gym“, „Push“, „Pull“, „Beine“, „Oberkörper“, „Ganzkörper“, „Cardio“ …
- **Lernen:** „Lernen“, „Lernzeit“, „Klausurvorbereitung“ …

### Fitbit & Withings → über Health Connect
Google schaltet die alte Fitbit-Web-API am **30.10.2026** ab. Gig liest deshalb über **Health Connect**; dafür brauchst du kein Entwicklerkonto:
1. **Fitbit-App** → Profil → Einstellungen → **Health Connect** → Synchronisierung an.
2. **Withings-App (Health Mate)** → Profil → **Apps & Geräte verbinden** → **Health Connect** an.
3. In Gig auf **Verbinden** tippen und die Leseberechtigungen erlauben.

### Liftoff
- **Rangliste, Rang & Errungenschaften:** Mach in der Liftoff-App Screenshots davon und importiere sie im Tab **Training**. Die KI liest Platz, XP, Serie und Errungenschaften aus. Alternativ kannst du die Werte von Hand eintragen.
- **Workouts (experimentell):** Anmeldung mit deinem Liftoff-Login (E-Mail und Passwort, nicht „Mit Google anmelden“). Liftoff hat keine offizielle Schnittstelle. Gig nutzt dieselbe Schnittstelle wie die Liftoff-App, deshalb kann das jederzeit aufhören zu funktionieren. Gespeichert wird nur ein Anmelde-Token, nicht dein Passwort.

### Oral-B iO
Oral-B bietet keine offene Schnittstelle. Mach in der Oral-B-App Screenshots von Verlauf und Putzübersicht und importiere sie unter **Gesundheit → Zähne**, oder tippe nach dem Putzen auf **„Gerade geputzt“**.

### KI-Funktionen (Claude)
Raum-Scan, Screenshot-Import und KI-Zusammenfassung brauchen einen **Claude-API-Schlüssel** von [console.anthropic.com](https://console.anthropic.com/settings/keys). Der Schlüssel bleibt auf dem Handy und wird nur an `api.anthropic.com` gesendet. Ohne Schlüssel funktioniert alles andere trotzdem; die Geräte für den Trainingsraum wählst du dann von Hand aus.

## 🔒 Datenschutz
Gig hat keinen eigenen Server. Alle Daten liegen nur auf deinem Handy. Nach außen gehen ausschließlich Anfragen an deine eigenen Dienste (Kalender-Link, Liftoff), an die OpenHolidays-API (Ferientermine) und, wenn du es nutzt, an Claude.

## 🛠️ Entwicklung

```bash
npm install
npm run dev        # Web-Vorschau im Browser (Demo-Modus)
npm test           # Unit-Tests der Auswertungslogik
npm run build      # Typecheck + Web-Build
npx cap sync android && cd android && ./gradlew assembleRelease
```

Aufbau:
- `src/domain/`: reine Logik (Kalender-Erkennung, Erinnerungen, Ferien, Schlafanalyse, Trainingsplaner, Gesamtbericht, Benachrichtigungsplan), komplett getestet in `tests/`
- `src/integrations/`: Health Connect, iCal, Claude, Liftoff, Benachrichtigungen, Kamera
- `src/ui/`: Oberfläche (React)
- `android/`: Capacitor-Android-Projekt

**Signatur:** Updates installieren sich nur über die alte Version, wenn jede APK mit demselben Schlüssel signiert ist. Der Schlüssel liegt deshalb **nicht im Repository**. Der Workflow erzeugt ihn beim ersten Build und hebt ihn im GitHub-Actions-Cache auf. Der Cache gilt pro Branch und verfällt nach 7 Tagen ohne Build. Danach (oder nach einem Branch-Wechsel) entsteht ein neuer Schlüssel, und die App muss einmal neu installiert werden. Dauerhaft stabil wird es mit einem eigenen Schlüssel als Repository-Secret: `GIG_KEYSTORE_BASE64` (Keystore als Base64), `GIG_KEYSTORE_PASSWORD`, optional `GIG_KEY_ALIAS` und `GIG_KEY_PASSWORD`.
