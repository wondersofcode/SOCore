"""
SOCore backend — FastAPI application.

The brain between detection and the dashboard:
  Wazuh event  ->  correlate (risk score)  ->  explain (AI)  ->  store
                                                                   |
  dashboard  <-  /api/alerts, /api/pending  <----------------------+
  analyst decision  ->  /api/approve/{id}  ->  run playbook (dry-run) + Slack

Run:  uvicorn app.main:app --reload --port 8000
Docs: http://localhost:8000/docs
"""
from __future__ import annotations

import hmac
import logging
import os
from datetime import datetime, timezone

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from . import actions, ai_explainer, assistant, auth, db, enrichment, integrations_health, mitre, report_export, response_exec, shift_summary, simulations
from . import mitre_attack_data as attack_data
from . import simulation_catalog
from .correlation import correlate
from .models import (
    AddAlertNoteRequest,
    AddNoteRequest,
    Alert,
    AlertNote,
    ApprovalDecision,
    ApprovalStatus,
    AuditEntry,
    AssistantChatRequest,
    AssistantChatResponse,
    Case,
    CreateCaseRequest,
    Event,
    ExecutionStatus,
    FalsePositiveRequest,
    MitreCenterResponse,
    Profile,
    ReasonRequest,
    ShiftSummaryResponse,
    SimulationCenterSummary,
    SimulationDefinitionOut,
    SimulationRun,
    SimulationRunDetail,
    StartSimulationRunRequest,
    TechniqueDetail,
    UpdateCaseRequest,
    UpdateProfileRequest,
    UpdateRoleRequest,
    WazuhEvent,
    now_full,
)
from .seed import seed_alerts
from .store import store

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(message)s")
logger = logging.getLogger("socore")

app = FastAPI(title="SOCore Backend", version="1.0.0")

# The dashboard runs on a different port in dev, so allow browser calls.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten to the dashboard origin in production
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def _startup() -> None:
    if not db.is_configured():
        logger.warning(
            "DATABASE_URL not set — the backend will crash on first query. "
            "Set DATABASE_URL in .env to your Supabase Postgres connection string."
        )
        return
    db.init_schema()
    # Seed a handful of alerts so the dashboard has content before any real
    # Wazuh event arrives. Only runs once — if the table already has rows
    # (a real restart with persisted data), seeding is skipped.
    store.seed(seed_alerts)
    recovered = store.recover_stuck_executions()
    if recovered:
        logger.warning("Marked %d alert(s) stuck in 'Executing' as ExecutionFailed after restart", recovered)
    logger.info("Seeded/verified alerts. AI live: %s", ai_explainer.is_live())


# ── Health / status ─────────────────────────────────────────────────────────
@app.get("/api/health")
def health() -> dict:
    connections = integrations_health.check()
    connections["ai"] = {"connected": ai_explainer.is_live(), "url": None}
    connections["caseManagement"] = {"connected": True, "url": None}
    return {
        "status": "ok",
        "aiLive": ai_explainer.is_live(),
        "alerts": len(store.all()),
        "pending": len(store.pending()),
        "connections": connections,
    }


@app.get("/api/me")
def me(current_user: auth.CurrentUser = Depends(auth.get_current_user)) -> dict:
    profile = store.get_profile(current_user.user_id)
    return {
        "email": current_user.email,
        "role": current_user.role,
        "display_name": current_user.display_name,
        "firstName": profile.firstName if profile else "",
        "lastName": profile.lastName if profile else "",
        "avatarUrl": profile.avatarUrl if profile else "",
        "themePreference": profile.themePreference if profile else "dark",
        "timezone": profile.timezone if profile else "Asia/Baku",
    }


@app.patch("/api/profile", response_model=Profile)
def update_my_profile(
    req: UpdateProfileRequest,
    current_user: auth.CurrentUser = Depends(auth.get_current_user),
) -> Profile:
    """Self-service profile edit (name, avatar, theme) from the Settings page."""
    updated = store.update_profile(
        current_user.user_id,
        first_name=req.firstName,
        last_name=req.lastName,
        avatar_url=req.avatarUrl,
        theme_preference=req.themePreference,
        timezone=req.timezone,
    )
    if updated is None:
        raise HTTPException(status_code=404, detail="Profile not found")
    return updated


# ── Admin: registration approval + role management ──────────────────────────
@app.get("/api/admin/pending-count")
def admin_pending_count(current_user: auth.CurrentUser = Depends(auth.require_admin)) -> dict:
    return {"count": store.count_pending_profiles()}


@app.get("/api/admin/users", response_model=list[Profile])
def admin_list_users(current_user: auth.CurrentUser = Depends(auth.require_admin)) -> list[Profile]:
    return store.all_profiles()


@app.post("/api/admin/users/{user_id}/approve", response_model=Profile)
def admin_approve_user(
    user_id: str,
    current_user: auth.CurrentUser = Depends(auth.require_admin),
) -> Profile:
    updated = store.set_profile_status(user_id, "approved")
    if updated is None:
        raise HTTPException(status_code=404, detail="User not found")
    actions.send_slack_alert(f"{current_user.display_name} approved {updated.email}")
    logger.info("Admin %s approved user %s", current_user.email, updated.email)
    return updated


@app.post("/api/admin/users/{user_id}/reject", response_model=Profile)
def admin_reject_user(
    user_id: str,
    current_user: auth.CurrentUser = Depends(auth.require_admin),
) -> Profile:
    updated = store.set_profile_status(user_id, "rejected")
    if updated is None:
        raise HTTPException(status_code=404, detail="User not found")
    actions.send_slack_alert(f"{current_user.display_name} rejected {updated.email}")
    logger.info("Admin %s rejected user %s", current_user.email, updated.email)
    return updated


@app.patch("/api/admin/users/{user_id}/role", response_model=Profile)
def admin_update_role(
    user_id: str,
    req: UpdateRoleRequest,
    current_user: auth.CurrentUser = Depends(auth.require_admin),
) -> Profile:
    updated = store.set_profile_role(user_id, req.role.value)
    if updated is None:
        raise HTTPException(status_code=404, detail="User not found")
    logger.info("Admin %s set %s's role to %s", current_user.email, updated.email, req.role.value)
    return updated


# ── Ingestion: Wazuh -> scored alert ────────────────────────────────────────
@app.post("/api/ingest", response_model=Alert)
def ingest(event: WazuhEvent, x_socore_token: str | None = Header(default=None)) -> Alert:
    """
    Entry point for the detection layer. Wazuh's integration script POSTs an
    event here. If the event doesn't already carry reputation scores, we run
    it through MISP + Cortex ourselves before scoring — this is what actually
    exercises the threat-intel stack rather than trusting whatever numbers
    Wazuh sent. Enrichment is best-effort and time-boxed: a slow or
    unconfigured MISP/Cortex never blocks the response to Wazuh.
    """
    from .correlation import _is_internal  # local import avoids a cycle at module load

    # Anyone who can reach this endpoint can create alerts (and therefore
    # approval requests naming an arbitrary target IP). When SOCORE_INGEST_TOKEN
    # is set the Wazuh integration must send it as X-SOCore-Token; when unset
    # the endpoint stays open exactly as before so existing deployments keep
    # working until the token is rolled out on both sides.
    expected = os.environ.get("SOCORE_INGEST_TOKEN", "").strip()
    if expected and not hmac.compare_digest(expected, x_socore_token or ""):
        raise HTTPException(status_code=401, detail="Invalid or missing ingest token")

    # Persist the raw Wazuh event first, independent of whatever it becomes.
    # This is the append-only history layer: every event that reaches this
    # endpoint is recorded here even if it's later filtered out of the
    # alert pipeline (not all events become alerts).
    event_id = store.next_event_id()
    store.add_event(
        Event(
            id=event_id,
            timestamp=event.timestamp or now_full(),
            sourceIP=event.source_ip,
            ruleId=event.rule_id,
            ruleLevel=event.rule_level,
            ruleDescription=event.rule_description,
            raw=event.raw,
            agentId=event.agent_id,
            agentName=event.agent_name,
        )
    )

    internal = _is_internal(event.source_ip, event.country)
    enrich_result = None
    if event.vt_score is None and event.abuse_score is None:
        enrich_result = enrichment.enrich_ip(event.source_ip, internal)
        event.vt_score = enrich_result["vt_score"]
        event.abuse_score = enrich_result["combined_abuse_score"]

    alert = correlate(event, store.next_id())
    alert.sourceEventId = event_id
    alert.aiExplanation = ai_explainer.explain(alert)

    # Reflect what enrichment actually did, not just what the scores imply.
    # "skipped" = not configured, "error" = configured but the call failed
    # (e.g. a 403 from a mis-scoped API key), "hit"/"clean" = it really ran.
    if enrich_result is not None:
        for src in alert.sources:
            if src.name == "MISP":
                if enrich_result["misp_skipped"]:
                    src.status = "skipped"
                    src.detail = "Internal address — not submitted" if internal else "MISP not configured"
                elif enrich_result["misp_error"]:
                    src.status = "skipped"
                    src.detail = f"MISP error: {enrich_result['misp_error']}"
                elif enrich_result["misp_hit"]:
                    src.status, src.detail = "hit", "Address appears in an active IOC event"
                else:
                    src.status, src.detail = "clean", "No matching IOC event"
            if src.name == "Cortex":
                if enrich_result["cortex_skipped"]:
                    src.status = "skipped"
                    src.detail = "Internal address — not submitted" if internal else "Cortex not configured"
                elif not enrich_result["cortex_ok"]:
                    src.status, src.detail = "skipped", f"Cortex error: {enrich_result['cortex_error']}"
                else:
                    src.status = "hit" if max(enrich_result["vt_score"], enrich_result["abuse_score"]) >= 40 else "clean"
                    src.detail = "Analyzers completed"

    store.add(alert)
    store.link_event_to_alert(event_id, alert.id)

    # Notifications are low-risk, so they run without approval. High-risk
    # alerts are handed to the Shuffle playbook instead — it posts its own
    # Slack message, so calling send_slack_alert here too would duplicate it.
    if alert.riskScore > 70:
        enrichment.shuffle_trigger(alert.model_dump(mode="json"))
    else:
        actions.send_slack_alert(
            f"New {alert.severity.value} alert: {alert.attackType} from {alert.sourceIP} "
            f"(risk {alert.riskScore}, {alert.mitreId})"
        )

    logger.info("Ingested %s risk=%d approval=%s", alert.id, alert.riskScore, alert.approvalStatus.value)
    return alert


# ── Reads for the dashboard ─────────────────────────────────────────────────
@app.get("/api/alerts", response_model=list[Alert])
def list_alerts(current_user: auth.CurrentUser = Depends(auth.get_current_user)) -> list[Alert]:
    return store.all()


@app.get("/api/alerts/{alert_id}", response_model=Alert)
def get_alert(alert_id: str, current_user: auth.CurrentUser = Depends(auth.get_current_user)) -> Alert:
    alert = store.get(alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@app.get("/api/pending", response_model=list[Alert])
def list_pending(current_user: auth.CurrentUser = Depends(auth.get_current_user)) -> list[Alert]:
    return store.pending()


# ── Alert notes — persistent, one row per note (Alert Detail's "Save Note") ─
@app.get("/api/alerts/{alert_id}/notes", response_model=list[AlertNote])
def list_alert_notes(
    alert_id: str,
    current_user: auth.CurrentUser = Depends(auth.get_current_user),
) -> list[AlertNote]:
    if store.get(alert_id) is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    return store.alert_notes(alert_id)


@app.post("/api/alerts/{alert_id}/notes", response_model=AlertNote)
def add_alert_note(
    alert_id: str,
    req: AddAlertNoteRequest,
    current_user: auth.CurrentUser = Depends(auth.get_current_user),
) -> AlertNote:
    """Author is always the authenticated caller's identity, never a
    client-supplied field — mirrors /api/cases/{id}/notes."""
    if store.get(alert_id) is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    text = req.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Note text is required")
    note = store.add_alert_note(alert_id, current_user.display_name, text)
    logger.info("Note added to alert %s by %s", alert_id, current_user.email)
    return note


# ── False-positive disposition ──────────────────────────────────────────────
@app.post("/api/alerts/{alert_id}/false-positive", response_model=Alert)
def mark_false_positive(
    alert_id: str,
    req: FalsePositiveRequest,
    current_user: auth.CurrentUser = Depends(auth.get_current_user),
) -> Alert:
    """Marks the alert itself as a false positive — distinct from rejecting a
    proposed automated response (approvalStatus). Never deletes the alert,
    its raw event, or prior decisions; adds a 'False Positive' entry to the
    audit trail (/api/decisions) instead."""
    reason = req.reason.strip()
    if not reason:
        raise HTTPException(status_code=400, detail="A reason is required to mark an alert as a false positive")
    updated = store.mark_false_positive(alert_id, reason, current_user.display_name)
    if updated is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    actions.send_slack_alert(f"{current_user.display_name} marked {alert_id} as a false positive: {reason}")
    logger.info("Alert %s marked false positive by %s", alert_id, current_user.email)
    return updated


# ── Raw event history — independent of whatever Alert an event became ──────
@app.get("/api/events", response_model=list[Event])
def list_events(
    limit: int = 50,
    offset: int = 0,
    current_user: auth.CurrentUser = Depends(auth.get_current_user),
) -> list[Event]:
    limit = max(1, min(limit, 200))
    return store.all_events(limit=limit, offset=offset)


@app.get("/api/events/count")
def events_count(current_user: auth.CurrentUser = Depends(auth.get_current_user)) -> dict:
    """Total raw event count — the Dashboard's Detection Pipeline needs the
    real total, not just one paginated page of /api/events."""
    return {"count": store.count_events()}


@app.get("/api/events/{event_id}", response_model=Event)
def get_event(event_id: str, current_user: auth.CurrentUser = Depends(auth.get_current_user)) -> Event:
    event = store.get_event(event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@app.get("/api/decisions")
def list_decisions(current_user: auth.CurrentUser = Depends(auth.get_current_user)) -> list:
    return store.decisions()


# ── Human-in-the-loop decision ──────────────────────────────────────────────
# Approve & Run / Reject are authoritative here, not in the browser:
#   * only l2_analyst / admin may decide (l1 can investigate, note and escalate)
#   * the Pending -> Approved/Rejected move is one atomic conditional UPDATE
#     (store.claim_decision), so concurrent or repeated requests can never
#     both win — the loser gets 409 and nothing runs a second time
#   * the response action only runs for the request that won that claim, and
#     its real outcome (Executed / Simulated / ExecutionFailed) is persisted
#     and audited before the response is returned
REVIEW_ROLES = ("l2_analyst", "admin")


def _client_ips(request: Request) -> list[str]:
    """The approving analyst's own address(es) — never blocked, so an analyst
    cannot ban themselves. X-Forwarded-For can be spoofed, but a spoofed value
    can only widen the protected set, never narrow it."""
    ips = []
    if request.client and request.client.host:
        ips.append(request.client.host)
    fwd = request.headers.get("x-forwarded-for", "")
    ips.extend(p.strip() for p in fwd.split(",") if p.strip())
    return ips


def _require_reviewer(user: auth.CurrentUser, alert: Alert | None, action: str) -> None:
    if user.role in REVIEW_ROLES:
        return
    if alert is not None:
        store.record_audit(alert.id, user, f"{action}_denied", alert.approvalStatus.value, alert.approvalStatus.value,
                           f"role '{user.role}' may not {action}")
    raise HTTPException(status_code=403, detail="L2 analyst or admin role required to approve or reject response actions")


def _alert_or_404(alert_id: str) -> Alert:
    alert = store.get(alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


def _conflict(alert: Alert, user: auth.CurrentUser, action: str, message: str) -> HTTPException:
    store.record_audit(alert.id, user, f"{action}_conflict", alert.approvalStatus.value, alert.approvalStatus.value, message)
    return HTTPException(status_code=409, detail=message)


def _execute_and_persist(alert: Alert, user: auth.CurrentUser, request: Request, audit_action: str) -> Alert:
    """Runs the alert's proposed action (the caller already holds the
    `Executing` claim) and persists + audits the real outcome."""
    action = alert.proposedAction
    try:
        if action is None:
            result = {"status": "ExecutionFailed", "ok": False, "error": "Alert has no proposed action"}
        else:
            result = response_exec.execute(action.action, action.target, _client_ips(request))
    except Exception as exc:  # an executor bug must not leave the alert 'Executing'
        logger.exception("Execution crashed for %s", alert.id)
        result = {"status": "ExecutionFailed", "ok": False, "error": f"Unexpected executor error: {exc}"}

    status = ExecutionStatus(result["status"])
    try:
        finished = store.finish_execution(alert.id, status, result, user, audit_action)
    except Exception as exc:
        logger.critical("Action for %s finished as %s but the result could not be saved: %s", alert.id, status.value, exc)
        raise HTTPException(
            status_code=500,
            detail=f"The action finished as {status.value} but its result could not be saved to the database. "
                   f"Check the target host manually before retrying.",
        ) from exc
    if finished is None:
        raise HTTPException(status_code=409, detail="Alert execution state changed while the action was running")

    verb = {"Executed": "executed", "Simulated": "SIMULATED (no executor, nothing changed)", "ExecutionFailed": "FAILED"}[status.value]
    detail = f" - {result.get('error')}" if status == ExecutionStatus.failed else ""
    actions.send_slack_alert(
        f"{user.display_name} approved: {action.action if action else 'action'} on "
        f"{action.target if action else alert.sourceIP} - {verb}{detail}"
    )
    logger.info("Approved %s -> %s", alert.id, status.value)
    return finished


def _validate_proposed_target(alert: Alert, user: auth.CurrentUser, request: Request, action_name: str) -> None:
    """Refuses (4xx + audit) an approval whose target must never be blocked.
    The alert stays Pending so the analyst can still reject it."""
    action = alert.proposedAction
    if action is None or response_exec.classify(action.action) != response_exec.KIND_BLOCK_IP:
        return
    try:
        response_exec.validate_block_target(action.target, _client_ips(request))
    except response_exec.TargetRefused as exc:
        store.record_audit(alert.id, user, f"{action_name}_refused_protected_target", alert.approvalStatus.value,
                           alert.approvalStatus.value, str(exc), {"target": action.target})
        raise HTTPException(status_code=422, detail=f"Refused: {exc}. Reject this action instead.") from exc


@app.post("/api/approve/{alert_id}", response_model=Alert)
def approve(
    alert_id: str,
    decision: ApprovalDecision,
    request: Request,
    current_user: auth.CurrentUser = Depends(auth.get_current_user),
) -> Alert:
    """
    Approve & Run / Reject for a pending alert. Returns the alert as persisted:
    check `executionStatus` — an approved alert can legitimately come back as
    ExecutionFailed (decision recorded, action did not run) or Simulated.
    """
    alert = store.get(alert_id)
    action = (decision.decision or "").strip().lower()
    verb = "approve" if action.startswith("app") else "reject"
    _require_reviewer(current_user, alert, verb)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    if action not in ("approve", "reject"):
        raise HTTPException(status_code=400, detail="decision must be 'approve' or 'reject'")

    reason = decision.reason.strip()
    if verb == "reject" and not reason:
        raise HTTPException(status_code=400, detail="A reason is required to reject a proposed action")
    if alert.approvalStatus != ApprovalStatus.pending or alert.falsePositive:
        why = "marked as a false positive" if alert.falsePositive else f"already {alert.approvalStatus.value.lower()}"
        raise _conflict(alert, current_user, verb, f"Alert is not awaiting a decision ({why})")
    if alert.proposedAction is None:
        raise HTTPException(status_code=409, detail="Alert has no proposed action to decide on")

    if verb == "approve":
        _validate_proposed_target(alert, current_user, request, verb)

    claimed = store.claim_decision(alert_id, verb == "approve", current_user, reason)
    if claimed is None:
        # Lost the race: someone else decided between our read and our claim.
        latest = store.get(alert_id) or alert
        raise _conflict(latest, current_user, verb,
                        f"Alert was already {latest.approvalStatus.value.lower()} by another request")

    if verb == "reject":
        actions.send_slack_alert(f"{current_user.display_name} rejected the action on {claimed.sourceIP}: {reason}")
        logger.info("Rejected %s by %s", alert_id, current_user.email)
        return claimed
    return _execute_and_persist(claimed, current_user, request, "execution")


@app.post("/api/alerts/{alert_id}/retry-execution", response_model=Alert)
def retry_execution(
    alert_id: str,
    request: Request,
    current_user: auth.CurrentUser = Depends(auth.get_current_user),
) -> Alert:
    """Re-runs an approved action whose execution failed. Atomic like approve:
    only one retry can claim ExecutionFailed -> Executing."""
    alert = store.get(alert_id)
    _require_reviewer(current_user, alert, "retry")
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    if alert.approvalStatus != ApprovalStatus.approved or alert.executionStatus != ExecutionStatus.failed:
        raise _conflict(alert, current_user, "retry", "Only an approved alert whose execution failed can be retried")
    _validate_proposed_target(alert, current_user, request, "retry")
    claimed = store.claim_execution_transition(alert_id, ExecutionStatus.failed, current_user, "retry_requested")
    if claimed is None:
        latest = store.get(alert_id) or alert
        raise _conflict(latest, current_user, "retry", "Execution was already retried by another request")
    return _execute_and_persist(claimed, current_user, request, "execution_retry")


@app.post("/api/alerts/{alert_id}/unblock", response_model=Alert)
def unblock(
    alert_id: str,
    req: ReasonRequest,
    current_user: auth.CurrentUser = Depends(auth.get_current_user),
) -> Alert:
    """Reverts a real fail2ban block (unban) and records it. Executed -> Reverted."""
    alert = store.get(alert_id)
    _require_reviewer(current_user, alert, "unblock")
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    prior = alert.executionResult or {}
    if alert.executionStatus != ExecutionStatus.executed or prior.get("mode") != "fail2ban":
        raise _conflict(alert, current_user, "unblock", "Only an alert with an executed fail2ban block can be unblocked")
    reason = req.reason.strip()
    claimed = store.claim_execution_transition(alert_id, ExecutionStatus.executed, current_user, "unblock_requested", reason)
    if claimed is None:
        latest = store.get(alert_id) or alert
        raise _conflict(latest, current_user, "unblock", "Block was already reverted by another request")

    try:
        unban = response_exec.unban_ip(prior["target"])
    except Exception as exc:
        logger.exception("Unban crashed for %s", alert_id)
        unban = {"ok": False, "error": f"Unexpected executor error: {exc}"}
    if unban.get("ok"):
        final_status, merged = ExecutionStatus.reverted, {**prior, "status": "Reverted", "revert": unban}
        audit_action = "unblock"
    else:
        # Still blocked: put it back to Executed so it can be retried, but keep the failure on record.
        final_status, merged = ExecutionStatus.executed, {**prior, "revert_error": unban}
        audit_action = "unblock_failed"
    finished = store.finish_execution(alert_id, final_status, merged, current_user, audit_action, reason)
    if finished is None:
        raise HTTPException(status_code=409, detail="Alert execution state changed while unblocking")
    actions.send_slack_alert(
        f"{current_user.display_name} unblocked {prior['target']} - "
        f"{'reverted' if unban.get('ok') else 'FAILED: ' + str(unban.get('error'))}"
    )
    return finished


@app.get("/api/alerts/{alert_id}/audit", response_model=list[AuditEntry])
def alert_audit_trail(
    alert_id: str,
    current_user: auth.CurrentUser = Depends(auth.get_current_user),
) -> list[AuditEntry]:
    _alert_or_404(alert_id)
    return store.audit_for_alert(alert_id)


# ── Case management (in-house replacement for TheHive) ──────────────────────
# TheHive 4's Docker images are no longer published and TheHive 5 requires a
# commercial license after a 14-day trial. Case tracking is handled here
# instead: same shape the dashboard's CaseManagement screen expects, with no
# external dependency or license risk.

@app.get("/api/cases", response_model=list[Case])
def list_cases(current_user: auth.CurrentUser = Depends(auth.get_current_user)) -> list[Case]:
    return store.all_cases()


@app.get("/api/cases/{case_id}", response_model=Case)
def get_case(case_id: str, current_user: auth.CurrentUser = Depends(auth.get_current_user)) -> Case:
    case = store.get_case(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


@app.post("/api/cases", response_model=Case)
def create_case(
    req: CreateCaseRequest,
    current_user: auth.CurrentUser = Depends(auth.get_current_user),
) -> Case:
    """Open a case from an alert — the analyst's 'Escalate to case' action.
    Idempotent per alert: if a case already links this alert (a double-click,
    or a second analyst escalating the same alert), that existing case is
    returned instead of creating a duplicate."""
    existing = store.get_case_for_alert(req.alertId)
    if existing is not None:
        return existing
    case = store.open_case_from_alert(req.alertId, req.title, current_user.display_name)
    if case is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    actions.send_slack_alert(f"Case {case.id} opened by {current_user.display_name}: {case.title}")
    logger.info("Opened case %s from alert %s", case.id, req.alertId)
    return case


@app.patch("/api/cases/{case_id}", response_model=Case)
def update_case(
    case_id: str,
    req: UpdateCaseRequest,
    current_user: auth.CurrentUser = Depends(auth.get_current_user),
) -> Case:
    case = store.update_case(case_id, req.status, req.assignedTo)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


@app.post("/api/cases/{case_id}/notes", response_model=Case)
def add_case_note(
    case_id: str,
    req: AddNoteRequest,
    current_user: auth.CurrentUser = Depends(auth.get_current_user),
) -> Case:
    case = store.add_case_note(case_id, current_user.display_name, req.text)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


@app.post("/api/cases/{case_id}/tasks/{task_id}/toggle", response_model=Case)
def toggle_case_task(
    case_id: str,
    task_id: str,
    current_user: auth.CurrentUser = Depends(auth.get_current_user),
) -> Case:
    case = store.toggle_task(case_id, task_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


# ── MITRE ATT&CK Center ──────────────────────────────────────────────────────
# Reference taxonomy (which techniques exist) is static public ATT&CK data;
# every status/count layered on it is computed live from real alerts and
# simulation_runs in mitre.py — see that module's docstring.
@app.get("/api/mitre", response_model=MitreCenterResponse)
def mitre_center(current_user: auth.CurrentUser = Depends(auth.get_current_user)) -> MitreCenterResponse:
    return mitre.build_center()


@app.get("/api/mitre/{technique_id}", response_model=TechniqueDetail)
def mitre_technique_detail(
    technique_id: str,
    current_user: auth.CurrentUser = Depends(auth.get_current_user),
) -> TechniqueDetail:
    detail = mitre.build_technique_detail(technique_id)
    if detail is None:
        raise HTTPException(status_code=404, detail="Unknown ATT&CK technique")
    return detail


# ── Simulation Center ────────────────────────────────────────────────────────
# See simulation_catalog.py / simulations.py for the safety model: SOCore
# never executes any of these tests itself. Starting a run only opens a
# detection window; PASS/FAIL is decided later, purely from whatever real
# telemetry actually lands in events/alerts during that window.
@app.get("/api/simulations", response_model=list[SimulationDefinitionOut])
def list_simulations(current_user: auth.CurrentUser = Depends(auth.get_current_user)) -> list[SimulationDefinitionOut]:
    return simulations.list_definitions()


@app.get("/api/simulations/summary", response_model=SimulationCenterSummary)
def simulations_summary(current_user: auth.CurrentUser = Depends(auth.get_current_user)) -> SimulationCenterSummary:
    return simulations.center_summary()


@app.get("/api/simulations/runs", response_model=list[SimulationRun])
def list_simulation_runs(
    techniqueId: str | None = None,
    status: str | None = None,
    platform: str | None = None,
    current_user: auth.CurrentUser = Depends(auth.get_current_user),
) -> list[SimulationRun]:
    simulations.refresh_running_runs()
    return store.all_simulation_runs(technique_id=techniqueId, status=status, platform=platform)


@app.get("/api/simulations/runs/{run_id}", response_model=SimulationRunDetail)
def get_simulation_run(
    run_id: str,
    current_user: auth.CurrentUser = Depends(auth.get_current_user),
) -> SimulationRunDetail:
    run = store.get_simulation_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Simulation run not found")
    run = simulations.evaluate_run(run)
    return simulations.build_run_detail(run)


@app.get("/api/simulations/{simulation_id}", response_model=SimulationDefinitionOut)
def get_simulation_definition(
    simulation_id: str,
    current_user: auth.CurrentUser = Depends(auth.get_current_user),
) -> SimulationDefinitionOut:
    defn = simulation_catalog.get(simulation_id)
    if defn is None:
        raise HTTPException(status_code=404, detail="Unknown simulation")
    return simulations.build_definition_out(defn)


@app.post("/api/simulations/{simulation_id}/runs", response_model=SimulationRun)
def start_simulation_run(
    simulation_id: str,
    req: StartSimulationRunRequest,
    current_user: auth.CurrentUser = Depends(auth.require_l2_or_admin),
) -> SimulationRun:
    """Starting a run only records intent and opens a detection window — it
    triggers no action on any endpoint. RBAC-gated (simulation.run) to
    l2_analyst/admin, same tier as SOCore's other "touches real
    infrastructure" actions."""
    defn = simulation_catalog.get(simulation_id)
    if defn is None:
        raise HTTPException(status_code=404, detail="Unknown simulation")

    # Only the catalog's own "custom" template lets the caller pick the
    # technique/platform/objective — every other entry is a fixed, reviewed
    # mapping (see simulation_catalog.py) and the request body can't move it
    # onto a different technique.
    if defn["custom"]:
        technique_id = (req.techniqueId or "").strip().upper()
        if not technique_id:
            raise HTTPException(status_code=400, detail="techniqueId is required for a custom simulation")
        if attack_data.find_technique(technique_id) is None:
            raise HTTPException(status_code=400, detail=f"'{technique_id}' is not a known ATT&CK technique id")
        platform = req.platform or defn["platform"]
        objective = req.objective or defn["objective"]
    else:
        technique_id = defn["technique_id"]
        platform = defn["platform"]
        objective = defn["objective"]

    technique_name, tactic_id, tactic_name = simulations.technique_names(technique_id)
    window_seconds = req.windowSeconds or defn["default_window_seconds"]
    if not (30 <= window_seconds <= 3600):
        raise HTTPException(status_code=400, detail="windowSeconds must be between 30 and 3600")

    run = store.start_simulation_run(
        simulation_id=defn["id"],
        simulation_name=defn["name"],
        technique_id=technique_id,
        technique_name=technique_name,
        tactic_id=tactic_id,
        tactic_name=tactic_name,
        platform=platform,
        objective=objective,
        source_hint=req.sourceHint,
        window_seconds=window_seconds,
        started_by=current_user.display_name,
        started_by_id=current_user.user_id,
    )
    logger.info("Simulation run %s started by %s (%s, technique=%s)", run.id, current_user.email, defn["id"], technique_id)
    actions.send_slack_alert(
        f"{current_user.display_name} started a detection validation test: {defn['name']} ({technique_id})"
    )
    return run


@app.post("/api/simulations/runs/{run_id}/mark-executed", response_model=SimulationRun)
def mark_simulation_run_executed(
    run_id: str,
    current_user: auth.CurrentUser = Depends(auth.require_l2_or_admin),
) -> SimulationRun:
    run = store.get_simulation_run(run_id)
    if run is None:
        raise HTTPException(status_code=404, detail="Simulation run not found")
    updated = store.mark_run_executed(run_id)
    assert updated is not None
    return simulations.evaluate_run(updated)


# ── AI assistant chat ────────────────────────────────────────────────────────
@app.post("/api/assistant/chat", response_model=AssistantChatResponse)
def assistant_chat(
    req: AssistantChatRequest,
    current_user: auth.CurrentUser = Depends(auth.get_current_user),
) -> AssistantChatResponse:
    """Answers a free-form question about the current SOC state, grounded in
    the real alerts/cases/pending data (never invented) via Groq."""
    alerts = store.all()
    reply = assistant.chat(
        message=req.message,
        history=req.history,
        alerts=alerts,
        cases=store.all_cases(),
        pending=[a for a in alerts if a.approvalStatus.value == "Pending"],
    )
    return AssistantChatResponse(reply=reply)


# ── Shift summary report ─────────────────────────────────────────────────────
@app.get("/api/reports/shift-summary", response_model=ShiftSummaryResponse)
def reports_shift_summary(
    hours: int = 8,
    refresh: bool = False,
    current_user: auth.CurrentUser = Depends(auth.get_current_user),
) -> ShiftSummaryResponse:
    """3-4 sentence AI recap of the last `hours` (8/12/24) of alerts and
    cases, cached for 5 minutes per window so repeat page loads don't
    re-call Groq. Pass refresh=true to force a fresh call."""
    if hours not in (8, 12, 24):
        raise HTTPException(status_code=400, detail="hours must be 8, 12 or 24")
    alerts = store.all()
    summary, cached, alert_count, decision_count = shift_summary.get_summary(
        alerts, store.all_cases(), store.decisions(), hours, force_refresh=refresh
    )
    return ShiftSummaryResponse(
        summary=summary,
        windowHours=hours,
        alertCount=alert_count,
        decisionCount=decision_count,
        generatedAt=now_full(),
        cached=cached,
    )


@app.get("/api/reports/export")
def reports_export(
    hours: int = 8,
    current_user: auth.CurrentUser = Depends(auth.get_current_user),
) -> StreamingResponse:
    """Downloads the shift report (same window as the AI Shift Summary card)
    as an enterprise-style .xlsx workbook: Executive Summary (KPIs, AI recap,
    charts), Alerts, Cases, Events and Decisions sheets."""
    if hours not in (8, 12, 24):
        raise HTTPException(status_code=400, detail="hours must be 8, 12 or 24")
    alerts = store.all()
    cases = store.all_cases()
    decisions = store.decisions()
    summary, _cached, _count, _decision_count = shift_summary.get_summary(alerts, cases, decisions, hours)
    # A generous but bounded window of recent events (ordered newest-first) —
    # enough to cover any 8/12/24h window without pulling the entire history.
    recent_events = store.all_events(limit=2000)
    workbook_bytes = report_export.build_workbook(
        alerts=alerts,
        cases=cases,
        decisions=decisions,
        events=recent_events,
        hours=hours,
        summary_text=summary,
        generated_at=now_full(),
        generated_by=current_user.display_name,
    )
    filename = f"SOCore_Shift_Report_{datetime.now(timezone.utc).strftime('%Y-%m-%d')}_{hours}h.xlsx"
    return StreamingResponse(
        iter([workbook_bytes]),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
