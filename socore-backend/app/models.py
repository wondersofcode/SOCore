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
    rule_id: str = Field(default="")
    rule_level: int = Field(default=5, description="Wazuh rule level 0-15")
    rule_description: str = Field(default="")
    agent_id: str = Field(default="")
    agent_name: str = Field(default="")
    country: str = Field(default="")
    asn: str = Field(default="")
    raw: str = Field(default="")
    # Optional reputation, if an enrichment step already ran upstream.
    vt_score: Optional[int] = None
    abuse_score: Optional[int] = None
    timestamp: Optional[str] = None


# ── The raw event, stored independently of whatever Alert it becomes ───────
class Event(BaseModel):
    id: str
    timestamp: str
    sourceIP: str
    ruleId: str = ""
    ruleLevel: int = 0
    ruleDescription: str = ""
    raw: str = ""
    agentId: str = ""
    agentName: str = ""
    alertId: Optional[str] = None
    # When this row was actually inserted (DB clock, not the Wazuh-reported
    # `timestamp`) — the honest signal for "how long did ingestion take",
    # since `timestamp` is copied verbatim from the source event.
    createdAt: str = ""


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
    # The raw Wazuh event this alert was scored from, if any (seed/mock
    # alerts have none). Lets the dashboard link back to the untouched event.
    sourceEventId: Optional[str] = None
    # When this row was actually inserted (DB clock). Paired with the source
    # event's own createdAt, this is the real elapsed time the ingest/enrich/
    # explain pipeline took for this alert — unlike `timestamp`/`detectedAt`,
    # which are both copied from the same source string and never differ.
    createdAt: str = ""


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
    alertCount: int = 0


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


# ── User profiles (registration approval, roles, personalization) ──────────
class ProfileStatus(str, Enum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class ProfileRole(str, Enum):
    l1_analyst = "l1_analyst"
    l2_analyst = "l2_analyst"
    admin = "admin"


class Profile(BaseModel):
    id: str
    email: str
    displayName: str = ""
    firstName: str = ""
    lastName: str = ""
    avatarUrl: str = ""
    role: ProfileRole
    status: ProfileStatus
    themePreference: str = "dark"
    timezone: str = "Asia/Baku"
    createdAt: str = ""


class UpdateRoleRequest(BaseModel):
    role: ProfileRole


class UpdateProfileRequest(BaseModel):
    firstName: Optional[str] = None
    lastName: Optional[str] = None
    avatarUrl: Optional[str] = None
    themePreference: Optional[str] = None
    timezone: Optional[str] = None


def now_hms() -> str:
    return datetime.utcnow().strftime("%H:%M:%S")


def now_full() -> str:
    return datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S")


# ── AI assistant chat ────────────────────────────────────────────────────────
class ChatMessage(BaseModel):
    role: str = Field(description="'user' or 'assistant'")
    content: str


class AssistantChatRequest(BaseModel):
    message: str
    history: list[ChatMessage] = Field(default_factory=list)


class AssistantChatResponse(BaseModel):
    reply: str


# ── Shift summary report ─────────────────────────────────────────────────────
class ShiftSummaryResponse(BaseModel):
    summary: str
    windowHours: int
    alertCount: int
    generatedAt: str
    cached: bool


# ── MITRE ATT&CK Center ──────────────────────────────────────────────────────
class TechniqueCoverageStatus(str, Enum):
    detected = "detected"
    testing = "testing"
    tested_passed = "tested_passed"
    tested_failed = "tested_failed"
    not_tested = "not_tested"


class TechniqueCoverage(BaseModel):
    id: str
    name: str
    tacticId: str
    tacticName: str
    status: TechniqueCoverageStatus
    alertCount: int = 0
    firstDetected: Optional[str] = None
    lastDetected: Optional[str] = None
    highestSeverity: Optional[Severity] = None
    simulationRuns: int = 0
    simulationPassed: int = 0
    simulationFailed: int = 0
    lastTested: Optional[str] = None
    detectionSuccessRate: Optional[float] = None


class MitreTactic(BaseModel):
    id: str
    name: str
    techniques: list[TechniqueCoverage]


class MitreCoverageSummary(BaseModel):
    totalTechniques: int
    detectedTechniques: int
    testedTechniques: int
    notTestedTechniques: int
    failedTests: int
    highRiskGaps: int
    coveragePercent: float


class MitreCenterResponse(BaseModel):
    summary: MitreCoverageSummary
    tactics: list[MitreTactic]


class RelatedAlertSummary(BaseModel):
    id: str
    timestamp: str
    severity: Severity
    sourceIP: str
    attackType: str
    riskScore: int
    approvalStatus: ApprovalStatus
    aiExplanation: str = ""
    proposedAction: Optional[ProposedAction] = None
    respondedAt: str = ""
    sourceEventId: Optional[str] = None


class RelatedCaseSummary(BaseModel):
    id: str
    title: str
    status: CaseStatus
    severity: Severity


class RelatedEventSummary(BaseModel):
    id: str
    timestamp: str
    sourceIP: str
    agentName: str
    ruleId: str
    ruleDescription: str
    alertId: Optional[str] = None


class RelatedRuleSummary(BaseModel):
    ruleId: str
    ruleDescription: str
    occurrences: int


class TechniqueDetail(BaseModel):
    id: str
    name: str
    tacticId: str
    tacticName: str
    description: str = ""
    coverage: TechniqueCoverage
    relatedAlerts: list[RelatedAlertSummary] = Field(default_factory=list)
    relatedCases: list[RelatedCaseSummary] = Field(default_factory=list)
    relatedEvents: list[RelatedEventSummary] = Field(default_factory=list)
    affectedHosts: list[str] = Field(default_factory=list)
    relatedRules: list[RelatedRuleSummary] = Field(default_factory=list)
    relatedSimulationRuns: list["SimulationRun"] = Field(default_factory=list)


# ── Simulation Center ────────────────────────────────────────────────────────
class SimulationRunStatus(str, Enum):
    running = "running"
    passed = "passed"
    partial = "partial"
    failed = "failed"
    not_observed = "not_observed"


class SimulationDefinitionOut(BaseModel):
    id: str
    name: str
    description: str
    techniqueId: str
    techniqueName: Optional[str] = None
    tacticId: Optional[str] = None
    tacticName: Optional[str] = None
    platform: str
    objective: str
    instructions: list[str]
    detectionHint: str
    defaultWindowSeconds: int
    custom: bool
    # Aggregated from real simulation_runs rows for this definition.
    totalRuns: int = 0
    passedRuns: int = 0
    failedRuns: int = 0
    lastRun: Optional[str] = None
    lastResult: Optional[SimulationRunStatus] = None


class SimulationRun(BaseModel):
    id: str
    simulationId: str
    simulationName: str
    techniqueId: str
    techniqueName: Optional[str] = None
    tacticId: Optional[str] = None
    tacticName: Optional[str] = None
    platform: str = ""
    objective: str = ""
    status: SimulationRunStatus
    sourceHint: Optional[str] = None
    windowSeconds: int
    startedAt: str
    startedBy: str
    startedById: str
    executedAt: Optional[str] = None
    completedAt: Optional[str] = None
    detectionEventId: Optional[str] = None
    detectionAlertId: Optional[str] = None
    detectionLatencySeconds: Optional[int] = None
    notes: Optional[str] = None


class StartSimulationRunRequest(BaseModel):
    techniqueId: Optional[str] = None
    platform: Optional[str] = None
    objective: Optional[str] = None
    sourceHint: Optional[str] = None
    windowSeconds: Optional[int] = None


class SimulationTimelineStage(BaseModel):
    stage: str
    status: str = Field(description="'observed' or 'not_observed'")
    timestamp: Optional[str] = None
    detail: Optional[str] = None
    objectId: Optional[str] = None


class SimulationRunDetail(BaseModel):
    run: SimulationRun
    timeline: list[SimulationTimelineStage]
    detectionEvent: Optional[Event] = None
    detectionAlert: Optional[Alert] = None


class SimulationCenterSummary(BaseModel):
    totalRuns: int
    passed: int
    failed: int
    partial: int
    running: int
    notObserved: int
    techniquesTested: int
    techniquesNeverTested: int
    detectionRate: Optional[float] = None
    averageDetectionSeconds: Optional[float] = None


TechniqueDetail.model_rebuild()
