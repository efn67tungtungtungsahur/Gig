"""CI-Hilfe: wartet, bis im ntfy-Testkanal eine passende Nachricht ankommt.

    python wait_ntfy.py <kanal> <regex> <sekunden>
"""
import json
import re
import sys
import time
import urllib.request

topic, pattern, timeout = sys.argv[1], sys.argv[2], float(sys.argv[3])
deadline = time.time() + timeout
seen = set()
while time.time() < deadline:
    try:
        with urllib.request.urlopen(f"https://ntfy.sh/{topic}/json?poll=1&since=all", timeout=20) as resp:
            for line in resp.read().decode("utf-8").splitlines():
                msg = json.loads(line)
                if msg.get("event") != "message" or msg["id"] in seen:
                    continue
                seen.add(msg["id"])
                text = f"{msg.get('title', '')} | {msg.get('message', '')}"
                print("ntfy:", text, flush=True)
                if re.search(pattern, text):
                    sys.exit(0)
    except Exception as e:  # noqa: BLE001
        print("Abfrage fehlgeschlagen:", e, flush=True)
    time.sleep(5)
print("Keine passende Nachricht angekommen.")
sys.exit(1)
