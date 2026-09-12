"""
Simulation Center business logic.

This module owns exactly one thing: deciding, from real persisted data, what
a simulation run's result is. It never executes anything — see
simulation_catalog.py for why that's a hard boundary — and it never marks a
run PASSED without a matching Event+Alert row it can point to.

Evidence model per run:
  RUNNING       — inside the detection window, no verdict yet.
  PASSED        — a real alert landed within the window, correctly mapped to
                  the technique under test (event + alert ids recorded).
  PARTIAL       — telemetry arrived (an Event, optionally matching the
                  analyst's source hint) but never became a correctly-mapped
                  alert before the window closed.
  FAILED        — the analyst confirmed they ran the test (`executed_at` is
                  set) and the window closed with no matching telemetry at all.
  NOT_OBSERVED  — the window closed and the analyst never confirmed the test
                  was actually performed — we genuinely don't know what
                  happened, so this is kept distinct from FAILED.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone

from . import mitre_attack_data as attack
from . import simulation_catalog as catalog
from .models import (
    SimulationCenterSummary,
    SimulationDefinitionOut,
    SimulationRun,
    SimulationRunDetail,
    SimulationRunStatus,
    SimulationTimelineStage,
)
from .store import store


def _parse_iso(ts: str) -> datetime:
    dt = datetime.fromisoformat(ts)
    return dt if dt.tzinfo else dt.replace(tzinfo=timezone.utc)


def evaluate_run(run: SimulationRun) -> SimulationRun:
    """Re-checks a running simulation against real events/alerts and, if a
    verdict can now be reached, persists and returns the finalized run.
    Terminal runs are returned unchanged — history is immutable."""
    if run.status != SimulationRunStatus.running:
        return run

    started = _parse_iso(run.startedAt)
    now = datetime.now(timezone.utc)
    window_end = started + timedelta(seconds=run.windowSeconds)
    technique_base = attack.technique_base(run.techniqueId)

    events = store.events_created_since(run.startedAt, run.sourceHint)

    matched_alert = None
    matched_event = None
    earliest_telemetry = None
    for ev in events:
        if earliest_telemetry is None:
            earliest_telemetry = ev
        if ev.alertId:
            alert = store.get(ev.alertId)
            if alert and attack.technique_base(alert.mitreId) == technique_base:
                matched_alert, matched_event = alert, ev
                break

    if matched_alert is not None and matched_event is not None:
        anchor = matched_event.createdAt or matched_alert.createdAt or run.startedAt
        latency = max(0, int((_parse_iso(anchor) - started).total_seconds()))
        return store.finalize_simulation_run(
            run.id,
            status=SimulationRunStatus.passed,
            detection_event_id=matched_event.id,
            detection_alert_id=matched_alert.id,
            detection_latency_seconds=latency,
        )

    if now < window_end:
        return run

    if earliest_telemetry is not None:
        return store.finalize_simulation_run(
            run.id, status=SimulationRunStatus.partial, detection_event_id=earliest_telemetry.id,
        )

    if run.executedAt:
        return store.finalize_simulation_run(run.id, status=SimulationRunStatus.failed)

    return store.finalize_simulation_run(run.id, status=SimulationRunStatus.not_observed)


def evaluate_many(runs: list[SimulationRun]) -> list[SimulationRun]:
    return [evaluate_run(r) for r in runs]


def refresh_running_runs() -> None:
    """Sweeps every still-running simulation so timed-out runs flip to their
    final state before any aggregate (coverage, history, summary) is built
    from them. Cheap: there are only ever as many rows as active runs."""
    for run in store.running_simulation_runs():
        evaluate_run(run)


def technique_names(technique_id: str) -> tuple[str | None, str | None, str | None]:
    found = attack.find_technique(technique_id) if technique_id else None
    if not found:
        return None, None, None
    tactic, tech = found
    return tech["name"], tactic["id"], tactic["name"]


def build_definition_out(defn: catalog.SimulationDefinition) -> SimulationDefinitionOut:
    technique_name, tactic_id, tactic_name = technique_names(defn["technique_id"])
    runs = store.all_simulation_runs(simulation_id=defn["id"], limit=1000)
    passed = sum(1 for r in runs if r.status == SimulationRunStatus.passed)
    failed = sum(1 for r in runs if r.status in (SimulationRunStatus.failed, SimulationRunStatus.partial))
    return SimulationDefinitionOut(
        id=defn["id"],
        name=defn["name"],
        description=defn["description"],
        techniqueId=defn["technique_id"],
        techniqueName=technique_name,
        tacticId=tactic_id,
        tacticName=tactic_name,
        platform=defn["platform"],
        objective=defn["objective"],
        instructions=defn["instructions"],
        detectionHint=defn["detection_hint"],
        defaultWindowSeconds=defn["default_window_seconds"],
        custom=defn["custom"],
        totalRuns=len(runs),
        passedRuns=passed,
        failedRuns=failed,
        lastRun=runs[0].startedAt if runs else None,
        lastResult=runs[0].status if runs else None,
    )


def list_definitions() -> list[SimulationDefinitionOut]:
    refresh_running_runs()
    return [build_definition_out(d) for d in catalog.CATALOG]


def build_timeline(run: SimulationRun) -> list[SimulationTimelineStage]:
    """Seven fixed stages an analyst can scan at a glance. Every timestamp and
    status here is read straight off the run/event/alert rows already
    persisted by the real pipeline — this function only decides how to
    *group* that evidence for display, it never changes what counts as
    evidence (that's evaluate_run's job, above)."""
    started = _parse_iso(run.startedAt)
    window_end = started + timedelta(seconds=run.windowSeconds)
    now = datetime.now(timezone.utc)
    window_remaining = max(0, int((window_end - now).total_seconds()))

    event = store.get_event(run.detectionEventId) if run.detectionEventId else None
    alert = store.get(run.detectionAlertId) if run.detectionAlertId else None
    technique_matched = alert is not None  # PASS only ever records an alert once its mitre_id matched

    if run.status == SimulationRunStatus.running:
        window_detail = f"{run.windowSeconds}s window · {window_remaining}s remaining"
    else:
        window_detail = f"{run.windowSeconds}s window · closed {window_end.strftime('%H:%M:%S')} UTC"

    alert_detail = None
    if alert:
        alert_detail = f"Risk {alert.riskScore}/100 · {alert.severity.value}"
        if alert.aiExplanation:
            alert_detail += f" — {alert.aiExplanation}"

    response_detail = None
    if alert and alert.approvalStatus.value != "None":
        response_detail = alert.approvalStatus.value
        if alert.proposedAction:
            response_detail += f" — {alert.proposedAction.action}"

    return [
        SimulationTimelineStage(
            stage="SIMULATION STARTED", status="observed", timestamp=run.startedAt,
            detail=f"Started by {run.startedBy} · {run.simulationName}", objectId=run.id,
        ),
        SimulationTimelineStage(
            stage="DETECTION WINDOW", status="observed", timestamp=run.startedAt,
            detail=window_detail,
        ),
        SimulationTimelineStage(
            stage="ANALYST MARKED EXECUTED", status="observed" if run.executedAt else "not_observed",
            timestamp=run.executedAt,
            detail="Analyst confirmed the manual test was performed" if run.executedAt else None,
        ),
        SimulationTimelineStage(
            stage="WAZUH EVENT", status="observed" if event else "not_observed",
            timestamp=event.timestamp if event else None,
            detail=f"Rule {event.ruleId} (level {event.ruleLevel}): {event.ruleDescription}" if event else None,
            objectId=event.id if event else None,
        ),
        SimulationTimelineStage(
            stage="SOCORE ALERT", status="observed" if alert else "not_observed",
            timestamp=alert.timestamp if alert else None,
            detail=alert_detail, objectId=alert.id if alert else None,
        ),
        SimulationTimelineStage(
            stage="MITRE MAPPING", status="observed" if technique_matched else "not_observed",
            detail=f"Mapped to {alert.mitreId} ({alert.mitreName})" if technique_matched else None,
        ),
        SimulationTimelineStage(
            stage="DETECTION RESULT", status="observed" if run.status != SimulationRunStatus.running else "not_observed",
            timestamp=run.completedAt,
            detail=(run.status.value.upper() + (f" — {response_detail}" if response_detail else "")) if run.status != SimulationRunStatus.running else None,
        ),
    ]


def build_run_detail(run: SimulationRun) -> SimulationRunDetail:
    event = store.get_event(run.detectionEventId) if run.detectionEventId else None
    alert = store.get(run.detectionAlertId) if run.detectionAlertId else None
    return SimulationRunDetail(
        run=run,
        timeline=build_timeline(run),
        detectionEvent=event,
        detectionAlert=alert,
    )


def center_summary() -> SimulationCenterSummary:
    refresh_running_runs()
    runs = store.all_simulation_runs(limit=5000)
    passed = [r for r in runs if r.status == SimulationRunStatus.passed]
    failed = [r for r in runs if r.status == SimulationRunStatus.failed]
    partial = [r for r in runs if r.status == SimulationRunStatus.partial]
    running = [r for r in runs if r.status == SimulationRunStatus.running]
    not_observed = [r for r in runs if r.status == SimulationRunStatus.not_observed]

    terminal = passed + failed + partial + not_observed
    tested_techniques = {attack.technique_base(r.techniqueId) for r in runs if r.techniqueId}
    all_technique_ids = set(attack.all_technique_ids())
    never_tested = len(all_technique_ids - tested_techniques)

    detection_rate = (len(passed) / len(terminal) * 100) if terminal else None
    latencies = [r.detectionLatencySeconds for r in passed if r.detectionLatencySeconds is not None]
    avg_latency = (sum(latencies) / len(latencies)) if latencies else None

    return SimulationCenterSummary(
        totalRuns=len(runs),
        passed=len(passed),
        failed=len(failed),
        partial=len(partial),
        running=len(running),
        notObserved=len(not_observed),
        techniquesTested=len(tested_techniques),
        techniquesNeverTested=never_tested,
        detectionRate=round(detection_rate, 1) if detection_rate is not None else None,
        averageDetectionSeconds=round(avg_latency, 1) if avg_latency is not None else None,
    )
