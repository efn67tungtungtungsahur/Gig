# Athlos – Fitness, Gesundheit & Schule in einer App

Athlos ist eine Android-App, die deinen **Google Kalender**, **Fitbit**, **Withings**, **Liftoff** (inkl. Rangliste & Errungenschaften) und deine **Oral-B iO** zusammenführt, alles auswertet und dir an einer Stelle zeigt.

## 📲 Herunterladen & installieren

1. Öffne auf deinem Android-Handy diesen Link:
   **https://github.com/efn67tungtungtungsahur/Gig/releases/download/fit-app-latest/Athlos.apk**
   (oder auf GitHub unter **Releases → „Athlos – Android-App“ → Assets → `Athlos.apk`**).
   Nicht verwechseln: Das Release „Gig – neueste Version“ (`app-latest`) gehört zu deinem Reddit-Bot-Projekt.
2. Datei öffnen. Fragt Android nach „Unbekannte Apps installieren“, erlaube das für deinen Browser.
3. Fertig. Neue Versionen installierst du genauso; sie überschreiben die alte, und deine Daten bleiben erhalten.

> Die APK wird bei jeder Änderung automatisch von GitHub Actions gebaut (Workflow „Athlos – Android-App bauen“).
> Voraussetzung: Android 8 oder neuer. Für Fitbit/Withings brauchst du **Health Connect** (ab Android 14 vorinstalliert, sonst aus dem Play Store).

**iPhone:** Eine iOS-App lässt sich ohne Apple-Entwicklerkonto (99 €/Jahr) und App Store/TestFlight nicht verteilen. Der Code ist plattformübergreifend (Capacitor) und kann später für iOS gebaut werden.

## ✨ Funktionen

| Bereich | Was Athlos macht |
|---|---|
| **Übersicht** | Gesamt-Score und Scores pro Bereich (Schlaf, Aktivität, Körper, Training, Zahnpflege), nächste Tests/Klausuren, Ferien-Countdown, alle Daten einheitlich auf einen Blick |
| **Schlaf** | Analyse von Dauer, Regelmäßigkeit, Effizienz und Tief-/REM-Schlaf. Sagt dir, ob du deinen Schlaf verbessern solltest, und schlägt eine Bettzeit vor. **Keine Schlaf-Erinnerungen in der Lernphase:** liegt laut Kalender eine Klausur in den nächsten 7 Tagen (einstellbar) oder steht „Lernen“ im Kalender, bleibt die Erinnerung aus |
| **Meine Geräte** | Du wählst aus, welche Geräte du hast (nach Kategorien, mit Schnellauswahl). Athlos schlägt dann für jedes Training aus deinem Kalender („Push“, „Beine“, „Ganzkörper“ …) passende Übungen mit Sätzen, Wiederholungen und Pausen vor |
| **Training erfassen** | Starte das Training aus dem Vorschlag oder leer und trag für jede Übung die Sätze mit **Gewicht und Wiederholungen** ein. Die App zeigt, was du letztes Mal geschafft hast, schlägt das nächste Gewicht vor (hast du alle Sätze am oberen Ende geschafft → +2,5 kg), startet nach jedem Satz einen Pausen-Timer (mit Benachrichtigung) und meldet neue Rekorde. Verlauf aller Trainings und Fortschritts-Diagramm pro Übung |
| **Körperübersicht** | Figur von vorne und hinten mit allen Muskelgruppen in drei Ansichten: **Beanspruchung** (Energie pro Muskel in Gelb: blassgelb = Energie raus, lieber Pause; tiefgelb = voll erholt, kann richtig beansprucht werden – mit Zeit bis er wieder belastbar ist), **Woche** (Sätze pro Muskel in 7 Tagen, Ziel 10–20) und **Ränge**. Jeder Muskel bekommt einen Rang von **Holz III über Bronze, Silber, Gold, Platin, Diamant und Champion bis Olympionike I** – jeder Rang mit eigener Farbe, der Olympionike schimmert holografisch – aus deiner stärksten Übung im Verhältnis zum Körpergewicht, dazu ein Gesamt-Rang, das nächste Ziel („Für Gold I: Latzug 65 kg × 10“) und Hinweise zu Ungleichgewichten |
| **Noten** | Notenpunkte für 1.–4. Halbjahr wie in Notan: Fachschnitt, Halbjahresschnitt (LK zählen doppelt), Block I nach § 30 GOSTV Brandenburg (8 LK-Halbjahre doppelt + 28 Grundkurse, E I = P ÷ 44 × 40) und Abi-Prognose. Klausur-Anteil pro Fach einstellbar |
| **Serien** | **Noten-Serie:** Tests und Klausuren ab 13 Punkten in Folge. **Trainings-Serie:** geplante Trainings in Folge durchgezogen. Beide laufen nicht nach einem Tag ab, sondern richten sich nach deinen Terminen im Kalender |
| **Erinnerungen** | **Test:** 1 Woche, 3 Tage und 2 Tage vorher · **Klausur:** 2 Wochen, 1 Woche, 3 Tage und 2 Tage vorher (Uhrzeit und Abstände einstellbar) |
| **Ferien** | Alle 2 Wochen eine Benachrichtigung, wie viele Tage (und Schultage) es noch bis zu den nächsten Ferien in Brandenburg sind |
| **Gesamt-Update** | Wöchentliche Benachrichtigung plus Bericht mit Stärken, Verbesserungen, den nächsten Tagen und einer Zusammenfassung mit drei konkreten nächsten Schritten |
| **Liftoff** | Rang, Platz in der Rangliste (mit Auf-/Abstieg), XP, Serie und Errungenschaften (neu freigeschaltete werden hervorgehoben) sowie deine Workouts |
| **Oral-B iO** | Putzhäufigkeit, Dauer, Abdeckung, Druckwarnungen, Serie, Tipps |
| **Körper** | Gewicht, Körperfett und Blutdruck von Withings mit Verlauf |

Ohne Konten kannst du alles im **Demo-Modus** ausprobieren.

## 🔌 Einrichtung (in der App unter „Einstellungen“)

### Google Kalender
Google Kalender im Browser öffnen → ⚙️ **Einstellungen** → links deinen Kalender wählen → **Kalender integrieren** → **„Geheime Adresse im iCal-Format“** kopieren → in Athlos einfügen. Mehrere Kalender (Schule, privat) gehen auch.

Athlos erkennt Termine automatisch an Stichwörtern (anpassbar):
- **Klausur:** „Klausur“, „Prüfung“, „Abitur“
- **Test:** „Test“, „Leistungskontrolle“, „Kontrolle“, „Klassenarbeit“, „Quiz“
- **Training:** „Training“, „Gym“, „Push“, „Pull“, „Beine“, „Oberkörper“, „Ganzkörper“, „Cardio“ …
- **Lernen:** „Lernen“, „Lernzeit“, „Klausurvorbereitung“ …

### Fitbit & Withings → über Health Connect
Google schaltet die alte Fitbit-Web-API am **30.10.2026** ab. Athlos liest deshalb über **Health Connect**; dafür brauchst du kein Entwicklerkonto:
1. **Fitbit-App** → Profil → Einstellungen → **Health Connect** → Synchronisierung an.
2. **Withings-App (Health Mate)** → Profil → **Apps & Geräte verbinden** → **Health Connect** an. Für Schlafdaten dort auch **Schlaf** teilen. Für den Schlaf zählt standardmäßig **nur Withings** – Fitbit-Schlaf wird ignoriert. Ändern kannst du das unter Gesundheit → Schlaf → **Schlafquellen**.
3. In Athlos auf **Verbinden** tippen und die Leseberechtigungen erlauben.

### Liftoff
- **Rangliste, Rang & Errungenschaften:** Mach in der Liftoff-App Screenshots davon und importiere sie im Tab **Training**. Die Texterkennung auf dem Handy liest Platz, XP, Level, Serie, Rangliste und Errungenschaften aus; du prüfst die Werte vor dem Speichern. Alternativ kannst du sie von Hand eintragen.
- **Workouts (experimentell):** Anmeldung mit deinem Liftoff-Login (E-Mail und Passwort, nicht „Mit Google anmelden“). Liftoff hat keine offizielle Schnittstelle. Athlos nutzt dieselbe Schnittstelle wie die Liftoff-App, deshalb kann das jederzeit aufhören zu funktionieren. Gespeichert wird nur ein Anmelde-Token, nicht dein Passwort.

### Training erfassen
Im Tab **Training** auf **„▶ … starten“** tippen. Das Training läuft weiter, auch wenn du die App schließt; auf der Übersicht erscheint dann „Training läuft“.
- Gewicht und Wiederholungen eintragen und mit **✓** abhaken. Leere Felder übernehmen den grauen Vorschlag.
- Nach jedem Satz läuft die Pause (±15 s anpassbar); ist die App im Hintergrund, kommt eine Benachrichtigung.
- **+ Übung hinzufügen:** aus über 80 Übungen oder eine eigene. **+ Satz** fügt einen weiteren Satz hinzu.
- **Beenden:** Nur abgehakte Sätze werden gespeichert. Das Training zählt automatisch für deine Trainings-Serie.

### Körperübersicht & Muskel-Ränge
Tab **Training** → **Körperübersicht**. Tippe auf einen Muskel, um Rang, beste Leistung, nächstes Ziel, Sätze und Erholung zu sehen.
- Jeder Muskel hat ein eigenes Rang-Abzeichen: facettiertes Sechseck mit Muskel-Symbol (Faust, Rücken, Brust, Sixpack, Beine), ab Gold mit Flügeln, Diamant mit Speer, Champion mit dunklen Flügeln und Hörnern, Olympionike mit Krone und Holo-Schimmer.
- Der Gesamt-Rang zeigt einen Kreis pro Muskel in seiner Rangfarbe und die Leiter aller Ränge.
- **Rang-Rechner:** Übung wählen (durchblättern oder suchen), Gewicht bzw. Zusatzgewicht und Wiederholungen auf der Skala einstellen – der Rang erscheint sofort. Mit „Rang speichern“ zählt der Wert für deine Muskel-Ränge.
- Die Ränge beruhen auf gängigen Kraft-Standards: geschätztes Maximalgewicht (Epley) im Verhältnis zum Körpergewicht, bei Kurzhanteln pro Hand, bei Klimmzügen, Dips & Co. über die Wiederholungen. Gewertet wird die stärkste Übung der letzten 90 Tage; Nebenmuskeln zählen zu 70 %.
- Das Körpergewicht kommt von Withings, sonst trägst du es selbst ein. Als Maßstab kannst du die Kraftwerte von Männern oder Frauen wählen.
- Grundlage sind deine in der App erfassten Sätze und Liftoff-Workouts mit Übungsnamen.

### Plaketten & Abzeichen
- **Plaketten:** Körperübersicht → Reiter **Plaketten**. Für jede Muskelgruppe und den Gesamt-Rang eine Plakette in Rangfarbe mit facettiertem Stern, Rang und Datum der besten Leistung.
- **Abzeichen** (ähnlich wie bei Fitbit, eigene Motive): Gesundheit → Aktivität. **Tagesschritte** von 5.000 bis 50.000, **Gesamtstrecke** vom Marathon über „Bis nach Berlin“, Jakobsweg und Rhein bis einmal um die Welt, **Laufen** (erster Lauf, 5 km, 10 km, Halbmarathon, Marathon, 10/50/100 Läufe). Schritte, Strecke und Läufe kommen über Health Connect (Fitbit); die App merkt sich jeden Tag dauerhaft. Fehlt die Strecke, wird sie aus den Schritten geschätzt.

### Oral-B iO
Oral-B bietet keine offene Schnittstelle. Mach in der Oral-B-App Screenshots von Verlauf und Putzübersicht und importiere sie unter **Gesundheit → Zähne**, oder tippe nach dem Putzen auf **„Gerade geputzt“**.

### Noten
Im Tab **Noten** sind deine Fächer schon angelegt (Englisch und Chemie als LK). Über ⚙️ kannst du Fächer ergänzen, den LK umstellen und festlegen, wie Klausuren zählen:
- **Alle gleich:** Durchschnitt aller Noten, so wie Notan rechnet (Standard)
- **Klausur ⅓ oder ½:** In Brandenburg legt die Lehrkraft die Gewichtung zu Kursbeginn fest (§ 12 GOSTV), oft zu einem Drittel. Pro Fach kannst du einen eigenen Anteil wählen.

Tests und Klausuren aus dem Kalender, für die noch keine Note eingetragen ist, erscheinen als „Punkte eintragen“. Nach einer und nach zwei Wochen erinnert dich die App daran.

### Kosten
Athlos braucht **kein Konto und keinen API-Schlüssel**, und es fallen **keine Kosten** an. Die Texterkennung für Liftoff- und Oral-B-Screenshots (Google ML Kit) ist in der App enthalten und läuft offline.

## 🔒 Datenschutz
Athlos hat keinen eigenen Server. Alle Daten liegen nur auf deinem Handy. Nach außen gehen ausschließlich Anfragen an deine eigenen Dienste (Kalender-Link, Liftoff), und an die OpenHolidays-API (Ferientermine). Screenshots verlassen das Handy nicht.

## 🛠️ Entwicklung

```bash
npm install
npm run dev        # Web-Vorschau im Browser (Demo-Modus)
npm test           # Unit-Tests der Auswertungslogik
npm run build      # Typecheck + Web-Build
npx cap sync android && cd android && ./gradlew assembleRelease
```

Aufbau:
- `src/domain/`: reine Logik (Kalender-Erkennung, Erinnerungen, Ferien, Schlafanalyse, Trainingsplaner, Trainings-Tagebuch, Muskel-Ränge, Noten & Abi-Berechnung, Serien, Gesamtbericht, Benachrichtigungsplan), getestet in `tests/`
- `src/integrations/`: Health Connect, iCal, Texterkennung (ML Kit), Liftoff, Benachrichtigungen
- `src/ui/`: Oberfläche (React)
- `android/`: Capacitor-Android-Projekt

**Signatur:** Updates installieren sich nur über die alte Version, wenn jede APK mit demselben Schlüssel signiert ist. Der Schlüssel liegt deshalb **nicht im Repository**. Der Workflow erzeugt ihn beim ersten Build und hebt ihn im GitHub-Actions-Cache auf. Der Cache gilt pro Branch und verfällt nach 7 Tagen ohne Build. Danach (oder nach einem Branch-Wechsel) entsteht ein neuer Schlüssel, und die App muss einmal neu installiert werden. Dauerhaft stabil wird es mit einem eigenen Schlüssel als Repository-Secret: `GIG_KEYSTORE_BASE64` (Keystore als Base64), `GIG_KEYSTORE_PASSWORD`, optional `GIG_KEY_ALIAS` und `GIG_KEY_PASSWORD`.
