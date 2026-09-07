"""
Data models for the SOCore backend.

These mirror the shape the dashboard already expects (see the frontend's
data.ts). Keeping the field names identical means the UI can point at this API
without any changes on the frontend side.
"""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


# ── Enumerations ────────────────────────────────────────────────────────────
class Severity(str, Enum):
    critical = "Critical"
    high = "High"
    medium = "Medium"
    low = "Low"
    informational = "Informational"


class AlertStatus(str, Enum):
    new = "New"
    enriching = "Enriching"
    responding = "Responding"
    resolved = "Resolved"


class ApprovalStatus(str, Enum):
    none = "None"
    pending = "Pending"
    approved = "Approved"
    rejected = "Rejected"


class SourceStatus(str, Enum):
    hit = "hit"
    clean = "clean"
    pending = "pending"
    skipped = "skipped"


# ── Nested structures ───────────────────────────────────────────────────────
class EnrichmentSource(BaseModel):
    name: str
    status: SourceStatus
    detail: str
    at: str = "—"


class ProposedAction(BaseModel):
    action: str
    target: str
    playbook: str
    dryRun: bool = True


# ── The Wazuh event that arrives on the webhook ─────────────────────────────
class WazuhEvent(BaseModel):
    """
    A trimmed view of a Wazuh alert. Wazuh sends a large nested JSON; the
    integration script forwards only the fields we score on. Everything is
    optional so a partial event never crashes the endpoint.
    """
    source_ip: str = Field(default="0.0.0.0")
    attack_type: str = Field(default="Unknown")
    mitre_id: str = Field(default="")
    mitre_name: str = Field(default="")
    rule_level: int = Field(default=5, description="Wazuh rule level 0-15")
    rule_description: str = Field(default="")
    country: str = Field(default="")
    asn: str = Field(default="")
    raw: str = Field(default="")
    # Optional reputation, if an enrichment step already ran upstream.
    vt_score: Optional[int] = None
    abuse_score: Optional[int] = None
    timestamp: Optional[str] = None


# ── The alert object the dashboard consumes ─────────────────────────────────
class Alert(BaseModel):
    id: str
    timestamp: str
    severity: Severity
    sourceIP: str
    attackType: str
    mitreId: str
    mitreName: str
    status: AlertStatus
    analyst: str = "Unassigned"
    raw: str = ""
    vtScore: int = 0
    abuseScore: int = 0
    country: str = ""
    asn: str = ""
    detectedAt: str = ""
    enrichedAt: str = ""
    respondedAt: str = ""
    riskScore: int = 0
    aiExplanation: str = ""
    aiConfidence: int = 0
    proposedAction: Optional[ProposedAction] = None
    approvalStatus: ApprovalStatus = ApprovalStatus.none
    sources: list[EnrichmentSource] = Field(default_factory=list)


# ── Case management (replaces TheHive) ──────────────────────────────────────
class CaseStatus(str, Enum):
    open = "Open"
    investigating = "Investigating"
    contained = "Contained"
    closed = "Closed"


class CaseTask(BaseModel):
    id: str
    title: str
    done: bool = False


class CaseNote(BaseModel):
    author: str
    text: str
    at: str


class Case(BaseModel):
    id: str
    title: str
    severity: Severity
    status: CaseStatus = CaseStatus.open
    assignedTo: str = "Unassigned"
    createdAt: str
    updatedAt: str
    alertIds: list[str] = Field(default_factory=list)
    riskScore: int = 0
    summary: str = ""
    tags: list[str] = Field(default_factory=list)
    tasks: list[CaseTask] = Field(default_factory=list)
    notes: list[CaseNote] = Field(default_factory=list)


class CreateCaseRequest(BaseModel):
    alertId: str
    title: str | None = None
    assignedTo: str = "Unassigned"


class UpdateCaseRequest(BaseModel):
    status: CaseStatus | None = None
    assignedTo: str | None = None


class AddNoteRequest(BaseModel):
    author: str
    text: str


# ── Request/response bodies ─────────────────────────────────────────────────
class ApprovalDecision(BaseModel):
    decision: str = Field(description="'approve' or 'reject'")
    reason: str = ""
    analyst: str = "K. Osei"


class DecisionRecord(BaseModel):
    alertId: str
    status: str
    by: str
    at: str
    reason: str


def now_hms() -> str:
    return datetime.utcnow().strftime("%H:%M:%S")


def now_full() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")
