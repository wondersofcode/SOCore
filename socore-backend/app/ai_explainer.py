"""
AI explanation layer.

Given a scored alert, produce a short plain-language reason an analyst can read
before deciding. Uses Google Gemini when GEMINI_API_KEY is set; otherwise falls
back to a deterministic template so the whole system still runs (and demos)
without a key.

Swapping in the real key later needs no code change — just set the env var.
"""
from __future__ import annotations

import logging
import os

from .models import Alert

logger = logging.getLogger("socore.ai_explainer")

_SYSTEM_PROMPT = (
    "You are a SOC analyst assistant. In 2-3 sentences, plain English, explain "
    "why this security alert is or isn't a real threat, based only on the data "
    "given. No preamble, no bullet points, no markdown. Write for a tier-1 "
    "analyst deciding whether to act."
)


def _mock_explanation(alert: Alert) -> str:
    """Deterministic fallback used when no API key is configured."""
    rep = max(alert.vtScore, alert.abuseScore)
    if alert.country == "INTERNAL":
        origin = ("The source is an internal address, so reputation feeds add nothing "
                  "and the signal rests on the observed behaviour.")
    elif rep >= 70:
        origin = (f"The source is flagged by threat intelligence with confidence {rep}, "
                  "which raises the weight of this detection considerably.")
    elif rep > 0:
        origin = (f"Threat intelligence returns a low confidence of {rep}, so the "
                  "detection rests mainly on the observed behaviour.")
    else:
        origin = ("Threat intelligence has no record of this address, so the detection "
                  "rests entirely on the observed behaviour.")
    threshold = "above" if alert.riskScore > 70 else "below"
    return (
        f"Activity matching {alert.mitreName} ({alert.mitreId}) was observed from "
        f"{alert.sourceIP}. {origin} The correlation engine scored this at "
        f"{alert.riskScore}, which is {threshold} the automatic-response threshold."
    )


def _gemini_explanation(alert: Alert, api_key: str) -> str:
    """Call Gemini. Any failure falls back to the template so nothing 500s."""
    try:
        import google.generativeai as genai
    except ImportError:
        return _mock_explanation(alert)

    facts = (
        f"Attack type: {alert.attackType}\n"
        f"MITRE: {alert.mitreId} {alert.mitreName}\n"
        f"Severity: {alert.severity.value}\n"
        f"Source IP: {alert.sourceIP} ({alert.country or 'unknown origin'}, {alert.asn or 'unknown ASN'})\n"
        f"VirusTotal score: {alert.vtScore}/100\n"
        f"AbuseIPDB confidence: {alert.abuseScore}%\n"
        f"Correlation risk score: {alert.riskScore}/100\n"
        f"Raw log:\n{alert.raw[:800]}"
    )
    try:
        genai.configure(api_key=api_key)
        model = genai.GenerativeModel("gemini-3.6-flash", system_instruction=_SYSTEM_PROMPT)
        resp = model.generate_content(facts)
        text = (resp.text or "").strip()
        return text or _mock_explanation(alert)
    except Exception as exc:
        # Rate limits, network, bad key, a retired model name — never break
        # the pipeline over this, but do log it: is_live() only checks that a
        # key is set, not that calls are actually succeeding, so a silent
        # fallback here is otherwise invisible from the API/dashboard.
        logger.warning("Gemini call failed, falling back to template: %s", exc)
        return _mock_explanation(alert)


def explain(alert: Alert) -> str:
    key = os.environ.get("GEMINI_API_KEY", "").strip()
    if key:
        return _gemini_explanation(alert, key)
    return _mock_explanation(alert)


def is_live() -> bool:
    """Lets the API report whether real AI is wired up, for the dashboard badge."""
    return bool(os.environ.get("GEMINI_API_KEY", "").strip())
