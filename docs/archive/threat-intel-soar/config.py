"""Shared config loader for threat-intel-soar scripts. Reads the repo-root .env."""
import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

MISP_URL = os.getenv("MISP_URL", "")
MISP_API_KEY = os.getenv("MISP_API_KEY", "")  # 🔴 TODO-DOLDUR: .env faylında doldur
MISP_VERIFY_SSL = os.getenv("MISP_VERIFY_SSL", "false").lower() == "true"

CORTEX_URL = os.getenv("CORTEX_URL", "")
CORTEX_API_KEY = os.getenv("CORTEX_API_KEY", "")  # 🔴 TODO-DOLDUR: .env faylında doldur

THEHIVE_URL = os.getenv("THEHIVE_URL", "")
THEHIVE_API_KEY = os.getenv("THEHIVE_API_KEY", "")  # 🔴 TODO-DOLDUR: .env faylında doldur

SHUFFLE_URL = os.getenv("SHUFFLE_URL", "")
SHUFFLE_API_KEY = os.getenv("SHUFFLE_API_KEY", "")  # 🔴 TODO-DOLDUR: .env faylında doldur

SLACK_WEBHOOK_URL = os.getenv("SLACK_WEBHOOK_URL", "")  # 🔴 TODO-DOLDUR: .env faylında doldur

VIRUSTOTAL_API_KEY = os.getenv("VIRUSTOTAL_API_KEY", "")  # 🔴 TODO-DOLDUR: .env faylında doldur
ABUSEIPDB_API_KEY = os.getenv("ABUSEIPDB_API_KEY", "")  # 🔴 TODO-DOLDUR: .env faylında doldur

FIREWALL_DRY_RUN = os.getenv("FIREWALL_DRY_RUN", "true").lower() != "false"
