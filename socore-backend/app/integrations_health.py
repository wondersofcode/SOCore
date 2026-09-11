"""
Real connectivity checks for the tools SOCore integrates with — backs the
Settings page's "Pipeline connections" list, which used to hardcode most of
these as always-connected regardless of whether the service was actually up.

The backend runs on the same VM as every one of these containers, so a fast
local TCP connect to each service's published port is a cheap, honest proxy
for "is this reachable" — no credentials needed, no risk of spamming a
webhook just to check it's configured.
"""
from __future__ import annotations

import os
import socket

_HOST = "127.0.0.1"
# Same VM IP already referenced in Settings.tsx's integration endpoint list.
PUBLIC_HOST = os.environ.get("PUBLIC_HOST", "35.238.92.96").strip()


def _port_open(port: int, timeout: float = 0.6) -> bool:
    try:
        with socket.create_connection((_HOST, port), timeout=timeout):
            return True
    except OSError:
        return False


def check() -> dict:
    return {
        "wazuh": {
            "connected": _port_open(5601) or _port_open(1515),
            "url": f"https://{PUBLIC_HOST}:5601",
        },
        "misp": {
            "connected": _port_open(8443),
            "url": f"https://{PUBLIC_HOST}:8443",
        },
        "cortex": {
            "connected": _port_open(9001),
            "url": f"http://{PUBLIC_HOST}:9001",
        },
        "shuffle": {
            "connected": _port_open(3001),
            "url": f"http://{PUBLIC_HOST}:3001",
        },
        "slack": {
            # No dashboard to open, and pinging a webhook would post a real
            # message — "configured" (a URL is set) is the honest signal here.
            "connected": bool(os.environ.get("SLACK_WEBHOOK_URL", "").strip()),
            "url": None,
        },
    }
