#!/usr/bin/env python3
"""Gig – Reddit-Giveaway-Bot.

    python gig_bot.py          Bot starten
    python gig_bot.py login    bei Reddit einloggen
    python gig_bot.py check    Reddit-Zugriff + Benachrichtigung testen
    python gig_bot.py pair     QR-Code zum Koppeln der Handy-App zeigen
    python gig_bot.py test     nur Test-Benachrichtigung ans Handy
    python gig_bot.py status   gefundene Giveaways anzeigen
"""

import os
import sys

if sys.version_info < (3, 11):
    sys.exit("Gig braucht Python 3.11 oder neuer: https://www.python.org/downloads/")

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from gig.cli import main  # noqa: E402

if __name__ == "__main__":
    sys.exit(main())
