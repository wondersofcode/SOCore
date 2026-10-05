/**
 * API client for the SOCore backend.
 *
 * When the backend is reachable, the dashboard uses live data. When it isn't
 * (backend not started yet), every call throws and the store falls back to the
 * seeded mock data — so the UI always renders.
 *
 * Point this at the backend by setting VITE_API_URL, e.g.
 *   VITE_API_URL=http://localhost:8000 npm run dev
 * With no env var it defaults to localhost:8000.
 */
import type {
  AdminUser, Alert, AlertNote, AuditEntry, Case, WazuhRawEvent,
  MitreCenterResponse, TechniqueDetail,
  SimulationDefinition, SimulationRun, SimulationRunDetail, SimulationCenterSummary,
} from './data'
import { supabase } from './lib/supabase'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function req<T>(path: string, init?: RequestInit, timeoutMs = 4000): Promise<T> {
  const auth = await authHeaders()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...auth, ...(init?.headers ?? {}) },
    // Fail fast so the UI doesn't hang when the backend is down. AI calls
    // (assistant chat, shift summary) get a longer budget since a Groq round
    // trip can take a few seconds.
    signal: AbortSignal.timeout(timeoutMs),
  })
  if (!res.ok) throw await ApiError.fromResponse(path, res)
  return res.json() as Promise<T>
}

/** A non-2xx API response, keeping the HTTP status and the backend's own
 *  `detail` message so the UI can tell an analyst *why* it failed. */
export class ApiError extends Error {
  status: number
  detail: string
  constructor(path: string, status: number, detail: string) {
    super(`${path} -> ${status}${detail ? `: ${detail}` : ''}`)
    this.status = status
    this.detail = detail
  }
  static async fromResponse(path: string, res: Response): Promise<ApiError> {
    let detail = ''
    try {
      const body = await res.json()
      if (typeof body?.detail === 'string') detail = body.detail
      else if (Array.isArray(body?.detail)) detail = body.detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join('; ')
    } catch { /* non-JSON error body */ }
    return new ApiError(path, res.status, detail)
  }
}

/** Analyst-readable explanation of a failed request (never claims success). */
export function describeApiError(err: unknown): string {
  if (err instanceof ApiError) {
    switch (err.status) {
      case 400: case 422: return err.detail || 'The request was rejected as invalid.'
      case 401: return 'Your session expired. Sign in again.'
      case 403: return err.detail || 'You do not have permission to do this.'
      case 404: return 'This alert no longer exists.'
      case 409: return err.detail || 'This alert was already handled. The view has been refreshed.'
      case 500: case 502: case 503: return err.detail || 'The backend failed while processing this. Check the result before retrying.'
      default: return err.detail || `Unexpected backend response (${err.status}).`
    }
  }
  if (err instanceof DOMException && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
    return 'The backend did not answer in time. The action may still have been processed; the view will refresh.'
  }
  return 'Could not reach the backend.'
}

// Approve & Run can run a real command on the host, so allow it longer than the default.
const DECISION_TIMEOUT_MS = 30000

export interface ConnectionStatus {
  connected: boolean
  url: string | null
}

export interface Health {
  status: string
  aiLive: boolean
  alerts: number
  pending: number
  connections: Record<string, ConnectionStatus>
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface ShiftSummary {
  summary: string
  windowHours: number
  alertCount: number
  /** Decisions made on an alert that falls inside this window — same window
   *  alertCount uses, so Reports.tsx can drive both KPIs off one response. */
  decisionCount: number
  generatedAt: string
  cached: boolean
}

export const api = {
  // Health runs several TCP probes server-side, so give it more than the default budget.
  health: () => req<Health>('/api/health', undefined, 12000),
  alerts: () => req<Alert[]>('/api/alerts'),
  pending: () => req<Alert[]>('/api/pending'),
  decisions: () => req<{ alertId: string; status: string; by: string; at: string; reason: string }[]>('/api/decisions'),
  // Approve & Run / Reject. The analyst identity comes from the verified JWT
  // on the server, never from the request body.
  approve: (id: string, decision: 'approve' | 'reject', reason: string) =>
    req<Alert>(`/api/approve/${encodeURIComponent(id)}`, {
      method: 'POST',
      body: JSON.stringify({ decision, reason }),
    }, DECISION_TIMEOUT_MS),
  retryExecution: (id: string) =>
    req<Alert>(`/api/alerts/${encodeURIComponent(id)}/retry-execution`, { method: 'POST' }, DECISION_TIMEOUT_MS),
  unblock: (id: string, reason: string) =>
    req<Alert>(`/api/alerts/${encodeURIComponent(id)}/unblock`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }, DECISION_TIMEOUT_MS),
  alertAudit: (id: string) => req<AuditEntry[]>(`/api/alerts/${encodeURIComponent(id)}/audit`),

  // Raw Wazuh event history — recorded independently of whatever Alert an
  // event becomes, so an analyst can inspect what actually arrived.
  events: (limit = 50, offset = 0) => req<WazuhRawEvent[]>(`/api/events?limit=${limit}&offset=${offset}`),
  event: (id: string) => req<WazuhRawEvent>(`/api/events/${id}`),
  eventsCount: () => req<{ count: number }>('/api/events/count'),

  // Alert notes — persistent (Postgres), author always the authenticated caller.
  alertNotes: (alertId: string) => req<AlertNote[]>(`/api/alerts/${encodeURIComponent(alertId)}/notes`),
  addAlertNote: (alertId: string, text: string) =>
    req<AlertNote>(`/api/alerts/${encodeURIComponent(alertId)}/notes`, {
      method: 'POST',
      body: JSON.stringify({ text }),
    }),

  // False-positive disposition — distinct from approve/reject.
  markFalsePositive: (alertId: string, reason: string) =>
    req<Alert>(`/api/alerts/${encodeURIComponent(alertId)}/false-positive`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  // Admin: registration approval + role management
  adminPendingCount: () => req<{ count: number }>('/api/admin/pending-count'),
  adminUsers: () => req<AdminUser[]>('/api/admin/users'),
  adminApprove: (id: string) => req<AdminUser>(`/api/admin/users/${id}/approve`, { method: 'POST' }),
  adminReject: (id: string) => req<AdminUser>(`/api/admin/users/${id}/reject`, { method: 'POST' }),
  adminSetRole: (id: string, role: string) =>
    req<AdminUser>(`/api/admin/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),

  // Self-service profile edit (Settings page)
  updateProfile: (patch: { firstName?: string; lastName?: string; avatarUrl?: string; themePreference?: string; timezone?: string }) =>
    req<AdminUser>('/api/profile', { method: 'PATCH', body: JSON.stringify(patch) }),

  // Case management — in-house replacement for TheHive (see backend README).
  cases: () => req<Case[]>('/api/cases'),
  createCase: (alertId: string, title: string | undefined, assignedTo: string) =>
    req<Case>('/api/cases', {
      method: 'POST',
      body: JSON.stringify({ alertId, title, assignedTo }),
    }),
  updateCase: (id: string, patch: { status?: string; assignedTo?: string }) =>
    req<Case>(`/api/cases/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),
  addCaseNote: (id: string, author: string, text: string) =>
    req<Case>(`/api/cases/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ author, text }),
    }),
  toggleCaseTask: (id: string, taskId: string) =>
    req<Case>(`/api/cases/${id}/tasks/${taskId}/toggle`, { method: 'POST' }),

  // AI assistant chat — grounded in real alert/case/approval data server-side.
  chatWithAssistant: (message: string, history: ChatMessage[]) =>
    req<{ reply: string }>(
      '/api/assistant/chat',
      { method: 'POST', body: JSON.stringify({ message, history }) },
      20000,
    ),

  // Shift summary report (Reports page) — server caches per window for 5 minutes.
  shiftSummary: (hours: 8 | 12 | 24, refresh = false) =>
    req<ShiftSummary>(`/api/reports/shift-summary?hours=${hours}${refresh ? '&refresh=true' : ''}`, undefined, 20000),

  // MITRE ATT&CK Center — every field is computed server-side from real
  // alerts/simulation_runs; see socore-backend/app/mitre.py.
  mitreCenter: () => req<MitreCenterResponse>('/api/mitre'),
  mitreTechnique: (id: string) => req<TechniqueDetail>(`/api/mitre/${encodeURIComponent(id)}`),

  // Simulation Center — controlled, evidence-based detection validation.
  // Starting a run never executes anything; see simulation_catalog.py.
  simulations: () => req<SimulationDefinition[]>('/api/simulations'),
  simulation: (id: string) => req<SimulationDefinition>(`/api/simulations/${encodeURIComponent(id)}`),
  simulationsSummary: () => req<SimulationCenterSummary>('/api/simulations/summary'),
  simulationRuns: (filters: { techniqueId?: string; status?: string; platform?: string } = {}) => {
    const params = new URLSearchParams()
    if (filters.techniqueId) params.set('techniqueId', filters.techniqueId)
    if (filters.status) params.set('status', filters.status)
    if (filters.platform) params.set('platform', filters.platform)
    const qs = params.toString()
    return req<SimulationRun[]>(`/api/simulations/runs${qs ? `?${qs}` : ''}`)
  },
  simulationRun: (runId: string) => req<SimulationRunDetail>(`/api/simulations/runs/${encodeURIComponent(runId)}`),
  startSimulationRun: (
    simulationId: string,
    body: { techniqueId?: string; platform?: string; objective?: string; sourceHint?: string; windowSeconds?: number },
  ) => req<SimulationRun>(`/api/simulations/${encodeURIComponent(simulationId)}/runs`, {
    method: 'POST',
    body: JSON.stringify(body),
  }),
  markSimulationRunExecuted: (runId: string) =>
    req<SimulationRun>(`/api/simulations/runs/${encodeURIComponent(runId)}/mark-executed`, { method: 'POST' }),

  // Downloads the shift report as an .xlsx file and triggers a browser save —
  // not a JSON endpoint, so this bypasses req() and handles the blob directly.
  exportReport: async (hours: 8 | 12 | 24): Promise<void> => {
    const auth = await authHeaders()
    const res = await fetch(`${BASE}/api/reports/export?hours=${hours}`, {
      headers: auth,
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) throw new Error(`/api/reports/export -> ${res.status}`)
    const blob = await res.blob()

    const disposition = res.headers.get('Content-Disposition') ?? ''
    const match = disposition.match(/filename="?([^"]+)"?/)
    const today = new Date().toISOString().slice(0, 10)
    const filename = match?.[1] ?? `SOCore_Shift_Report_${today}_${hours}h.xlsx`

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },
}
