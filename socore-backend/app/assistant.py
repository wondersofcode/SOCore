"""
AI assistant chat — answers an analyst's question about the current SOC
state (alerts, cases, pending approvals) using Groq, grounded in a compact
JSON snapshot of real data so it can't invent alerts or numbers.
"""
from __future__ import annotations

import json
import logging

from . import groq_client
from .models import Alert, Case, ChatMessage

logger = logging.getLogger("socore.assistant")

_SYSTEM_INSTRUCTIONS = (
    "You are the AI assistant embedded in SOCore, a SOC (Security Operations "
    "Center) dashboard. Answer the analyst's question using ONLY the JSON data "
    "given below as context — never invent alerts, cases, IPs, or numbers that "
    "aren't in it. If the data doesn't contain what's needed to answer, say so "
    "plainly instead of guessing. Keep answers short (2-4 sentences), factual, "
    "and written for a SOC analyst — no markdown, no preamble."
)


def _alert_summary(a: Alert) -> dict:
    return {
        "id": a.id,
        "timestamp": a.timestamp,
        "severity": a.severity.value,
        "riskScore": a.riskScore,
        "attackType": a.attackType,
        "mitreId": a.mitreId,
        "sourceIP": a.sourceIP,
        "country": a.country,
        "status": a.status.value,
        "approvalStatus": a.approvalStatus.value,
        "analyst": a.analyst,
    }


def _case_summary(c: Case) -> dict:
    return {
        "id": c.id,
        "title": c.title,
        "severity": c.severity.value,
        "status": c.status.value,
        "assignedTo": c.assignedTo,
        "alertCount": c.alertCount,
    }


def build_context(alerts: list[Alert], cases: list[Case], pending: list[Alert]) -> str:
    """Compact JSON snapshot of current real data, capped so it stays cheap."""
    recent_alerts = [_alert_summary(a) for a in alerts[:50]]
    open_cases = [_case_summary(c) for c in cases if c.status.value != "Closed"][:30]
    pending_alerts = [_alert_summary(a) for a in pending[:30]]
    payload = {
        "recentAlerts": recent_alerts,
        "openCases": open_cases,
        "pendingApprovals": pending_alerts,
        "counts": {
            "recentAlerts": len(recent_alerts),
            "openCases": len(open_cases),
            "pendingApprovals": len(pending_alerts),
        },
    }
    return json.dumps(payload, separators=(",", ":"))


def _mock_reply(message: str, alerts: list[Alert], pending: list[Alert]) -> str:
    """Deterministic fallback when no Groq key is configured — still answers
    from the real data, just without free-form language generation."""
    q = message.lower()
    if "risk" in q and alerts:
        top = max(alerts, key=lambda a: a.riskScore)
        return (
            f"The highest-risk alert right now is {top.id}: {top.attackType} "
            f"from {top.sourceIP}, risk score {top.riskScore} ({top.severity.value})."
        )
    if "pending" in q or "approval" in q:
        return f"There are {len(pending)} alert(s) awaiting approval right now."
    if not alerts:
        return "No alert data is available right now."
    return (
        f"There are {len(alerts)} recent alert(s) and {len(pending)} pending "
        "approval(s) in the current data. Ask about risk, severity, or pending "
        "approvals for specifics — AI explanations are running in fallback mode "
        "right now (no GROQ_API_KEY set)."
    )


def chat(
    message: str,
    history: list[ChatMessage],
    alerts: list[Alert],
    cases: list[Case],
    pending: list[Alert],
) -> str:
    context_json = build_context(alerts, cases, pending)
    system = f"{_SYSTEM_INSTRUCTIONS}\n\nCurrent SOCore data (JSON):\n{context_json}"
    messages = [{"role": "system", "content": system}]
    for m in history[-10:]:  # cap history so the prompt doesn't grow unbounded
        if m.role in ("user", "assistant") and m.content:
            messages.append({"role": m.role, "content": m.content})
    messages.append({"role": "user", "content": message})

    reply = groq_client.chat(messages)
    if reply:
        return reply
    logger.info("Assistant chat falling back to mock reply (no Groq key or call failed)")
    return _mock_reply(message, alerts, pending)
