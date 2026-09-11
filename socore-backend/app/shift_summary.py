"""
Shift summary report — asks Groq for a short natural-language recap of the
last N hours (alerts, their severities/origins, cases opened), backed by a
5-minute in-memory cache so opening the Reports page repeatedly doesn't
re-call Groq every time.
"""
from __future__ import annotations

import json
import logging
import time
from collections import Counter
from datetime import datetime, timezone

from . import groq_client
from .models import Alert, Case

logger = logging.getLogger("socore.shift_summary")

_CACHE_TTL_SECONDS = 300
_cache: dict[int, tuple[float, str]] = {}  # windowHours -> (cached_at, summary)

_SYSTEM_INSTRUCTIONS = (
    "You write a short shift-handover summary for a SOC (Security Operations "
    "Center) analyst, based only on the JSON facts given. 3-4 sentences, plain "
    "English, no markdown, no preamble — mention the alert count, how many were "
    "critical, the most common source country if there is one, and how many "
    "cases were opened. If a number is zero, say so plainly rather than skipping it."
)


def parse_naive_utc(ts: str) -> datetime | None:
    """Alert.timestamp is 'YYYY-MM-DD HH:MM:SS', implicitly UTC, no marker."""
    if not ts:
        return None
    try:
        return datetime.strptime(ts, "%Y-%m-%d %H:%M:%S").replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def parse_iso(ts: str) -> datetime | None:
    if not ts:
        return None
    try:
        dt = datetime.fromisoformat(ts)
        return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def windowed_alerts(alerts: list[Alert], hours: int) -> list[Alert]:
    cutoff = datetime.now(timezone.utc).timestamp() - hours * 3600
    return [a for a in alerts if (dt := parse_naive_utc(a.timestamp)) and dt.timestamp() >= cutoff]


def windowed_cases(cases: list[Case], hours: int) -> list[Case]:
    cutoff = datetime.now(timezone.utc).timestamp() - hours * 3600
    return [c for c in cases if (dt := parse_iso(c.createdAt)) and dt.timestamp() >= cutoff]


def _facts(alerts: list[Alert], cases: list[Case], hours: int) -> dict:
    windowed = windowed_alerts(alerts, hours)
    opened_cases = windowed_cases(cases, hours)

    severity_counts = Counter(a.severity.value for a in windowed)
    country_counts = Counter(a.country for a in windowed if a.country and a.country != "INTERNAL")
    top_country = country_counts.most_common(1)[0][0] if country_counts else None
    attack_type_counts = Counter(a.attackType for a in windowed)

    return {
        "windowHours": hours,
        "alertCount": len(windowed),
        "severityCounts": dict(severity_counts),
        "topSourceCountry": top_country,
        "topAttackTypes": [t for t, _ in attack_type_counts.most_common(3)],
        "casesOpened": len(opened_cases),
        "avgRiskScore": round(sum(a.riskScore for a in windowed) / len(windowed), 1) if windowed else 0,
    }


def _mock_summary(facts: dict) -> str:
    """Deterministic fallback when no Groq key is configured."""
    n = facts["alertCount"]
    if n == 0:
        return f"No alerts were recorded in the last {facts['windowHours']} hours. {facts['casesOpened']} case(s) were opened in this window."
    critical = facts["severityCounts"].get("Critical", 0)
    country = f", most from {facts['topSourceCountry']}" if facts["topSourceCountry"] else ""
    return (
        f"{n} alert(s) came in over the last {facts['windowHours']} hours, {critical} of them critical{country}. "
        f"Average risk score was {facts['avgRiskScore']}. {facts['casesOpened']} case(s) were opened in this window."
    )


def get_summary(alerts: list[Alert], cases: list[Case], hours: int, force_refresh: bool = False) -> tuple[str, bool, int]:
    """Returns (summary, was_cached, alertCount)."""
    now = time.time()
    facts = _facts(alerts, cases, hours)  # cheap (no Groq call) — always recomputed for an accurate alertCount

    cached = _cache.get(hours)
    if not force_refresh and cached and now - cached[0] < _CACHE_TTL_SECONDS:
        return cached[1], True, facts["alertCount"]

    messages = [
        {"role": "system", "content": _SYSTEM_INSTRUCTIONS},
        {"role": "user", "content": json.dumps(facts, separators=(",", ":"))},
    ]
    summary = groq_client.chat(messages, max_tokens=300) or _mock_summary(facts)
    _cache[hours] = (now, summary)
    return summary, False, facts["alertCount"]
