"""
ATT&CK Center aggregation.

Every number here is computed live from `alerts` (real Wazuh-derived data —
see correlation.py, which copies `mitre_id`/`mitre_name` straight off the
inbound Wazuh event) and `simulation_runs` (real, evidence-based test
results — see simulations.py). The only static input is
mitre_attack_data.py, which is just the public ATT&CK taxonomy (which
techniques exist), never a detection result.

A technique with neither alerts nor simulation runs is NOT_TESTED — there is
no fabricated "no data" percentage anywhere in this module.
"""
from __future__ import annotations

from collections import Counter

from . import mitre_attack_data as attack
from . import simulations
from .models import (
    MitreCenterResponse,
    MitreCoverageSummary,
    MitreTactic,
    RelatedAlertSummary,
    RelatedCaseSummary,
    RelatedEventSummary,
    RelatedRuleSummary,
    SimulationRunStatus,
    TechniqueCoverage,
    TechniqueCoverageStatus,
    TechniqueDetail,
)
from .store import store

_SEVERITY_RANK = {"Critical": 4, "High": 3, "Medium": 2, "Low": 1, "Informational": 0}
_HIGH_RISK_TACTICS = {"TA0006", "TA0008", "TA0040", "TA0003"}  # Credential Access, Lateral Movement, Impact, Persistence


def _classify(alert_count: int, runs: list) -> TechniqueCoverageStatus:
    if alert_count > 0:
        return TechniqueCoverageStatus.detected
    if any(r.status == SimulationRunStatus.running for r in runs):
        return TechniqueCoverageStatus.testing
    if any(r.status == SimulationRunStatus.passed for r in runs):
        return TechniqueCoverageStatus.tested_passed
    if runs:
        return TechniqueCoverageStatus.tested_failed
    return TechniqueCoverageStatus.not_tested


def _runs_by_technique_base(limit: int = 10000) -> dict[str, list]:
    """One query for the whole matrix instead of an N+1 — grouped in Python
    the same way alert_coverage_by_technique() groups in SQL. `evaluate_many`
    is a no-op (no DB call) for anything already terminal, so this stays a
    single round trip even when runs are still 'running'."""
    grouped: dict[str, list] = {}
    for r in simulations.evaluate_many(store.all_simulation_runs(limit=limit)):
        grouped.setdefault(attack.technique_base(r.techniqueId), []).append(r)
    return grouped


def _build_coverage(tactic: dict, tech: dict, alert_rows: dict[str, dict], runs: list) -> TechniqueCoverage:
    row = alert_rows.get(tech["id"])
    alert_count = row["alert_count"] if row else 0
    first_detected = str(row["first_detected"]) if row and row.get("first_detected") else None
    last_detected = str(row["last_detected"]) if row and row.get("last_detected") else None
    highest_severity = None
    if row and row.get("severities"):
        highest_severity = max(row["severities"], key=lambda s: _SEVERITY_RANK.get(s, -1))

    passed = sum(1 for r in runs if r.status == SimulationRunStatus.passed)
    failed = sum(1 for r in runs if r.status in (SimulationRunStatus.failed, SimulationRunStatus.partial))
    terminal = [r for r in runs if r.status != SimulationRunStatus.running]
    success_rate = round(passed / len(terminal) * 100, 1) if terminal else None
    last_tested = runs[0].startedAt if runs else None  # runs_for_technique_base is ORDER BY started_at DESC

    return TechniqueCoverage(
        id=tech["id"],
        name=tech["name"],
        tacticId=tactic["id"],
        tacticName=tactic["name"],
        status=_classify(alert_count, runs),
        alertCount=alert_count,
        firstDetected=first_detected,
        lastDetected=last_detected,
        highestSeverity=highest_severity,
        simulationRuns=len(runs),
        simulationPassed=passed,
        simulationFailed=failed,
        lastTested=last_tested,
        detectionSuccessRate=success_rate,
    )


def build_center() -> MitreCenterResponse:
    simulations.refresh_running_runs()
    alert_rows = store.alert_coverage_by_technique()
    runs_by_base = _runs_by_technique_base()

    tactics: list[MitreTactic] = []
    all_coverage: list[TechniqueCoverage] = []
    for tactic in attack.TACTICS:
        techs = [_build_coverage(tactic, t, alert_rows, runs_by_base.get(t["id"], [])) for t in tactic["techniques"]]
        tactics.append(MitreTactic(id=tactic["id"], name=tactic["name"], techniques=techs))
        all_coverage.extend(techs)

    total = len(all_coverage)
    detected = sum(1 for c in all_coverage if c.status == TechniqueCoverageStatus.detected)
    # "Tested" = has at least one simulation run on record, independent of
    # whether it's also been detected from real traffic — these are two
    # different questions (has it ever fired for real vs. have we validated
    # it ourselves) and the dashboard needs both answered separately.
    tested = sum(1 for c in all_coverage if c.simulationRuns > 0)
    not_tested = total - tested
    failed_tests = sum(1 for c in all_coverage if c.status == TechniqueCoverageStatus.tested_failed)
    high_risk_gaps = sum(
        1 for c in all_coverage
        if c.status == TechniqueCoverageStatus.not_tested and c.tacticId in _HIGH_RISK_TACTICS
    )

    summary = MitreCoverageSummary(
        totalTechniques=total,
        detectedTechniques=detected,
        testedTechniques=tested,
        notTestedTechniques=not_tested,
        failedTests=failed_tests,
        highRiskGaps=high_risk_gaps,
        coveragePercent=round(detected / total * 100, 1) if total else 0.0,
    )
    return MitreCenterResponse(summary=summary, tactics=tactics)


def build_technique_detail(technique_id: str) -> TechniqueDetail | None:
    found = attack.find_technique(technique_id)
    if not found:
        return None
    tactic, tech = found

    alert_rows = store.alert_coverage_by_technique()
    related_runs = simulations.evaluate_many(store.runs_for_technique_base(tech["id"]))
    coverage = _build_coverage(tactic, tech, alert_rows, related_runs)

    related_alerts = store.alerts_for_technique_base(tech["id"], limit=25)
    alert_ids = {a.id for a in related_alerts}
    related_cases = [
        RelatedCaseSummary(id=c.id, title=c.title, status=c.status, severity=c.severity)
        for c in store.all_cases()
        if alert_ids.intersection(c.alertIds)
    ]

    # Raw events behind these alerts — the append-only history layer, kept
    # independent of the Alert it became (see events_for_ids/store.py).
    event_ids = [a.sourceEventId for a in related_alerts if a.sourceEventId]
    related_events = store.events_for_ids(event_ids)
    affected_hosts = sorted({e.agentName for e in related_events if e.agentName})
    rule_counts = Counter((e.ruleId, e.ruleDescription) for e in related_events if e.ruleId)
    related_rules = [
        RelatedRuleSummary(ruleId=rule_id, ruleDescription=desc, occurrences=count)
        for (rule_id, desc), count in sorted(rule_counts.items(), key=lambda kv: -kv[1])
    ]

    return TechniqueDetail(
        id=tech["id"],
        name=tech["name"],
        tacticId=tactic["id"],
        tacticName=tactic["name"],
        description=attack.describe(tech["id"]),
        coverage=coverage,
        relatedAlerts=[
            RelatedAlertSummary(
                id=a.id, timestamp=a.timestamp, severity=a.severity, sourceIP=a.sourceIP,
                attackType=a.attackType, riskScore=a.riskScore, approvalStatus=a.approvalStatus,
                aiExplanation=a.aiExplanation, proposedAction=a.proposedAction,
                respondedAt=a.respondedAt, sourceEventId=a.sourceEventId,
            )
            for a in related_alerts
        ],
        relatedCases=related_cases,
        relatedEvents=[
            RelatedEventSummary(
                id=e.id, timestamp=e.timestamp, sourceIP=e.sourceIP, agentName=e.agentName,
                ruleId=e.ruleId, ruleDescription=e.ruleDescription, alertId=e.alertId,
            )
            for e in related_events
        ],
        affectedHosts=affected_hosts,
        relatedRules=related_rules,
        relatedSimulationRuns=related_runs,
    )
