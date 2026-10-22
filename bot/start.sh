#!/usr/bin/env sh
# Gig Giveaway-Bot starten (macOS / Linux). Argumente werden durchgereicht, z. B. ./start.sh check
set -e
cd "$(dirname "$0")"
if [ ! -x .venv/bin/python ]; then
  echo "Erster Start: richte Python-Umgebung ein ..."
  python3 -m venv .venv
  .venv/bin/python -m pip install -r requirements.txt
  .venv/bin/python -m playwright install chromium
fi
exec .venv/bin/python gig_bot.py "$@"
