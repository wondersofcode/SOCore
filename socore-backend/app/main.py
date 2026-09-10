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

import logging

from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from . import actions, ai_explainer, auth, db, enrichment
from .correlation import correlate
from .models import (
    AddNoteRequest,
    Alert,
    ApprovalDecision,
    Case,
    CreateCaseRequest,
    Event,
    Profile,
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
    store.seed(seed_alerts())
    logger.info("Seeded/verified alerts. AI live: %s", ai_explainer.is_live())


# ── Health / status ─────────────────────────────────────────────────────────
@app.get("/api/health")
def health() -> dict:
    return {
        "status": "ok",
        "aiLive": ai_explainer.is_live(),
        "alerts": len(store.all()),
        "pending": len(store.pending()),
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
def ingest(event: WazuhEvent) -> Alert:
    """
    Entry point for the detection layer. Wazuh's integration script POSTs an
    event here. If the event doesn't already carry reputation scores, we run
    it through MISP + Cortex ourselves before scoring — this is what actually
    exercises the threat-intel stack rather than trusting whatever numbers
    Wazuh sent. Enrichment is best-effort and time-boxed: a slow or
    unconfigured MISP/Cortex never blocks the response to Wazuh.
    """
    from .correlation import _is_internal  # local import avoids a cycle at module load

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
def list_alerts() -> list[Alert]:
    return store.all()


@app.get("/api/alerts/{alert_id}", response_model=Alert)
def get_alert(alert_id: str) -> Alert:
    alert = store.get(alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    return alert


@app.get("/api/pending", response_model=list[Alert])
def list_pending() -> list[Alert]:
    return store.pending()


# ── Raw event history — independent of whatever Alert an event became ──────
@app.get("/api/events", response_model=list[Event])
def list_events(limit: int = 50, offset: int = 0) -> list[Event]:
    limit = max(1, min(limit, 200))
    return store.all_events(limit=limit, offset=offset)


@app.get("/api/events/{event_id}", response_model=Event)
def get_event(event_id: str) -> Event:
    event = store.get_event(event_id)
    if event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return event


@app.get("/api/decisions")
def list_decisions() -> list:
    return store.decisions()


# ── Human-in-the-loop decision ──────────────────────────────────────────────
@app.post("/api/approve/{alert_id}", response_model=Alert)
def approve(
    alert_id: str,
    decision: ApprovalDecision,
    current_user: auth.CurrentUser = Depends(auth.get_current_user),
) -> Alert:
    """
    The dashboard's Approve/Reject buttons call this. Approving runs the
    proposed playbook (dry-run firewall block + Slack), rejecting closes the
    alert with no network change. Either way the decision is audited under
    the authenticated caller's identity, not whatever the client claims.
    """
    alert = store.get(alert_id)
    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")

    updated = store.decide(alert_id, decision.decision, decision.reason, current_user.display_name)
    assert updated is not None

    if updated.approvalStatus.value == "Approved" and updated.proposedAction:
        result = actions.block_ip(updated.proposedAction.target, dry_run=updated.proposedAction.dryRun)
        actions.send_slack_alert(
            f"{current_user.display_name} approved: {updated.proposedAction.action} "
            f"on {updated.proposedAction.target} — {result['status']}"
        )
        logger.info("Approved %s -> %s", alert_id, result)
    else:
        actions.send_slack_alert(f"{current_user.display_name} rejected the action on {updated.sourceIP}")
        logger.info("Rejected %s", alert_id)

    return updated


# ── Case management (in-house replacement for TheHive) ──────────────────────
# TheHive 4's Docker images are no longer published and TheHive 5 requires a
# commercial license after a 14-day trial. Case tracking is handled here
# instead: same shape the dashboard's CaseManagement screen expects, with no
# external dependency or license risk.

@app.get("/api/cases", response_model=list[Case])
def list_cases() -> list[Case]:
    return store.all_cases()


@app.get("/api/cases/{case_id}", response_model=Case)
def get_case(case_id: str) -> Case:
    case = store.get_case(case_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return case


@app.post("/api/cases", response_model=Case)
def create_case(
    req: CreateCaseRequest,
    current_user: auth.CurrentUser = Depends(auth.get_current_user),
) -> Case:
    """Open a case from an alert — the analyst's 'Escalate to case' action."""
    case = store.open_case_from_alert(req.alertId, req.title, current_user.display_name)
    if case is None:
        raise HTTPException(status_code=404, detail="Alert not found")
    actions.send_slack_alert(f"Case {case.id} opened by {current_user.display_name}: {case.title}")
    logger.info("Opened case %s from alert %s", case.id, req.alertId)
    return case


@app.patch("/api/cases/{case_id}", response_model=Case)
def update_case(case_id: str, req: UpdateCaseRequest) -> Case:
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
def toggle_case_task(case_id: str, task_id: str) -> Case:
    case = store.toggle_task(case_id, task_id)
    if case is None:
        raise HTTPException(status_code=404, detail="Case not found")
    return case
