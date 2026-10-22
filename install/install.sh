#!/usr/bin/env bash
# Gig Giveaway-Bot – Installation für macOS (und Linux)
#
# Im Terminal einfügen und Enter drücken:
#   curl -fsSL https://github.com/efn67tungtungtungsahur/Gig/releases/download/app-latest/install.sh | bash
#
# Installiert alles nach ~/.gig, öffnet einmal ein Fenster zum Reddit-Login und Handy-Koppeln
# und startet Gig danach automatisch bei jeder Anmeldung.
set -euo pipefail

BASE="${GIG_BASE_URL:-https://github.com/efn67tungtungtungsahur/Gig/releases/download/app-latest}"
GIG_HOME="$HOME/.gig"
APP="$GIG_HOME/app"
VENV="$GIG_HOME/venv"
PY="$VENV/bin/python"

step() { printf '\n\033[35m==> %s\033[0m\n' "$1"; }

echo "Gig Giveaway-Bot wird eingerichtet – das dauert ein paar Minuten."
mkdir -p "$APP" "$GIG_HOME/uv"

step "Laufende Gig-Version beenden (falls vorhanden)"
if [ "$(uname -s)" = Darwin ] && [ -f "$HOME/Library/LaunchAgents/com.gig.bot.plist" ]; then
  launchctl unload "$HOME/Library/LaunchAgents/com.gig.bot.plist" 2>/dev/null || true
fi
pkill -f "$VENV/bin/python" 2>/dev/null || true
sleep 1

case "$(uname -s)-$(uname -m)" in
  Darwin-arm64) TARGET=aarch64-apple-darwin ;;
  Darwin-x86_64) TARGET=x86_64-apple-darwin ;;
  Linux-x86_64) TARGET=x86_64-unknown-linux-gnu ;;
  Linux-aarch64 | Linux-arm64) TARGET=aarch64-unknown-linux-gnu ;;
  *) echo "Dieses System wird nicht unterstützt: $(uname -s) $(uname -m)"; exit 1 ;;
esac

step "Python-Werkzeug herunterladen"
curl -fsSL "https://github.com/astral-sh/uv/releases/latest/download/uv-$TARGET.tar.gz" |
  tar xz -C "$GIG_HOME/uv" --strip-components=1

step "Python einrichten"
export UV_PYTHON_INSTALL_DIR="$GIG_HOME/python" UV_CACHE_DIR="$GIG_HOME/cache" UV_PYTHON_PREFERENCE=only-managed
rm -rf "$VENV"
"$GIG_HOME/uv/uv" venv --seed --python 3.12 "$VENV"

step "Gig herunterladen"
curl -fsSL "$BASE/gig-bot.zip" -o "$GIG_HOME/gig-bot.zip"
"$PY" -c 'import sys, zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])' "$GIG_HOME/gig-bot.zip" "$APP"

step "Pakete und Browser installieren (dauert am längsten)"
GIG_BASE_URL="$BASE" "$PY" "$APP/launcher.py" --setup

if [ "${GIG_CI:-}" = "1" ]; then
  echo "CI-Modus: Login und Autostart werden übersprungen."
  exit 0
fi

step "Bei Reddit einloggen und Handy koppeln"
echo "Gleich öffnet sich ein Browserfenster:"
echo "  1. Bei Reddit einloggen"
echo "  2. Danach zeigt das Fenster zwei QR-Codes für dein Handy (App laden + koppeln)"
"$PY" "$APP/gig_bot.py" setup || true

step "Autostart einrichten und Gig starten"
if [ "$(uname -s)" = Darwin ]; then
  PLIST="$HOME/Library/LaunchAgents/com.gig.bot.plist"
  mkdir -p "$(dirname "$PLIST")"
  cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.gig.bot</string>
  <key>ProgramArguments</key>
  <array><string>$PY</string><string>$APP/launcher.py</string></array>
  <key>WorkingDirectory</key><string>$APP</string>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>StandardErrorPath</key><string>$APP/data/launchd.log</string>
</dict>
</plist>
EOF
  launchctl load -w "$PLIST"
else
  mkdir -p "$HOME/.config/autostart"
  cat > "$HOME/.config/autostart/gig.desktop" <<EOF
[Desktop Entry]
Type=Application
Name=Gig Giveaway-Bot
Exec="$PY" "$APP/launcher.py"
X-GNOME-Autostart-enabled=true
EOF
  nohup "$PY" "$APP/launcher.py" >/dev/null 2>&1 &
fi

echo
printf '\033[32mFERTIG! Gig läuft jetzt im Hintergrund und startet automatisch mit.\033[0m\n'
echo "Auf dem Handy kommt gleich die Nachricht „Gig läuft“. Du musst nichts weiter tun."
echo "Handy neu koppeln:  $PY $APP/gig_bot.py pair"
