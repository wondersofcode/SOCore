"""Create a case/ticket in TheHive from a SOC alert.

Usage:
    python ticket_creator.py --title "Brute force" --description "..." --severity 3 --tags brute-force ssh
"""
import argparse
import sys

import requests

from config import THEHIVE_API_KEY, THEHIVE_URL


def create_ticket(title, description, severity=2, tags=None):
    if not THEHIVE_URL or not THEHIVE_API_KEY:
        print("THEHIVE_URL / THEHIVE_API_KEY boşdur. 🔴 TODO-DOLDUR: .env faylında doldur.", file=sys.stderr)
        return None

    payload = {
        "title": title,
        "description": description,
        "severity": severity,  # 1=low 2=medium 3=high 4=critical
        "tags": tags or [],
        "tlp": 2,
        "pap": 2,
    }
    headers = {"Authorization": f"Bearer {THEHIVE_API_KEY}"}

    resp = requests.post(f"{THEHIVE_URL}/api/v1/case", json=payload, headers=headers, timeout=10)
    resp.raise_for_status()
    case = resp.json()
    print(f"Ticket yaradıldı: {case.get('_id', case)}")
    return case


def main():
    parser = argparse.ArgumentParser(description="SOCore TheHive ticket creator")
    parser.add_argument("--title", required=True)
    parser.add_argument("--description", required=True)
    parser.add_argument("--severity", type=int, default=2, choices=[1, 2, 3, 4])
    parser.add_argument("--tags", nargs="*", default=[])
    args = parser.parse_args()

    result = create_ticket(args.title, args.description, args.severity, args.tags)
    sys.exit(0 if result else 1)


if __name__ == "__main__":
    main()
