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
from .models import Alert, Case, DecisionRecord
from .timeutils import parse_timestamp

logger = logging.getLogger("socore.shift_summary")

_CACHE_TTL_SECONDS = 300
_cache: dict[int, tuple[float, str]] = {}  # windowHours -> (cached_at, summary)

_SYSTEM_INSTRUCTIONS = (
    "You write a short shift-handover summary for a SOC (Security Operations "
    "Center) analyst, based only on the JSON facts given. 3-4 sentences, plain "
    "English, no markdown, no preamble — mention the alert count, the severity "
    "breakdown, the most common source country if there is one, and how many "
    "cases were opened. If a number is zero, say so plainly rather than skipping it. "
    "severityCounts' keys are SOCore's exact severity tiers: Critical, High, "
    "Medium, Low, Informational. Refer to each tier only by its own name plus "
    "the word 'severity' (e.g. 'high severity', 'medium severity') — never call "
    "a High-severity alert 'critical', and never describe any tier as critical "
    "unless it is literally counted under the 'Critical' key."
)


def windowed_alerts(alerts: list[Alert], hours: int) -> list[Alert]:
    cutoff = datetime.now(timezone.utc).timestamp() - hours * 3600
    return [a for a in alerts if (dt := parse_timestamp(a.timestamp)) and dt.timestamp() >= cutoff]


def windowed_cases(cases: list[Case], hours: int) -> list[Case]:
    cutoff = datetime.now(timezone.utc).timestamp() - hours * 3600
    return [c for c in cases if (dt := parse_timestamp(c.createdAt)) and dt.timestamp() >= cutoff]


def windowed_decision_count(decisions: list[DecisionRecord], windowed_alert_ids: set[str]) -> int:
    """Decisions don't carry a full date (DecisionRecord.at is a bare
    'HH:MM:SS'), so — same convention report_export.py's Decisions sheet
    already uses — a decision is 'in the window' iff the alert it was made
    on is, not by parsing its own timestamp."""
    return sum(1 for d in decisions if d.alertId in windowed_alert_ids)


def _facts(alerts: list[Alert], cases: list[Case], decisions: list[DecisionRecord], hours: int) -> dict:
    windowed = windowed_alerts(alerts, hours)
    opened_cases = windowed_cases(cases, hours)
    windowed_ids = {a.id for a in windowed}

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
        "decisionCount": windowed_decision_count(decisions, windowed_ids),
        "avgRiskScore": round(sum(a.riskScore for a in windowed) / len(windowed), 1) if windowed else 0,
    }


_SEVERITY_ORDER = ["Critical", "High", "Medium", "Low", "Informational"]


def _severity_breakdown_phrase(severity_counts: dict) -> str:
    """'<n> classified as <tier> severity[, ...] and <n> as <tier> severity' —
    using SOCore's real severity tiers exactly as scored (Critical/High/
    Medium/Low/Informational). A High-severity alert is never described as
    critical, and vice versa — each tier only ever gets its own name."""
    present = [(tier, severity_counts[tier]) for tier in _SEVERITY_ORDER if severity_counts.get(tier)]
    if not present:
        return ""
    phrases = [
        f"{count} classified as {tier.lower()} severity" if i == 0 else f"{count} as {tier.lower()} severity"
        for i, (tier, count) in enumerate(present)
    ]
    if len(phrases) == 1:
        return phrases[0]
    return ", ".join(phrases[:-1]) + " and " + phrases[-1]


def _mock_summary(facts: dict) -> str:
    """Deterministic fallback when no Groq key is configured."""
    n = facts["alertCount"]
    if n == 0:
        return f"No alerts were recorded in the last {facts['windowHours']} hours. {facts['casesOpened']} case(s) were opened in this window."
    breakdown = _severity_breakdown_phrase(facts["severityCounts"])
    severity_clause = f", with {breakdown}" if breakdown else ""
    country = f", most from {facts['topSourceCountry']}" if facts["topSourceCountry"] else ""
    return (
        f"{n} alert(s) were recorded over the last {facts['windowHours']} hours{severity_clause}{country}. "
        f"Average risk score was {facts['avgRiskScore']}. {facts['casesOpened']} case(s) were opened in this window."
    )


def get_summary(
    alerts: list[Alert],
    cases: list[Case],
    decisions: list[DecisionRecord],
    hours: int,
    force_refresh: bool = False,
) -> tuple[str, bool, int, int]:
    """Returns (summary, was_cached, alertCount, decisionCount)."""
    now = time.time()
    # Cheap (no Groq call) — always recomputed so alertCount/decisionCount
    # stay accurate even when the cached summary text is reused below.
    facts = _facts(alerts, cases, decisions, hours)

    cached = _cache.get(hours)
    if not force_refresh and cached and now - cached[0] < _CACHE_TTL_SECONDS:
        return cached[1], True, facts["alertCount"], facts["decisionCount"]

    messages = [
        {"role": "system", "content": _SYSTEM_INSTRUCTIONS},
        {"role": "user", "content": json.dumps(facts, separators=(",", ":"))},
    ]
    summary = groq_client.chat(messages, max_tokens=300) or _mock_summary(facts)
    _cache[hours] = (now, summary)
    return summary, False, facts["alertCount"], facts["decisionCount"]
