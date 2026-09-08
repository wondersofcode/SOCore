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
from itertools import count

from . import db
from .models import (
    Alert,
    AlertStatus,
    ApprovalStatus,
    Case,
    CaseNote,
    CaseStatus,
    CaseTask,
    DecisionRecord,
    now_hms,
)


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
        self._seq = count(1)
        self._case_seq = count(1)
        self._lock = threading.Lock()
        self._seeded = False

    # ── ids ────────────────────────────────────────────────────────────────
    def next_id(self) -> str:
        n = next(self._seq)
        return f"ALT-{datetime.utcnow():%Y%m%d}-{n:03d}"

    def next_case_id(self) -> str:
        n = next(self._case_seq)
        return f"CASE-{datetime.utcnow():%Y%m%d}-{n:03d}"

    # ── alerts: writes ───────────────────────────────────────────────────
    def add(self, alert: Alert) -> Alert:
        with db.get_cursor(commit=True) as cur:
            cur.execute(
                """
                INSERT INTO alerts (
                    id, timestamp, severity, source_ip, attack_type, mitre_id, mitre_name,
                    status, analyst, raw, vt_score, abuse_score, country, asn,
                    detected_at, enriched_at, responded_at, risk_score, ai_explanation,
                    ai_confidence, proposed_action, approval_status, sources
                ) VALUES (
                    %(id)s, %(timestamp)s, %(severity)s, %(sourceIP)s, %(attackType)s, %(mitreId)s, %(mitreName)s,
                    %(status)s, %(analyst)s, %(raw)s, %(vtScore)s, %(abuseScore)s, %(country)s, %(asn)s,
                    %(detectedAt)s, %(enrichedAt)s, %(respondedAt)s, %(riskScore)s, %(aiExplanation)s,
                    %(aiConfidence)s, %(proposedAction)s, %(approvalStatus)s, %(sources)s
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

    def seed(self, alerts: list[Alert]) -> None:
        """Only seed once — if the table already has rows (a real restart
        with persisted data), don't overwrite them with fresh sample data."""
        with self._lock:
            if self._seeded:
                return
            with db.get_cursor() as cur:
                cur.execute("SELECT count(*) AS n FROM alerts")
                existing = cur.fetchone()["n"]
            if existing == 0:
                for a in alerts:
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
        return [a for a in self.all() if a.approvalStatus == ApprovalStatus.pending]

    def decisions(self) -> list[DecisionRecord]:
        with db.get_cursor() as cur:
            cur.execute("SELECT * FROM decisions ORDER BY seq DESC")
            return [
                DecisionRecord(alertId=r["alert_id"], status=r["status"], by=r["by_whom"], at=r["at"], reason=r["reason"] or "")
                for r in cur.fetchall()
            ]

    # ── cases ────────────────────────────────────────────────────────────
    def open_case_from_alert(self, alert_id: str, title: str | None, assigned_to: str) -> Case | None:
        alert = self.get(alert_id)
        if alert is None:
            return None
        now = now_hms()
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

    def update_case(self, case_id: str, status: CaseStatus | None, assigned_to: str | None) -> Case | None:
        case = self.get_case(case_id)
        if case is None:
            return None
        with db.get_cursor(commit=True) as cur:
            if status is not None:
                cur.execute("UPDATE cases SET status=%s, updated_at=%s WHERE id=%s", (status.value, now_hms(), case_id))
                if status in (CaseStatus.closed, CaseStatus.contained):
                    cur.execute(
                        "UPDATE alerts SET status=%s WHERE id = ANY(%s)",
                        (AlertStatus.resolved.value, case.alertIds),
                    )
            if assigned_to is not None:
                cur.execute("UPDATE cases SET assigned_to=%s, updated_at=%s WHERE id=%s", (assigned_to, now_hms(), case_id))
        return self.get_case(case_id)

    def add_case_note(self, case_id: str, author: str, text: str) -> Case | None:
        case = self.get_case(case_id)
        if case is None:
            return None
        notes = [n.model_dump() for n in case.notes]
        notes.insert(0, {"author": author, "text": text, "at": now_hms()})
        with db.get_cursor(commit=True) as cur:
            cur.execute("UPDATE cases SET notes=%s, updated_at=%s WHERE id=%s", (json.dumps(notes), now_hms(), case_id))
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
            cur.execute("UPDATE cases SET tasks=%s, updated_at=%s WHERE id=%s", (json.dumps(tasks), now_hms(), case_id))
        return self.get_case(case_id)


store = AlertStore()
