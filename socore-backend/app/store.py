"""
Persistent store — Supabase Postgres.

Same public interface the old in-memory AlertStore had (add, decide, seed,
all, get, pending, decisions, case CRUD), so main.py needed no changes beyond
importing this module. Every write commits immediately; there is no
in-process cache, so multiple backend instances (or a restart) always see
the same data.
"""
from __future__ import annotations

import json
import threading
from datetime import datetime
from typing import Callable

from . import db
from .models import (
    Alert,
    AlertNote,
    AlertStatus,
    ApprovalStatus,
    Case,
    CaseNote,
    CaseStatus,
    CaseTask,
    DecisionRecord,
    Event,
    Profile,
    SimulationRun,
    SimulationRunStatus,
    now_full,
    now_hms,
)


def _iso(value) -> str:
    """Render a DB timestamp as real ISO 8601 (with 'T', not a space) so
    `new Date(...)` on the frontend parses it reliably — psycopg2 hands back
    a `datetime`, and `str()` on that produces a space-separated format most
    browsers don't parse consistently."""
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _row_to_alert(row: dict) -> Alert:
    return Alert(
        id=row["id"],
        timestamp=row["timestamp"],
        severity=row["severity"],
        sourceIP=row["source_ip"],
        attackType=row["attack_type"],
        mitreId=row["mitre_id"] or "",
        mitreName=row["mitre_name"] or "",
        status=row["status"],
        analyst=row["analyst"],
        raw=row["raw"] or "",
        vtScore=row["vt_score"],
        abuseScore=row["abuse_score"],
        country=row["country"] or "",
        asn=row["asn"] or "",
        detectedAt=row["detected_at"] or "",
        enrichedAt=row["enriched_at"] or "",
        respondedAt=row["responded_at"] or "",
        riskScore=row["risk_score"],
        aiExplanation=row["ai_explanation"] or "",
        aiConfidence=row["ai_confidence"],
        proposedAction=row["proposed_action"],
        approvalStatus=row["approval_status"],
        sources=row["sources"] or [],
        sourceEventId=row.get("source_event_id"),
        createdAt=_iso(row.get("created_at")),
        falsePositive=row.get("false_positive", False),
        falsePositiveReason=row.get("false_positive_reason") or "",
        falsePositiveBy=row.get("false_positive_by") or "",
        falsePositiveAt=row.get("false_positive_at") or "",
    )


def _row_to_alert_note(row: dict) -> AlertNote:
    return AlertNote(
        id=row["id"],
        alertId=row["alert_id"],
        author=row["author"],
        text=row["text"],
        createdAt=_iso(row.get("created_at")),
    )


def _row_to_event(row: dict) -> Event:
    return Event(
        id=row["id"],
        timestamp=row["timestamp"],
        sourceIP=row["source_ip"],
        ruleId=row["rule_id"] or "",
        ruleLevel=row["rule_level"],
        ruleDescription=row["rule_description"] or "",
        raw=row["raw"] or "",
        agentId=row["agent_id"] or "",
        agentName=row["agent_name"] or "",
        alertId=row["alert_id"],
        createdAt=_iso(row.get("created_at")),
    )


def _row_to_profile(row: dict) -> Profile:
    return Profile(
        id=str(row["id"]),
        email=row["email"],
        displayName=row["display_name"] or "",
        firstName=row.get("first_name") or "",
        lastName=row.get("last_name") or "",
        avatarUrl=row.get("avatar_url") or "",
        role=row["role"],
        status=row["status"],
        themePreference=row.get("theme_preference") or "dark",
        timezone=row.get("timezone") or "Asia/Baku",
        createdAt=_iso(row.get("created_at")),
    )


def _row_to_simulation_run(row: dict) -> SimulationRun:
    return SimulationRun(
        id=row["id"],
        simulationId=row["simulation_id"],
        simulationName=row["simulation_name"],
        techniqueId=row["technique_id"],
        techniqueName=row.get("technique_name"),
        tacticId=row.get("tactic_id"),
        tacticName=row.get("tactic_name"),
        platform=row.get("platform") or "",
        objective=row.get("objective") or "",
        status=row["status"],
        sourceHint=row.get("source_hint"),
        windowSeconds=row["window_seconds"],
        startedAt=_iso(row.get("started_at")),
        startedBy=row["started_by"],
        startedById=row["started_by_id"],
        executedAt=_iso(row.get("executed_at")) or None,
        completedAt=_iso(row.get("completed_at")) or None,
        detectionEventId=row.get("detection_event_id"),
        detectionAlertId=row.get("detection_alert_id"),
        detectionLatencySeconds=row.get("detection_latency_seconds"),
        notes=row.get("notes"),
    )


def _row_to_case(row: dict) -> Case:
    return Case(
        id=row["id"],
        title=row["title"],
        severity=row["severity"],
        status=row["status"],
        assignedTo=row["assigned_to"],
        createdAt=row["created_at"],
        updatedAt=row["updated_at"],
        alertIds=row["alert_ids"] or [],
        riskScore=row["risk_score"],
        summary=row["summary"] or "",
        tags=row["tags"] or [],
        tasks=[CaseTask(**t) for t in (row["tasks"] or [])],
        notes=[CaseNote(**n) for n in (row["notes"] or [])],
        alertCount=len(row["alert_ids"] or []),
    )


class AlertStore:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._seeded = False

    # ── ids ────────────────────────────────────────────────────────────────
    # Backed by the id_counters table with a single atomic UPSERT, not
    # derived from MAX(id) in the target table on every call: reading the
    # current max and inserting the row would be two separate statements, so
    # two near-simultaneous callers (e.g. Wazuh forwarding one alert twice)
    # could both read the same max and get handed the same "next" id — which
    # then silently clobbers the first alert's fields via the ON CONFLICT
    # clause in add(). A single `INSERT ... ON CONFLICT DO UPDATE ...
    # RETURNING` is atomic at the database level, so this can't race
    # regardless of thread/process count.
    #
    # The row's *first* value for a given prefix_day is seeded from
    # MAX(id) already in the target table, not hardcoded to 1 — otherwise a
    # freshly created id_counters table (as when this table was introduced)
    # starts back at 001 and collides with rows a still-running old version
    # of this code already wrote today, silently overwriting their status
    # fields instead of inserting the new alert (this happened: alerts
    # 001/002 from an earlier test never actually landed in the table).
    def _next_seq_id(self, table: str, prefix: str) -> str:
        key = f"{prefix}-{datetime.utcnow():%Y%m%d}"
        with db.get_cursor(commit=True) as cur:
            cur.execute(
                f"""
                INSERT INTO id_counters (prefix_day, seq)
                VALUES (%(key)s, COALESCE(
                    (SELECT MAX(split_part(id, '-', 3)::int) FROM {table} WHERE id LIKE %(pattern)s),
                    0
                ) + 1)
                ON CONFLICT (prefix_day) DO UPDATE SET seq = id_counters.seq + 1
                RETURNING seq
                """,
                {"key": key, "pattern": key + "-%"},
            )
            n = cur.fetchone()["seq"]
        return f"{key}-{n:03d}"

    def next_id(self) -> str:
        return self._next_seq_id("alerts", "ALT")

    def next_case_id(self) -> str:
        return self._next_seq_id("cases", "CASE")

    def next_event_id(self) -> str:
        return self._next_seq_id("events", "EVT")

    # ── alerts: writes ───────────────────────────────────────────────────
    def add(self, alert: Alert) -> Alert:
        with db.get_cursor(commit=True) as cur:
            cur.execute(
                """
                INSERT INTO alerts (
                    id, timestamp, severity, source_ip, attack_type, mitre_id, mitre_name,
                    status, analyst, raw, vt_score, abuse_score, country, asn,
                    detected_at, enriched_at, responded_at, risk_score, ai_explanation,
                    ai_confidence, proposed_action, approval_status, sources, source_event_id
                ) VALUES (
                    %(id)s, %(timestamp)s, %(severity)s, %(sourceIP)s, %(attackType)s, %(mitreId)s, %(mitreName)s,
                    %(status)s, %(analyst)s, %(raw)s, %(vtScore)s, %(abuseScore)s, %(country)s, %(asn)s,
                    %(detectedAt)s, %(enrichedAt)s, %(respondedAt)s, %(riskScore)s, %(aiExplanation)s,
                    %(aiConfidence)s, %(proposedAction)s, %(approvalStatus)s, %(sources)s, %(sourceEventId)s
                )
                ON CONFLICT (id) DO UPDATE SET
                    status = EXCLUDED.status, approval_status = EXCLUDED.approval_status,
                    analyst = EXCLUDED.analyst, responded_at = EXCLUDED.responded_at
                """,
                {
                    **alert.model_dump(),
                    "severity": alert.severity.value,
                    "status": alert.status.value,
                    "approvalStatus": alert.approvalStatus.value,
                    "proposedAction": json.dumps(alert.proposedAction.model_dump()) if alert.proposedAction else None,
                    "sources": json.dumps([s.model_dump() for s in alert.sources]),
                },
            )
        return alert

    def decide(self, alert_id: str, decision: str, reason: str, analyst: str) -> Alert | None:
        alert = self.get(alert_id)
        if alert is None:
            return None
        approved = decision.lower().startswith("app")
        new_status = AlertStatus.responding if approved else AlertStatus.resolved
        new_approval = ApprovalStatus.approved if approved else ApprovalStatus.rejected
        new_analyst = analyst if alert.analyst == "Unassigned" else alert.analyst
        responded_at = alert.respondedAt or now_hms()

        with db.get_cursor(commit=True) as cur:
            cur.execute(
                """
                UPDATE alerts SET status=%s, approval_status=%s, analyst=%s, responded_at=%s
                WHERE id=%s
                """,
                (new_status.value, new_approval.value, new_analyst, responded_at, alert_id),
            )
            cur.execute(
                "INSERT INTO decisions (alert_id, status, by_whom, at, reason) VALUES (%s,%s,%s,%s,%s)",
                (alert_id, new_approval.value, analyst, now_hms(), reason or "No reason given"),
            )
        return self.get(alert_id)

    def seed(self, make_alerts: Callable[[], list[Alert]]) -> None:
        """Only seed once — if the table already has rows (a real restart
        with persisted data), don't overwrite them with fresh sample data.
        Takes a zero-arg factory rather than an already-built list so the
        (expensive — each seed alert gets a real AI explanation call) work
        of building them only happens when the table is actually empty,
        instead of on every single startup."""
        with self._lock:
            if self._seeded:
                return
            with db.get_cursor() as cur:
                cur.execute("SELECT count(*) AS n FROM alerts")
                existing = cur.fetchone()["n"]
            if existing == 0:
                for a in make_alerts():
                    self.add(a)
            self._seeded = True

    # ── alerts: reads ────────────────────────────────────────────────────
    def all(self) -> list[Alert]:
        with db.get_cursor() as cur:
            cur.execute("SELECT * FROM alerts ORDER BY timestamp DESC")
            return [_row_to_alert(r) for r in cur.fetchall()]

    def get(self, alert_id: str) -> Alert | None:
        with db.get_cursor() as cur:
            cur.execute("SELECT * FROM alerts WHERE id=%s", (alert_id,))
            row = cur.fetchone()
            return _row_to_alert(row) if row else None

    def pending(self) -> list[Alert]:
        # A false-positive disposition takes an alert out of the decision
        # queue even if it was sitting on a still-Pending proposed action —
        # there's nothing left to approve/reject once it's been dispositioned.
        return [a for a in self.all() if a.approvalStatus == ApprovalStatus.pending and not a.falsePositive]

    def mark_false_positive(self, alert_id: str, reason: str, analyst: str) -> Alert | None:
        """Records a false-positive disposition. Distinct from decide()/
        approvalStatus: this says the detection itself wasn't real, not that
        a proposed automated response was rejected. Never deletes the alert,
        its raw event, or any prior decision — only adds to the audit trail
        (a new 'False Positive' decisions row, kept separate from
        'Approved'/'Rejected'). Idempotent: re-marking an already-dispositioned
        alert is a no-op rather than adding duplicate audit entries."""
        alert = self.get(alert_id)
        if alert is None:
            return None
        if alert.falsePositive:
            return alert
        at = now_full()
        with db.get_cursor(commit=True) as cur:
            cur.execute(
                """
                UPDATE alerts
                SET false_positive=true, false_positive_reason=%s, false_positive_by=%s,
                    false_positive_at=%s, status=%s
                WHERE id=%s
                """,
                (reason, analyst, at, AlertStatus.resolved.value, alert_id),
            )
            cur.execute(
                "INSERT INTO decisions (alert_id, status, by_whom, at, reason) VALUES (%s,%s,%s,%s,%s)",
                (alert_id, "False Positive", analyst, now_hms(), reason),
            )
        return self.get(alert_id)

    def decisions(self) -> list[DecisionRecord]:
        with db.get_cursor() as cur:
            cur.execute("SELECT * FROM decisions ORDER BY seq DESC")
            return [
                DecisionRecord(alertId=r["alert_id"], status=r["status"], by=r["by_whom"], at=r["at"], reason=r["reason"] or "")
                for r in cur.fetchall()
            ]

    # ── events: the raw Wazuh history, independent of any Alert ────────────
    def add_event(self, event: Event) -> Event:
        with db.get_cursor(commit=True) as cur:
            cur.execute(
                """
                INSERT INTO events (
                    id, timestamp, source_ip, rule_id, rule_level, rule_description,
                    raw, agent_id, agent_name, alert_id
                ) VALUES (
                    %(id)s, %(timestamp)s, %(sourceIP)s, %(ruleId)s, %(ruleLevel)s, %(ruleDescription)s,
                    %(raw)s, %(agentId)s, %(agentName)s, %(alertId)s
                )
                ON CONFLICT (id) DO NOTHING
                """,
                event.model_dump(),
            )
        return event

    def link_event_to_alert(self, event_id: str, alert_id: str) -> None:
        with db.get_cursor(commit=True) as cur:
            cur.execute("UPDATE events SET alert_id=%s WHERE id=%s", (alert_id, event_id))

    def all_events(self, limit: int = 50, offset: int = 0) -> list[Event]:
        with db.get_cursor() as cur:
            cur.execute(
                "SELECT * FROM events ORDER BY timestamp DESC, id DESC LIMIT %s OFFSET %s",
                (limit, offset),
            )
            return [_row_to_event(r) for r in cur.fetchall()]

    def count_events(self) -> int:
        with db.get_cursor() as cur:
            cur.execute("SELECT count(*) AS n FROM events")
            return cur.fetchone()["n"]

    def get_event(self, event_id: str) -> Event | None:
        with db.get_cursor() as cur:
            cur.execute("SELECT * FROM events WHERE id=%s", (event_id,))
            row = cur.fetchone()
            return _row_to_event(row) if row else None

    # ── alert notes: persistent, one row per note (not frontend-only state) ─
    def add_alert_note(self, alert_id: str, author: str, text: str) -> AlertNote:
        with db.get_cursor(commit=True) as cur:
            cur.execute(
                "INSERT INTO alert_notes (alert_id, author, text) VALUES (%s,%s,%s) RETURNING *",
                (alert_id, author, text),
            )
            row = cur.fetchone()
        return _row_to_alert_note(row)

    def alert_notes(self, alert_id: str) -> list[AlertNote]:
        with db.get_cursor() as cur:
            cur.execute(
                "SELECT * FROM alert_notes WHERE alert_id=%s ORDER BY created_at DESC",
                (alert_id,),
            )
            return [_row_to_alert_note(r) for r in cur.fetchall()]

    # ── cases ────────────────────────────────────────────────────────────
    def open_case_from_alert(self, alert_id: str, title: str | None, assigned_to: str) -> Case | None:
        alert = self.get(alert_id)
        if alert is None:
            return None
        # Full date+time, not now_hms() — createdAt/updatedAt drive
        # windowed_cases() (shift_summary.py/report_export.py), which needs a
        # real date to filter on, not just a bare time-of-day string.
        now = now_full()
        tasks = [
            {"id": "t1", "title": "Confirm the indicator against threat intel", "done": False},
            {"id": "t2", "title": "Determine scope — is only this host affected?", "done": False},
            {"id": "t3", "title": "Apply the containment action", "done": False},
            {"id": "t4", "title": "Write the closing summary", "done": False},
        ]
        case_id = self.next_case_id()
        tags = [alert.attackType, alert.mitreId] if alert.mitreId else [alert.attackType]

        with db.get_cursor(commit=True) as cur:
            cur.execute(
                """
                INSERT INTO cases (id, title, severity, status, assigned_to, created_at, updated_at,
                                    alert_ids, risk_score, summary, tags, tasks, notes)
                VALUES (%s,%s,%s,'Open',%s,%s,%s,%s,%s,%s,%s,%s,'[]')
                """,
                (
                    case_id, title or f"{alert.attackType} from {alert.sourceIP}", alert.severity.value,
                    assigned_to, now, now, json.dumps([alert_id]), alert.riskScore, alert.aiExplanation,
                    json.dumps(tags), json.dumps(tasks),
                ),
            )
            if alert.status in (AlertStatus.new, AlertStatus.enriching):
                cur.execute("UPDATE alerts SET status=%s WHERE id=%s", (AlertStatus.responding.value, alert_id))
        return self.get_case(case_id)

    def all_cases(self) -> list[Case]:
        with db.get_cursor() as cur:
            cur.execute("SELECT * FROM cases ORDER BY id DESC")
            return [_row_to_case(r) for r in cur.fetchall()]

    def get_case(self, case_id: str) -> Case | None:
        with db.get_cursor() as cur:
            cur.execute("SELECT * FROM cases WHERE id=%s", (case_id,))
            row = cur.fetchone()
            return _row_to_case(row) if row else None

    def get_case_for_alert(self, alert_id: str) -> Case | None:
        """Most recent case that already links this alert, if any — used to
        make 'Escalate to Case' idempotent per alert (a double-click, or two
        analysts escalating the same alert, must not create two cases)."""
        with db.get_cursor() as cur:
            cur.execute(
                "SELECT * FROM cases WHERE alert_ids @> %s::jsonb ORDER BY id DESC LIMIT 1",
                (json.dumps([alert_id]),),
            )
            row = cur.fetchone()
            return _row_to_case(row) if row else None

    def update_case(self, case_id: str, status: CaseStatus | None, assigned_to: str | None) -> Case | None:
        case = self.get_case(case_id)
        if case is None:
            return None
        with db.get_cursor(commit=True) as cur:
            if status is not None:
                cur.execute("UPDATE cases SET status=%s, updated_at=%s WHERE id=%s", (status.value, now_full(), case_id))
                if status in (CaseStatus.closed, CaseStatus.contained):
                    cur.execute(
                        "UPDATE alerts SET status=%s WHERE id = ANY(%s)",
                        (AlertStatus.resolved.value, case.alertIds),
                    )
            if assigned_to is not None:
                cur.execute("UPDATE cases SET assigned_to=%s, updated_at=%s WHERE id=%s", (assigned_to, now_full(), case_id))
        return self.get_case(case_id)

    def add_case_note(self, case_id: str, author: str, text: str) -> Case | None:
        case = self.get_case(case_id)
        if case is None:
            return None
        notes = [n.model_dump() for n in case.notes]
        notes.insert(0, {"author": author, "text": text, "at": now_hms()})
        with db.get_cursor(commit=True) as cur:
            cur.execute("UPDATE cases SET notes=%s, updated_at=%s WHERE id=%s", (json.dumps(notes), now_full(), case_id))
        return self.get_case(case_id)

    def toggle_task(self, case_id: str, task_id: str) -> Case | None:
        case = self.get_case(case_id)
        if case is None:
            return None
        tasks = [t.model_dump() for t in case.tasks]
        for t in tasks:
            if t["id"] == task_id:
                t["done"] = not t["done"]
        with db.get_cursor(commit=True) as cur:
            cur.execute("UPDATE cases SET tasks=%s, updated_at=%s WHERE id=%s", (json.dumps(tasks), now_full(), case_id))
        return self.get_case(case_id)


    # ── simulation center: controlled detection-validation runs ────────────
    def next_simulation_run_id(self) -> str:
        return self._next_seq_id("simulation_runs", "SIMRUN")

    def start_simulation_run(
        self,
        *,
        simulation_id: str,
        simulation_name: str,
        technique_id: str,
        technique_name: str | None,
        tactic_id: str | None,
        tactic_name: str | None,
        platform: str,
        objective: str,
        source_hint: str | None,
        window_seconds: int,
        started_by: str,
        started_by_id: str,
    ) -> SimulationRun:
        run_id = self.next_simulation_run_id()
        with db.get_cursor(commit=True) as cur:
            cur.execute(
                """
                INSERT INTO simulation_runs (
                    id, simulation_id, simulation_name, technique_id, technique_name,
                    tactic_id, tactic_name, platform, objective, status,
                    source_hint, window_seconds, started_by, started_by_id
                ) VALUES (
                    %(id)s, %(simulationId)s, %(simulationName)s, %(techniqueId)s, %(techniqueName)s,
                    %(tacticId)s, %(tacticName)s, %(platform)s, %(objective)s, 'running',
                    %(sourceHint)s, %(windowSeconds)s, %(startedBy)s, %(startedById)s
                )
                """,
                {
                    "id": run_id,
                    "simulationId": simulation_id,
                    "simulationName": simulation_name,
                    "techniqueId": technique_id,
                    "techniqueName": technique_name,
                    "tacticId": tactic_id,
                    "tacticName": tactic_name,
                    "platform": platform,
                    "objective": objective,
                    "sourceHint": source_hint,
                    "windowSeconds": window_seconds,
                    "startedBy": started_by,
                    "startedById": started_by_id,
                },
            )
        run = self.get_simulation_run(run_id)
        assert run is not None
        return run

    def get_simulation_run(self, run_id: str) -> SimulationRun | None:
        with db.get_cursor() as cur:
            cur.execute("SELECT * FROM simulation_runs WHERE id=%s", (run_id,))
            row = cur.fetchone()
            return _row_to_simulation_run(row) if row else None

    def mark_run_executed(self, run_id: str) -> SimulationRun | None:
        with db.get_cursor(commit=True) as cur:
            cur.execute(
                "UPDATE simulation_runs SET executed_at=now() WHERE id=%s AND executed_at IS NULL",
                (run_id,),
            )
        return self.get_simulation_run(run_id)

    def finalize_simulation_run(
        self,
        run_id: str,
        *,
        status: SimulationRunStatus,
        detection_event_id: str | None = None,
        detection_alert_id: str | None = None,
        detection_latency_seconds: int | None = None,
    ) -> SimulationRun | None:
        with db.get_cursor(commit=True) as cur:
            cur.execute(
                """
                UPDATE simulation_runs
                SET status=%s, detection_event_id=%s, detection_alert_id=%s,
                    detection_latency_seconds=%s, completed_at=now()
                WHERE id=%s
                """,
                (status.value, detection_event_id, detection_alert_id, detection_latency_seconds, run_id),
            )
        return self.get_simulation_run(run_id)

    def all_simulation_runs(
        self,
        *,
        simulation_id: str | None = None,
        technique_id: str | None = None,
        status: str | None = None,
        platform: str | None = None,
        limit: int = 200,
    ) -> list[SimulationRun]:
        clauses, params = [], {}
        if simulation_id:
            clauses.append("simulation_id = %(simulation_id)s")
            params["simulation_id"] = simulation_id
        if technique_id:
            # Base-normalized: a run recorded against a sub-technique (e.g.
            # T1110.001) must still surface when something queries by the
            # base id (e.g. an alert whose mitre_id is only ever "T1110") —
            # same normalization mitre.py and alerts_for_technique_base use.
            clauses.append("split_part(technique_id, '.', 1) = split_part(%(technique_id)s, '.', 1)")
            params["technique_id"] = technique_id
        if status:
            clauses.append("status = %(status)s")
            params["status"] = status
        if platform:
            clauses.append("platform = %(platform)s")
            params["platform"] = platform
        where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
        with db.get_cursor() as cur:
            cur.execute(
                f"SELECT * FROM simulation_runs {where} ORDER BY started_at DESC LIMIT %(limit)s",
                {**params, "limit": limit},
            )
            return [_row_to_simulation_run(r) for r in cur.fetchall()]

    def runs_for_technique_base(self, technique_base: str) -> list[SimulationRun]:
        """Matches both the exact id and any of its sub-techniques (T1110 also
        catches runs recorded against T1110.001)."""
        with db.get_cursor() as cur:
            cur.execute(
                "SELECT * FROM simulation_runs WHERE technique_id = %s OR technique_id LIKE %s "
                "ORDER BY started_at DESC",
                (technique_base, technique_base + ".%"),
            )
            return [_row_to_simulation_run(r) for r in cur.fetchall()]

    def running_simulation_runs(self) -> list[SimulationRun]:
        with db.get_cursor() as cur:
            cur.execute("SELECT * FROM simulation_runs WHERE status='running'")
            return [_row_to_simulation_run(r) for r in cur.fetchall()]

    def events_created_since(self, since_iso: str, source_hint: str | None = None) -> list[Event]:
        """Raw events ingested (by DB clock, not the Wazuh-reported timestamp)
        at or after `since_iso` — the window a simulation run's evaluator
        searches for evidence. Optionally narrowed to a source IP or agent
        name the analyst supplied when starting the run."""
        clauses = ["created_at >= %(since)s"]
        params: dict = {"since": since_iso}
        if source_hint:
            clauses.append("(source_ip = %(hint)s OR agent_name = %(hint)s OR agent_id = %(hint)s)")
            params["hint"] = source_hint
        with db.get_cursor() as cur:
            cur.execute(
                f"SELECT * FROM events WHERE {' AND '.join(clauses)} ORDER BY created_at ASC",
                params,
            )
            return [_row_to_event(r) for r in cur.fetchall()]

    def alert_coverage_by_technique(self) -> dict[str, dict]:
        """One grouped query for the whole ATT&CK matrix instead of an N+1 —
        keyed by the technique's base id (T1110.001 and T1110 both roll up
        under 'T1110', matching what Wazuh actually reports)."""
        with db.get_cursor() as cur:
            cur.execute(
                """
                SELECT
                    split_part(mitre_id, '.', 1) AS technique_base,
                    count(*) AS alert_count,
                    min(timestamp) AS first_detected,
                    max(timestamp) AS last_detected,
                    array_agg(DISTINCT severity) AS severities
                FROM alerts
                WHERE mitre_id IS NOT NULL AND mitre_id <> ''
                GROUP BY split_part(mitre_id, '.', 1)
                """
            )
            return {r["technique_base"]: dict(r) for r in cur.fetchall()}

    def alerts_for_technique_base(self, technique_base: str, limit: int = 25) -> list[Alert]:
        with db.get_cursor() as cur:
            cur.execute(
                "SELECT * FROM alerts WHERE split_part(mitre_id, '.', 1) = %s "
                "ORDER BY timestamp DESC LIMIT %s",
                (technique_base, limit),
            )
            return [_row_to_alert(r) for r in cur.fetchall()]

    def events_for_ids(self, event_ids: list[str]) -> list[Event]:
        if not event_ids:
            return []
        with db.get_cursor() as cur:
            cur.execute(
                "SELECT * FROM events WHERE id = ANY(%s) ORDER BY created_at DESC",
                (event_ids,),
            )
            return [_row_to_event(r) for r in cur.fetchall()]

    # ── profiles: registration approval, roles, personalization ────────────
    def all_profiles(self) -> list[Profile]:
        with db.get_cursor() as cur:
            cur.execute("SELECT * FROM profiles ORDER BY created_at DESC")
            return [_row_to_profile(r) for r in cur.fetchall()]

    def get_profile(self, user_id: str) -> Profile | None:
        with db.get_cursor() as cur:
            cur.execute("SELECT * FROM profiles WHERE id=%s", (user_id,))
            row = cur.fetchone()
            return _row_to_profile(row) if row else None

    def count_pending_profiles(self) -> int:
        with db.get_cursor() as cur:
            cur.execute("SELECT count(*) AS n FROM profiles WHERE status='pending'")
            return cur.fetchone()["n"]

    def set_profile_status(self, user_id: str, new_status: str) -> Profile | None:
        with db.get_cursor(commit=True) as cur:
            cur.execute("UPDATE profiles SET status=%s WHERE id=%s", (new_status, user_id))
        return self.get_profile(user_id)

    def set_profile_role(self, user_id: str, new_role: str) -> Profile | None:
        with db.get_cursor(commit=True) as cur:
            cur.execute("UPDATE profiles SET role=%s WHERE id=%s", (new_role, user_id))
        return self.get_profile(user_id)

    def update_profile(
        self,
        user_id: str,
        first_name: str | None = None,
        last_name: str | None = None,
        avatar_url: str | None = None,
        theme_preference: str | None = None,
        timezone: str | None = None,
    ) -> Profile | None:
        fields, values = [], []
        for column, value in (
            ("first_name", first_name),
            ("last_name", last_name),
            ("avatar_url", avatar_url),
            ("theme_preference", theme_preference),
            ("timezone", timezone),
        ):
            if value is not None:
                fields.append(f"{column}=%s")
                values.append(value)
        if fields:
            values.append(user_id)
            with db.get_cursor(commit=True) as cur:
                cur.execute(f"UPDATE profiles SET {', '.join(fields)} WHERE id=%s", values)
        return self.get_profile(user_id)


store = AlertStore()
