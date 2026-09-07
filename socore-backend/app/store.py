"""
In-memory store.

Keeps alerts and the audit trail for the running session. This is intentionally
simple — a dict, not a database — because the project's goal is the detect→
enrich→respond→track flow, not persistence. Swapping this for SQLite or Postgres
later means implementing the same four methods.
"""
from __future__ import annotations

import threading
from itertools import count

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


class AlertStore:
    def __init__(self) -> None:
        self._alerts: dict[str, Alert] = {}
        self._decisions: list[DecisionRecord] = []
        self._cases: dict[str, Case] = {}
        self._case_seq = count(1)
        self._seq = count(1)
        self._lock = threading.Lock()

    # ── ids ────────────────────────────────────────────────────────────────
    def next_id(self) -> str:
        from datetime import datetime
        n = next(self._seq)
        return f"ALT-{datetime.utcnow():%Y%m%d}-{n:03d}"

    # ── writes ──────────────────────────────────────────────────────────────
    def add(self, alert: Alert) -> Alert:
        with self._lock:
            self._alerts[alert.id] = alert
        return alert

    def decide(self, alert_id: str, decision: str, reason: str, analyst: str) -> Alert | None:
        with self._lock:
            alert = self._alerts.get(alert_id)
            if alert is None:
                return None
            approved = decision.lower().startswith("app")
            alert.approvalStatus = ApprovalStatus.approved if approved else ApprovalStatus.rejected
            # Approving runs the playbook; rejecting closes the alert out.
            alert.status = AlertStatus.responding if approved else AlertStatus.resolved
            if alert.analyst == "Unassigned":
                alert.analyst = analyst
            alert.respondedAt = alert.respondedAt or now_hms()
            self._decisions.insert(0, DecisionRecord(
                alertId=alert_id,
                status=alert.approvalStatus.value,
                by=analyst,
                at=now_hms(),
                reason=reason or "No reason given",
            ))
            return alert

    def seed(self, alerts: list[Alert]) -> None:
        with self._lock:
            for a in alerts:
                self._alerts[a.id] = a

    # ── reads ───────────────────────────────────────────────────────────────
    def all(self) -> list[Alert]:
        return sorted(self._alerts.values(), key=lambda a: a.timestamp, reverse=True)

    def get(self, alert_id: str) -> Alert | None:
        return self._alerts.get(alert_id)

    def pending(self) -> list[Alert]:
        return [a for a in self.all() if a.approvalStatus == ApprovalStatus.pending]

    def decisions(self) -> list[DecisionRecord]:
        return list(self._decisions)

    # ── cases (replaces TheHive) ───────────────────────────────────────────
    def next_case_id(self) -> str:
        from datetime import datetime
        n = next(self._case_seq)
        return f"CASE-{datetime.utcnow():%Y%m%d}-{n:03d}"

    def open_case_from_alert(self, alert_id: str, title: str | None, assigned_to: str) -> Case | None:
        alert = self.get(alert_id)
        if alert is None:
            return None
        now = now_hms()
        default_tasks = [
            CaseTask(id="t1", title="Confirm the indicator against threat intel"),
            CaseTask(id="t2", title="Determine scope — is only this host affected?"),
            CaseTask(id="t3", title="Apply the containment action"),
            CaseTask(id="t4", title="Write the closing summary"),
        ]
        case = Case(
            id=self.next_case_id(),
            title=title or f"{alert.attackType} from {alert.sourceIP}",
            severity=alert.severity,
            status=CaseStatus.open,
            assignedTo=assigned_to,
            createdAt=now,
            updatedAt=now,
            alertIds=[alert_id],
            riskScore=alert.riskScore,
            summary=alert.aiExplanation,
            tags=[alert.attackType, alert.mitreId] if alert.mitreId else [alert.attackType],
            tasks=default_tasks,
        )
        with self._lock:
            self._cases[case.id] = case
            # Linking an alert to a case marks it as being actively worked.
            if alert.status == AlertStatus.enriching or alert.status == AlertStatus.new:
                alert.status = AlertStatus.responding
        return case

    def all_cases(self) -> list[Case]:
        return sorted(self._cases.values(), key=lambda c: c.id, reverse=True)

    def get_case(self, case_id: str) -> Case | None:
        return self._cases.get(case_id)

    def update_case(self, case_id: str, status: CaseStatus | None, assigned_to: str | None) -> Case | None:
        with self._lock:
            case = self._cases.get(case_id)
            if case is None:
                return None
            if status is not None:
                case.status = status
                # Closing or containing a case resolves the alerts it covers.
                if status in (CaseStatus.closed, CaseStatus.contained):
                    for aid in case.alertIds:
                        a = self._alerts.get(aid)
                        if a:
                            a.status = AlertStatus.resolved
            if assigned_to is not None:
                case.assignedTo = assigned_to
            case.updatedAt = now_hms()
            return case

    def add_case_note(self, case_id: str, author: str, text: str) -> Case | None:
        with self._lock:
            case = self._cases.get(case_id)
            if case is None:
                return None
            case.notes.insert(0, CaseNote(author=author, text=text, at=now_hms()))
            case.updatedAt = now_hms()
            return case

    def toggle_task(self, case_id: str, task_id: str) -> Case | None:
        with self._lock:
            case = self._cases.get(case_id)
            if case is None:
                return None
            for t in case.tasks:
                if t.id == task_id:
                    t.done = not t.done
            case.updatedAt = now_hms()
            return case


store = AlertStore()
