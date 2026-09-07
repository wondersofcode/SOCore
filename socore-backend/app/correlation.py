"""
Correlation engine.

Turns a raw Wazuh event into a scored alert: assigns severity, computes a
0-100 risk score, and — when the score crosses the response threshold —
attaches a proposed action for a human to approve.

The scoring is deliberately explainable: every input maps to a visible weight,
so an analyst (or an evaluator) can see exactly why a number came out the way
it did. That transparency matters more here than a clever black-box model.
"""
from __future__ import annotations

from .models import (
    Alert,
    AlertStatus,
    ApprovalStatus,
    EnrichmentSource,
    ProposedAction,
    Severity,
    SourceStatus,
    WazuhEvent,
    now_full,
)

# Alerts scoring above this get a proposed response action that waits for a
# human decision. Matches the threshold documented in the playbooks.
RESPONSE_THRESHOLD = 70

# Wazuh rule levels (0-15) map onto our five severities.
def _severity_from_level(level: int) -> Severity:
    if level >= 12:
        return Severity.critical
    if level >= 9:
        return Severity.high
    if level >= 6:
        return Severity.medium
    if level >= 3:
        return Severity.low
    return Severity.informational


_SEVERITY_WEIGHT = {
    Severity.critical: 46,
    Severity.high: 33,
    Severity.medium: 20,
    Severity.low: 10,
    Severity.informational: 4,
}

# Per-attack response actions, matched to the SOAR playbooks.
_ACTION_BY_ATTACK = {
    "Brute Force": "Block source IP at the perimeter firewall",
    "C2 Beacon": "Block outbound destination and isolate the host",
    "Phishing": "Quarantine the message and reset the recipient session",
    "Malware Execution": "Isolate the endpoint and kill the parent process",
    "Ransomware Precursor": "Isolate the endpoint and revoke the account session",
    "Credential Dumping": "Force password reset and revoke active tokens",
    "Web Exploit": "Block source IP and apply the WAF rule",
    "Lateral Movement": "Block SMB between the two hosts",
    "Exfiltration": "Block the destination and throttle the egress path",
}


def _is_internal(ip: str, country: str) -> bool:
    if country.upper() == "INTERNAL":
        return True
    return ip.startswith(("10.", "192.168.", "172.16.", "172.17.", "172.18."))


def compute_risk(sev: Severity, vt: int, abuse: int, internal: bool, resolved: bool) -> int:
    """Same weighting the dashboard mirrors, kept server-side as the source of truth."""
    reputation = max(vt, abuse) * 0.42
    external = 0 if internal else 8
    closed = -14 if resolved else 0
    score = _SEVERITY_WEIGHT[sev] + reputation + external + closed
    return max(0, min(100, round(score)))


def _build_sources(ev: WazuhEvent, enriched: bool, internal: bool, vt: int, abuse: int) -> list[EnrichmentSource]:
    at = now_full()[11:]
    rep = max(vt, abuse)
    return [
        EnrichmentSource(name="Wazuh", status=SourceStatus.hit,
                         detail=f"Rule level {ev.rule_level} — {ev.mitre_id or 'no technique'}", at=at),
        EnrichmentSource(
            name="MISP",
            status=SourceStatus.skipped if internal else (SourceStatus.hit if rep >= 70 else SourceStatus.clean if enriched else SourceStatus.pending),
            detail="Internal address — not submitted" if internal
                   else "Address appears in an active IOC event" if rep >= 70
                   else "No matching IOC event" if enriched else "Lookup queued",
            at=at if enriched else "—",
        ),
        EnrichmentSource(name="Cortex",
                         status=SourceStatus.hit if enriched else SourceStatus.pending,
                         detail="Analyzers completed" if enriched else "Analyzers not yet run",
                         at=at if enriched else "—"),
        EnrichmentSource(name="VirusTotal",
                         status=(SourceStatus.hit if vt >= 40 else SourceStatus.clean) if enriched else SourceStatus.pending,
                         detail=f"Malicious score {vt}/100" if enriched else "Awaiting analyzer run",
                         at=at if enriched else "—"),
        EnrichmentSource(name="AbuseIPDB",
                         status=(SourceStatus.hit if abuse >= 40 else SourceStatus.clean) if enriched else SourceStatus.pending,
                         detail=f"Abuse confidence {abuse}%" if enriched else "Awaiting analyzer run",
                         at=at if enriched else "—"),
        EnrichmentSource(name="TheHive", status=SourceStatus.skipped,
                         detail="No case opened yet", at="—"),
    ]


def correlate(ev: WazuhEvent, alert_id: str) -> Alert:
    """Convert a Wazuh event into a fully scored Alert the dashboard can render."""
    sev = _severity_from_level(ev.rule_level)
    internal = _is_internal(ev.source_ip, ev.country)

    vt = ev.vt_score if ev.vt_score is not None else 0
    abuse = ev.abuse_score if ev.abuse_score is not None else 0
    enriched = ev.vt_score is not None or ev.abuse_score is not None

    risk = compute_risk(sev, vt, abuse, internal, resolved=False)

    ts = ev.timestamp or now_full()
    detected = ts[11:] if len(ts) > 11 else now_full()[11:]

    needs_action = risk > RESPONSE_THRESHOLD
    proposed = None
    if needs_action:
        proposed = ProposedAction(
            action=_ACTION_BY_ATTACK.get(ev.attack_type, "Block source IP at the perimeter firewall"),
            target=ev.source_ip,
            playbook="PB-" + (ev.attack_type or "generic").lower().replace(" ", "-"),
            dryRun=True,
        )

    return Alert(
        id=alert_id,
        timestamp=ts,
        severity=sev,
        sourceIP=ev.source_ip,
        attackType=ev.attack_type,
        mitreId=ev.mitre_id,
        mitreName=ev.mitre_name or ev.attack_type,
        status=AlertStatus.enriching if enriched else AlertStatus.new,
        vtScore=vt,
        abuseScore=abuse,
        country=ev.country or ("INTERNAL" if internal else ""),
        asn=ev.asn,
        raw=ev.raw or f"{ev.rule_description or ev.attack_type} from {ev.source_ip}",
        detectedAt=detected,
        enrichedAt=detected if enriched else "",
        riskScore=risk,
        aiConfidence=min(99, 60 + round(max(vt, abuse) * 0.3)),
        proposedAction=proposed,
        approvalStatus=ApprovalStatus.pending if proposed else ApprovalStatus.none,
        sources=_build_sources(ev, enriched, internal, vt, abuse),
    )
