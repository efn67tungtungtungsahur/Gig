# Gig Fit – Fitness, Gesundheit & Schule in einer App

Gig Fit ist eine Android-App, die deinen **Google Kalender**, **Fitbit**, **Withings**, **Liftoff** (inkl. Rangliste & Errungenschaften) und deine **Oral-B iO** zusammenführt, alles auswertet und dir an einer Stelle zeigt.

## 📲 Herunterladen & installieren

1. Öffne auf deinem Android-Handy diesen Link:
   **https://github.com/efn67tungtungtungsahur/Gig/releases/download/fit-app-latest/GigFit.apk**
   (oder auf GitHub unter **Releases → „Gig Fit – Android-App“ → Assets → `GigFit.apk`**).
   Nicht verwechseln: Das Release „Gig – neueste Version“ (`app-latest`) gehört zu deinem Reddit-Bot-Projekt.
2. Datei öffnen. Fragt Android nach „Unbekannte Apps installieren“, erlaube das für deinen Browser.
3. Fertig. Neue Versionen installierst du genauso; sie überschreiben die alte, und deine Daten bleiben erhalten.

> Die APK wird bei jeder Änderung automatisch von GitHub Actions gebaut (Workflow „Gig Fit – Android-App bauen“).
> Voraussetzung: Android 8 oder neuer. Für Fitbit/Withings brauchst du **Health Connect** (ab Android 14 vorinstalliert, sonst aus dem Play Store).

**iPhone:** Eine iOS-App lässt sich ohne Apple-Entwicklerkonto (99 €/Jahr) und App Store/TestFlight nicht verteilen. Der Code ist plattformübergreifend (Capacitor) und kann später für iOS gebaut werden.

## ✨ Funktionen

| Bereich | Was Gig Fit macht |
|---|---|
| **Übersicht** | Gesamt-Score und Scores pro Bereich (Schlaf, Aktivität, Körper, Training, Zahnpflege), nächste Tests/Klausuren, Ferien-Countdown, alle Daten einheitlich auf einen Blick |
| **Schlaf** | Analyse von Dauer, Regelmäßigkeit, Effizienz und Tief-/REM-Schlaf. Sagt dir, ob du deinen Schlaf verbessern solltest, und schlägt eine Bettzeit vor. **Keine Schlaf-Erinnerungen in der Lernphase:** liegt laut Kalender eine Klausur in den nächsten 7 Tagen (einstellbar) oder steht „Lernen“ im Kalender, bleibt die Erinnerung aus |
| **Raum-Scan** | Fotografiere deinen Trainingsraum. Die Bilderkennung auf dem Handy erkennt die sichtbaren Geräte, du bestätigst sie kurz. Gig Fit schlägt dann für jedes Training aus deinem Kalender („Push“, „Beine“, „Ganzkörper“ …) passende Übungen mit Sätzen, Wiederholungen und Pausen vor |
| **Erinnerungen** | **Test:** 1 Woche, 3 Tage und 2 Tage vorher · **Klausur:** 2 Wochen, 1 Woche, 3 Tage und 2 Tage vorher (Uhrzeit und Abstände einstellbar) |
| **Ferien** | Alle 2 Wochen eine Benachrichtigung, wie viele Tage (und Schultage) es noch bis zu den nächsten Ferien in Brandenburg sind |
| **Gesamt-Update** | Wöchentliche Benachrichtigung plus Bericht mit Stärken, Verbesserungen, den nächsten Tagen und einer Zusammenfassung mit drei konkreten nächsten Schritten |
| **Liftoff** | Rang, Platz in der Rangliste (mit Auf-/Abstieg), XP, Serie und Errungenschaften (neu freigeschaltete werden hervorgehoben) sowie deine Workouts |
| **Oral-B iO** | Putzhäufigkeit, Dauer, Abdeckung, Druckwarnungen, Serie, Tipps |
| **Körper** | Gewicht, Körperfett und Blutdruck von Withings mit Verlauf |

Ohne Konten kannst du alles im **Demo-Modus** ausprobieren.

## 🔌 Einrichtung (in der App unter „Einstellungen“)

### Google Kalender
Google Kalender im Browser öffnen → ⚙️ **Einstellungen** → links deinen Kalender wählen → **Kalender integrieren** → **„Geheime Adresse im iCal-Format“** kopieren → in Gig Fit einfügen. Mehrere Kalender (Schule, privat) gehen auch.

Gig Fit erkennt Termine automatisch an Stichwörtern (anpassbar):
- **Klausur:** „Klausur“, „Prüfung“, „Abitur“
- **Test:** „Test“, „Leistungskontrolle“, „Kontrolle“, „Klassenarbeit“, „Quiz“
- **Training:** „Training“, „Gym“, „Push“, „Pull“, „Beine“, „Oberkörper“, „Ganzkörper“, „Cardio“ …
- **Lernen:** „Lernen“, „Lernzeit“, „Klausurvorbereitung“ …

### Fitbit & Withings → über Health Connect
Google schaltet die alte Fitbit-Web-API am **30.10.2026** ab. Gig Fit liest deshalb über **Health Connect**; dafür brauchst du kein Entwicklerkonto:
1. **Fitbit-App** → Profil → Einstellungen → **Health Connect** → Synchronisierung an.
2. **Withings-App (Health Mate)** → Profil → **Apps & Geräte verbinden** → **Health Connect** an.
3. In Gig Fit auf **Verbinden** tippen und die Leseberechtigungen erlauben.

### Liftoff
- **Rangliste, Rang & Errungenschaften:** Mach in der Liftoff-App Screenshots davon und importiere sie im Tab **Training**. Die Texterkennung auf dem Handy liest Platz, XP, Level, Serie, Rangliste und Errungenschaften aus; du prüfst die Werte vor dem Speichern. Alternativ kannst du sie von Hand eintragen.
- **Workouts (experimentell):** Anmeldung mit deinem Liftoff-Login (E-Mail und Passwort, nicht „Mit Google anmelden“). Liftoff hat keine offizielle Schnittstelle. Gig Fit nutzt dieselbe Schnittstelle wie die Liftoff-App, deshalb kann das jederzeit aufhören zu funktionieren. Gespeichert wird nur ein Anmelde-Token, nicht dein Passwort.

### Oral-B iO
Oral-B bietet keine offene Schnittstelle. Mach in der Oral-B-App Screenshots von Verlauf und Putzübersicht und importiere sie unter **Gesundheit → Zähne**, oder tippe nach dem Putzen auf **„Gerade geputzt“**.

### Bilderkennung (kostenlos, auf dem Handy)
Gig Fit braucht **kein Konto und keinen API-Schlüssel**, und es fallen **keine Kosten** an:
- **Texterkennung** für Liftoff- und Oral-B-Screenshots: Google ML Kit. Ist in der App enthalten und läuft offline.
- **Raum-Scan:** das offene Modell MobileCLIP. Es wird beim ersten Scan einmalig kostenlos von Hugging Face geladen (WLAN empfohlen) und läuft danach offline. Unter Einstellungen → „Bilderkennung“ kannst du es auch vorab laden.
Nicht jedes Gerät wird sicher erkannt. Deshalb zeigt die App die Treffer mit Prozentangabe an, und du bestätigst sie oder ergänzt Geräte von Hand.

## 🔒 Datenschutz
Gig Fit hat keinen eigenen Server. Alle Daten liegen nur auf deinem Handy. Nach außen gehen ausschließlich Anfragen an deine eigenen Dienste (Kalender-Link, Liftoff), an die OpenHolidays-API (Ferientermine) und einmalig an Hugging Face (Download des Erkennungsmodells). Fotos und Screenshots verlassen das Handy nicht.

## 🛠️ Entwicklung

```bash
npm install
npm run dev        # Web-Vorschau im Browser (Demo-Modus)
npm test           # Unit-Tests der Auswertungslogik
node scripts/e2e-scan.mjs <url>   # Raum-Scan gegen echte Fotos (läuft auch als GitHub-Workflow)
npm run build      # Typecheck + Web-Build
npx cap sync android && cd android && ./gradlew assembleRelease
```

Aufbau:
- `src/domain/`: reine Logik (Kalender-Erkennung, Erinnerungen, Ferien, Schlafanalyse, Trainingsplaner, Gesamtbericht, Benachrichtigungsplan), komplett getestet in `tests/`
- `src/integrations/`: Health Connect, iCal, Bilderkennung (transformers.js), Texterkennung (ML Kit), Liftoff, Benachrichtigungen, Kamera
- `src/ui/`: Oberfläche (React)
- `android/`: Capacitor-Android-Projekt

**Signatur:** Updates installieren sich nur über die alte Version, wenn jede APK mit demselben Schlüssel signiert ist. Der Schlüssel liegt deshalb **nicht im Repository**. Der Workflow erzeugt ihn beim ersten Build und hebt ihn im GitHub-Actions-Cache auf. Der Cache gilt pro Branch und verfällt nach 7 Tagen ohne Build. Danach (oder nach einem Branch-Wechsel) entsteht ein neuer Schlüssel, und die App muss einmal neu installiert werden. Dauerhaft stabil wird es mit einem eigenen Schlüssel als Repository-Secret: `GIG_KEYSTORE_BASE64` (Keystore als Base64), `GIG_KEYSTORE_PASSWORD`, optional `GIG_KEY_ALIAS` und `GIG_KEY_PASSWORD`.
