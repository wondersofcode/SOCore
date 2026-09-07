"""
Response actions.

Two low-level actions the playbooks call:
  - notify Slack (runs automatically, no approval needed)
  - block an IP (runs only after human approval, and only in dry-run until a
    real firewall is attached)

Both are safe to call without configuration: Slack is skipped if no webhook is
set, and the blocker always logs instead of touching a real device.
"""
from __future__ import annotations

import logging
import os

logger = logging.getLogger("socore.actions")


def send_slack_alert(message: str) -> dict:
    """Post a message to the configured Slack incoming webhook."""
    webhook = os.environ.get("SLACK_WEBHOOK_URL", "").strip()
    if not webhook:
        logger.info("[slack] no webhook configured, skipping: %s", message)
        return {"status": "skipped", "reason": "no SLACK_WEBHOOK_URL"}
    try:
        import requests
        resp = requests.post(webhook, json={"text": message}, timeout=5)
        ok = resp.status_code == 200
        return {"status": "sent" if ok else "error", "code": resp.status_code}
    except Exception as exc:  # network, timeout, etc.
        logger.warning("[slack] failed: %s", exc)
        return {"status": "error", "reason": str(exc)}


def block_ip(ip: str, dry_run: bool = True) -> dict:
    """
    Block an IP. While no firewall is attached this only logs the intent, which
    is enough to demonstrate the response step end to end.
    """
    if dry_run:
        logger.info("[firewall][DRY-RUN] would block %s", ip)
        return {"status": "simulated", "ip": ip}
    # Real integration would go here (pfSense API, iptables, etc.).
    logger.info("[firewall] blocking %s", ip)
    return {"status": "blocked", "ip": ip}
