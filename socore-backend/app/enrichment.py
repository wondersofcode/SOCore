"""
Live enrichment: MISP + Cortex + Shuffle.

This is the part of the pipeline that turns a bare Wazuh event into something
backed by real threat intelligence, instead of the vt_score/abuse_score the
event may already carry. All three integrations are optional and best-effort:
if a service isn't configured or doesn't answer in time, enrichment is simply
skipped and the alert falls back to whatever scores it already had (0 if
none). A slow or dead MISP/Cortex/Shuffle should never block an incoming
Wazuh alert.

Env vars (see .env.example):
  MISP_URL, MISP_API_KEY, MISP_VERIFY_SSL
  CORTEX_URL, CORTEX_API_KEY
  SHUFFLE_URL, SHUFFLE_API_KEY, SHUFFLE_WEBHOOK_URL
"""
from __future__ import annotations

import logging
import os
import time

import requests

logger = logging.getLogger("socore.enrichment")

# Keep the total added latency on /api/ingest bounded — Wazuh is waiting on
# this request, so enrichment gets a hard budget rather than running forever.
CORTEX_POLL_TIMEOUT_S = 8
CORTEX_POLL_INTERVAL_S = 1
HTTP_TIMEOUT_S = 4


def _misp_config():
    url = os.environ.get("MISP_URL", "").strip().rstrip("/")
    key = os.environ.get("MISP_API_KEY", "").strip()
    verify = os.environ.get("MISP_VERIFY_SSL", "false").strip().lower() == "true"
    return url, key, verify


def _cortex_config():
    url = os.environ.get("CORTEX_URL", "").strip().rstrip("/")
    key = os.environ.get("CORTEX_API_KEY", "").strip()
    return url, key


def _shuffle_config():
    webhook = os.environ.get("SHUFFLE_WEBHOOK_URL", "").strip()
    return webhook


def is_misp_configured() -> bool:
    url, key, _ = _misp_config()
    return bool(url and key)


def is_cortex_configured() -> bool:
    url, key = _cortex_config()
    return bool(url and key)


def is_shuffle_configured() -> bool:
    return bool(_shuffle_config())


# ── MISP ─────────────────────────────────────────────────────────────────────
def misp_lookup_ip(ip: str) -> dict:
    """
    Search MISP for the IP as a known indicator. Returns
    {"hit": bool, "event_count": int} — best-effort, never raises.
    """
    url, key, verify = _misp_config()
    if not url or not key:
        return {"hit": False, "event_count": 0, "skipped": True}

    try:
        resp = requests.post(
            f"{url}/attributes/restSearch",
            headers={"Authorization": key, "Accept": "application/json", "Content-Type": "application/json"},
            json={"returnFormat": "json", "value": ip},
            verify=verify,
            timeout=HTTP_TIMEOUT_S,
        )
        resp.raise_for_status()
        data = resp.json()
        attrs = data.get("response", {}).get("Attribute", [])
        return {"hit": len(attrs) > 0, "event_count": len(attrs), "skipped": False}
    except Exception as exc:
        logger.warning("MISP lookup failed for %s: %s", ip, exc)
        return {"hit": False, "event_count": 0, "skipped": False, "error": str(exc)}


# ── Cortex ───────────────────────────────────────────────────────────────────
def _cortex_headers(key: str) -> dict:
    return {"Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def _cortex_run_analyzer(base_url: str, key: str, analyzer_id: str, ip: str) -> str | None:
    try:
        resp = requests.post(
            f"{base_url}/api/analyzer/{analyzer_id}/run",
            headers=_cortex_headers(key),
            json={"data": ip, "dataType": "ip", "tlp": 2, "message": "SOCore auto-enrichment"},
            timeout=HTTP_TIMEOUT_S,
        )
        resp.raise_for_status()
        return resp.json().get("id")
    except Exception as exc:
        logger.warning("Cortex analyzer %s failed to start for %s: %s", analyzer_id, ip, exc)
        return None


def _cortex_poll_job(base_url: str, key: str, job_id: str) -> dict | None:
    deadline = time.monotonic() + CORTEX_POLL_TIMEOUT_S
    while time.monotonic() < deadline:
        try:
            resp = requests.get(
                f"{base_url}/api/job/{job_id}/report",
                headers=_cortex_headers(key),
                timeout=HTTP_TIMEOUT_S,
            )
            resp.raise_for_status()
            job = resp.json()
            if job.get("status") in ("Success", "Failure"):
                return job
        except Exception as exc:
            logger.warning("Cortex job %s poll failed: %s", job_id, exc)
            return None
        time.sleep(CORTEX_POLL_INTERVAL_S)
    return None  # timed out — Cortex is slow or overloaded, don't block the caller


def _score_from_report(job: dict | None, namespace: str, predicate: str) -> int:
    """
    Extract a 0-100 score from the ONE taxonomy line that actually reports
    risk (identified by namespace+predicate), ignoring every other line the
    analyzer returns. Cortex reports mix a real verdict with purely
    informational lines (e.g. VT's passive-DNS resolution count, AbuseIPDB's
    whitelist flag and historical report count) that happen to carry their
    own "level" — taking the worst level across ALL of them turns those
    informational lines into false risk signals.

      VirusTotal (namespace "VT", predicate "GetReport"): value is "X/Y",
      the count of AV engines that flagged it out of the total — score is
      X/Y scaled to 0-100.

      AbuseIPDB (namespace "AbuseIPDB", predicate "Score"): value is
      already the 0-100 abuse confidence score.
    """
    if not job or job.get("status") != "Success":
        return 0
    taxonomies = job.get("report", {}).get("summary", {}).get("taxonomies", [])
    for t in taxonomies:
        if t.get("namespace") != namespace or t.get("predicate") != predicate:
            continue
        value = t.get("value")
        if isinstance(value, str) and "/" in value:
            hits, total = value.split("/", 1)
            try:
                hits, total = float(hits), float(total)
                return round(hits / total * 100) if total else 0
            except ValueError:
                break
        if isinstance(value, (int, float)):
            return int(value)
        break
    return 0


def cortex_analyze_ip(ip: str) -> dict:
    """
    Run the VirusTotal and AbuseIPDB analyzers against an IP.
    Returns {"vt_score": int, "abuse_score": int, "skipped": bool, "ok": bool, "error": str|None}.

    "skipped" means Cortex isn't configured at all (no URL/key set).
    "ok": False with an "error" means Cortex WAS called but the call failed
    (bad key, insufficient permissions, timeout, etc.) — this must never be
    reported as a successful analysis. A 403 is not a clean scan.
    """
    base_url, key = _cortex_config()
    if not base_url or not key:
        return {"vt_score": 0, "abuse_score": 0, "skipped": True, "ok": False, "error": None}

    try:
        resp = requests.get(f"{base_url}/api/analyzer/type/ip", headers=_cortex_headers(key), timeout=HTTP_TIMEOUT_S)
        resp.raise_for_status()
        analyzers = resp.json()
    except Exception as exc:
        logger.warning("Cortex analyzer list failed: %s", exc)
        return {"vt_score": 0, "abuse_score": 0, "skipped": False, "ok": False, "error": str(exc)}

    vt_id = next((a["id"] for a in analyzers if "virustotal" in a.get("name", "").lower()), None)
    abuse_id = next((a["id"] for a in analyzers if "abuseipdb" in a.get("name", "").lower()), None)

    if not vt_id and not abuse_id:
        return {
            "vt_score": 0, "abuse_score": 0, "skipped": False, "ok": False,
            "error": "Cortex reachable but no VirusTotal/AbuseIPDB analyzer is enabled for this organization",
        }

    vt_score = 0
    abuse_score = 0
    ran_any = False

    if vt_id:
        job_id = _cortex_run_analyzer(base_url, key, vt_id, ip)
        if job_id:
            ran_any = True
            vt_score = _score_from_report(_cortex_poll_job(base_url, key, job_id), "VT", "GetReport")

    if abuse_id:
        job_id = _cortex_run_analyzer(base_url, key, abuse_id, ip)
        if job_id:
            ran_any = True
            abuse_score = _score_from_report(_cortex_poll_job(base_url, key, job_id), "AbuseIPDB", "Score")

    if not ran_any:
        return {
            "vt_score": 0, "abuse_score": 0, "skipped": False, "ok": False,
            "error": "Analyzer(s) found but failed to start a job (check the org's API permissions)",
        }

    return {"vt_score": vt_score, "abuse_score": abuse_score, "skipped": False, "ok": True, "error": None}


# ── Shuffle ──────────────────────────────────────────────────────────────────
def shuffle_trigger(alert: dict) -> dict:
    """
    Fire the configured Shuffle workflow webhook with the alert payload.
    Requires SHUFFLE_WEBHOOK_URL — the per-workflow webhook URL Shuffle shows
    you when you add a Webhook trigger node, not the base SHUFFLE_URL.
    """
    webhook = _shuffle_config()
    if not webhook:
        logger.info("Shuffle webhook not configured, skipping trigger for %s", alert.get("id"))
        return {"status": "skipped", "reason": "no SHUFFLE_WEBHOOK_URL"}
    try:
        resp = requests.post(webhook, json=alert, timeout=HTTP_TIMEOUT_S)
        return {"status": "sent" if resp.status_code < 300 else "error", "code": resp.status_code}
    except Exception as exc:
        logger.warning("Shuffle trigger failed: %s", exc)
        return {"status": "error", "reason": str(exc)}


# ── Orchestration ────────────────────────────────────────────────────────────
def enrich_ip(ip: str, internal: bool) -> dict:
    """
    Run MISP + Cortex for an external IP and return the scores the
    correlation engine expects, plus enough detail for each source's status
    to be reported honestly (configured-and-clean vs configured-but-failing
    vs not-configured are three different things and must not collapse into
    one "worked" state).
    """
    result = {
        "vt_score": 0, "abuse_score": 0,
        "misp_hit": False, "misp_skipped": True, "misp_error": None,
        "cortex_skipped": True, "cortex_ok": False, "cortex_error": None,
    }

    misp_boost = 0
    if not internal and is_misp_configured():
        misp = misp_lookup_ip(ip)
        result["misp_hit"] = misp.get("hit", False)
        result["misp_skipped"] = misp.get("skipped", True)
        result["misp_error"] = misp.get("error")
        # A MISP hit is a strong external signal in its own right — it feeds
        # the overall abuse_score used for risk scoring, but it is NOT a
        # Cortex/AbuseIPDB result and must be reported under MISP, not Cortex.
        if result["misp_hit"]:
            misp_boost = 85

    # A private/RFC1918 address has no meaningful VirusTotal/AbuseIPDB
    # reputation, so asking Cortex about one is both pointless and slow —
    # cortex_analyze_ip() polls each analyzer for up to CORTEX_POLL_TIMEOUT_S,
    # so this alone can add ~10-16s to every internal-IP alert (the common
    # case with a single lab agent), which is long enough to defeat a
    # sub-minute dedup window in the Wazuh integration script that calls
    # this synchronously.
    if not internal and is_cortex_configured():
        cortex = cortex_analyze_ip(ip)
        result["cortex_skipped"] = cortex.get("skipped", True)
        result["cortex_ok"] = cortex.get("ok", False)
        result["cortex_error"] = cortex.get("error")
        if result["cortex_ok"]:
            result["vt_score"] = cortex.get("vt_score", 0)
            result["abuse_score"] = cortex.get("abuse_score", 0)

    # The combined score used for risk scoring can reflect both signals...
    result["combined_abuse_score"] = max(result["abuse_score"], misp_boost)
    return result
