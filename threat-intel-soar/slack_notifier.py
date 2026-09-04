"""Send SOC alert notifications to Slack via an Incoming Webhook.

Usage:
    python slack_notifier.py --title "Suspicious login" --message "IP 1.2.3.4 from RU" --severity high
"""
import argparse
import sys

import requests

from config import SLACK_WEBHOOK_URL

SEVERITY_COLORS = {
    "low": "#36a64f",
    "medium": "#f2c744",
    "high": "#e01e5a",
    "critical": "#8b0000",
}


def send_alert(title, message, severity="medium"):
    if not SLACK_WEBHOOK_URL:
        print("SLACK_WEBHOOK_URL boşdur. 🔴 TODO-DOLDUR: .env faylında doldur.", file=sys.stderr)
        return False

    payload = {
        "attachments": [
            {
                "color": SEVERITY_COLORS.get(severity, "#f2c744"),
                "title": f"[{severity.upper()}] {title}",
                "text": message,
            }
        ]
    }

    resp = requests.post(SLACK_WEBHOOK_URL, json=payload, timeout=10)
    resp.raise_for_status()
    return True


def main():
    parser = argparse.ArgumentParser(description="SOCore Slack notifier")
    parser.add_argument("--title", required=True)
    parser.add_argument("--message", required=True)
    parser.add_argument("--severity", default="medium", choices=list(SEVERITY_COLORS))
    args = parser.parse_args()

    ok = send_alert(args.title, args.message, args.severity)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
