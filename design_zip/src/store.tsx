import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { alerts as seedAlerts, cases as seedCases } from './data'
import type { Alert, ApprovalStatus, Case } from './data'
import { api, describeApiError } from './api'
import { useAuth } from './lib/AuthContext'

/** The approve/reject decision() can record — distinct from the wider set
 *  of statuses that can appear in the decisions audit log (see Decision
 *  below), since 'False Positive' is never produced by decide(). */
type ApprovalDecisionStatus = Exclude<ApprovalStatus, 'None' | 'Pending'>

export interface Decision {
  alertId: string
  // 'False Positive' is a distinct disposition, not a rejection of a
  // proposed action — see AlertDetail's "Mark False Positive" flow.
  status: ApprovalDecisionStatus | 'False Positive'
  by: string
  at: string
  reason: string
}

/** Result of a backend-authoritative alert action. `ok: true` means the
 *  backend accepted and persisted it (check alert.executionStatus for what
 *  actually ran); `ok: false` carries a message safe to show an analyst. */
export type ActionOutcome = { ok: true; alert: Alert } | { ok: false; error: string }

interface Store {
  alerts: Alert[]
  decisions: Decision[]
  pending: Alert[]
  /** Approve & Run / Reject. Backend-only: nothing changes locally until the
   *  server has persisted the decision, and failures are returned, never swallowed. */
  decide: (alertId: string, status: ApprovalDecisionStatus, reason: string) => Promise<ActionOutcome>
  /** Re-runs an approved action whose execution failed. */
  retryExecution: (alertId: string) => Promise<ActionOutcome>
  /** Reverts an executed fail2ban block (unban). */
  unblock: (alertId: string, reason: string) => Promise<ActionOutcome>
  /** Re-reads alerts/decisions/cases from the backend now. */
  refresh: () => Promise<void>
  /** Marks an alert as a false positive (distinct from rejecting a proposed
   *  action) and reconciles local state with the persisted result. Requires
   *  the backend — returns null in mock mode. */
  markFalsePositive: (alertId: string, reason: string) => Promise<Alert | null>
  currentUser: string
  /** True when data is coming from the backend, false when using seeded mock. */
  live: boolean
  aiLive: boolean
  /** ISO timestamp of the last successful fetch/poll from the backend (null until the first one lands). */
  lastFetchedAt: string | null

  // Case management (in-house replacement for TheHive)
  cases: Case[]
  createCase: (alertId: string, title: string | undefined, assignedTo: string) => Promise<Case | null>
  updateCaseStatus: (caseId: string, status: Case['status']) => Promise<void>
  addCaseNote: (caseId: string, author: string, text: string) => Promise<void>
  toggleCaseTask: (caseId: string, taskId: string) => Promise<void>
}

const StoreContext = createContext<Store | null>(null)

const now = () => new Date().toTimeString().slice(0, 8)

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [alerts, setAlerts] = useState<Alert[]>(seedAlerts)
  const [decisions, setDecisions] = useState<Decision[]>([])
  const [live, setLive] = useState(false)
  const [aiLive, setAiLive] = useState(false)
  const [lastFetchedAt, setLastFetchedAt] = useState<string | null>(null)
  const [caseList, setCaseList] = useState<Case[]>(seedCases)
  const { user } = useAuth()
  const currentUser = user?.email ?? 'Unassigned'
  // Bumped whenever the analyst changes something. A poll that started before
  // the change must not overwrite the fresher server state it returned.
  const mutationEpoch = useRef(0)

  const mapDecisions = (decs: Awaited<ReturnType<typeof api.decisions>>): Decision[] =>
    decs.map(d => ({ alertId: d.alertId, status: d.status as Decision['status'], by: d.by, at: d.at, reason: d.reason }))

  // Try the backend on mount. If it answers, switch to live data and poll it.
  // If it doesn't, we silently stay on the seeded mock data.
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | undefined
    let retry: ReturnType<typeof setTimeout> | undefined

    async function connect() {
      try {
        const [live, decs, liveCases] = await Promise.all([api.alerts(), api.decisions(), api.cases()])
        if (cancelled) return
        setAlerts(live)
        setCaseList(liveCases)
        setDecisions(mapDecisions(decs))
        setLive(true)
        // Health runs several TCP probes server-side; it only feeds the AI badge, so never block live mode on it.
        api.health().then(h => { if (!cancelled) setAiLive(h.aiLive) }).catch(() => { /* badge stays off */ })
        setLastFetchedAt(new Date().toISOString())
        // Poll for new alerts every 5s so live Wazuh events show up.
        timer = setInterval(async () => {
          const epoch = mutationEpoch.current
          try {
            const [fresh, freshDecs, freshCases] = await Promise.all([api.alerts(), api.decisions(), api.cases()])
            if (cancelled || epoch !== mutationEpoch.current) return
            setAlerts(fresh)
            setCaseList(freshCases)
            setDecisions(mapDecisions(freshDecs))
            setLastFetchedAt(new Date().toISOString())
          } catch { /* backend went away; keep last known data */ }
        }, 5000)
      } catch {
        // Backend not reachable (yet). Stay on mock, but keep trying: a slow
        // first response must not leave the session on sample data forever.
        if (!cancelled) {
          setLive(false)
          retry = setTimeout(connect, 5000)
        }
      }
    }
    connect()
    return () => { cancelled = true; if (timer) clearInterval(timer); if (retry) clearTimeout(retry) }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const [fresh, freshDecs, freshCases] = await Promise.all([api.alerts(), api.decisions(), api.cases()])
      setAlerts(fresh)
      setCaseList(freshCases)
      setDecisions(mapDecisions(freshDecs))
      setLastFetchedAt(new Date().toISOString())
    } catch { /* the next poll will try again */ }
  }, [])

  // Every decision goes through here: backend first, UI second. On any
  // failure (including a timeout where the server may still have acted) the
  // view is re-read from the backend so it can never drift from the truth.
  const runAlertAction = useCallback(async (call: () => Promise<Alert>): Promise<ActionOutcome> => {
    if (!live) return { ok: false, error: 'Backend not connected. Decisions are only recorded by the backend.' }
    mutationEpoch.current += 1
    try {
      const updated = await call()
      mutationEpoch.current += 1
      setAlerts(prev => prev.map(a => (a.id === updated.id ? updated : a)))
      await refresh()
      return { ok: true, alert: updated }
    } catch (err) {
      mutationEpoch.current += 1
      await refresh()
      return { ok: false, error: describeApiError(err) }
    }
  }, [live, refresh])

  const decide = useCallback(
    (alertId: string, status: ApprovalDecisionStatus, reason: string) =>
      runAlertAction(() => api.approve(alertId, status === 'Approved' ? 'approve' : 'reject', reason)),
    [runAlertAction],
  )
  const retryExecution = useCallback((alertId: string) => runAlertAction(() => api.retryExecution(alertId)), [runAlertAction])
  const unblock = useCallback((alertId: string, reason: string) => runAlertAction(() => api.unblock(alertId, reason)), [runAlertAction])

  const markFalsePositive = useCallback(async (alertId: string, reason: string) => {
    if (!live) return null // needs the backend to persist the disposition + audit trail
    try {
      const updated = await api.markFalsePositive(alertId, reason)
      setAlerts(prev => prev.map(a => (a.id === updated.id ? updated : a)))
      return updated
    } catch {
      return null
    }
  }, [live])

  const pending = useMemo(() => alerts.filter(a => a.approvalStatus === 'Pending' && !a.falsePositive), [alerts])

  const createCase = useCallback(async (alertId: string, title: string | undefined, assignedTo: string) => {
    if (!live) return null // case creation needs the backend; mock mode has nothing to persist to
    try {
      const created = await api.createCase(alertId, title, assignedTo)
      setCaseList(prev => [created, ...prev])
      return created
    } catch {
      return null
    }
  }, [live])

  const updateCaseStatus = useCallback(async (caseId: string, status: Case['status']) => {
    setCaseList(prev => prev.map(c => (c.id === caseId ? { ...c, status } : c))) // optimistic
    if (!live) return
    try {
      const updated = await api.updateCase(caseId, { status })
      setCaseList(prev => prev.map(c => (c.id === updated.id ? updated : c)))
    } catch { /* keep optimistic state */ }
  }, [live])

  const addCaseNote = useCallback(async (caseId: string, author: string, text: string) => {
    const optimisticNote = { author, text, at: now() }
    setCaseList(prev => prev.map(c =>
      c.id === caseId ? { ...c, notes: [optimisticNote, ...(c.notes ?? [])] } : c,
    ))
    if (!live) return
    try {
      const updated = await api.addCaseNote(caseId, author, text)
      setCaseList(prev => prev.map(c => (c.id === updated.id ? updated : c)))
    } catch { /* keep optimistic state */ }
  }, [live])

  const toggleCaseTask = useCallback(async (caseId: string, taskId: string) => {
    setCaseList(prev => prev.map(c =>
      c.id === caseId
        ? { ...c, tasks: (c.tasks ?? []).map(t => (t.id === taskId ? { ...t, done: !t.done } : t)) }
        : c,
    ))
    if (!live) return
    try {
      const updated = await api.toggleCaseTask(caseId, taskId)
      setCaseList(prev => prev.map(c => (c.id === updated.id ? updated : c)))
    } catch { /* keep optimistic state */ }
  }, [live])

  const value = useMemo<Store>(
    () => ({
      alerts, decisions, pending, decide, retryExecution, unblock, refresh, markFalsePositive, currentUser, live, aiLive, lastFetchedAt,
      cases: caseList, createCase, updateCaseStatus, addCaseNote, toggleCaseTask,
    }),
    [alerts, decisions, pending, decide, retryExecution, unblock, refresh, markFalsePositive, live, aiLive, lastFetchedAt, caseList, createCase, updateCaseStatus, addCaseNote, toggleCaseTask],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
