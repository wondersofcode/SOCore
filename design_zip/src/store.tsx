import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { alerts as seedAlerts, cases as seedCases } from './data'
import type { Alert, ApprovalStatus, Case } from './data'
import { api } from './api'

export interface Decision {
  alertId: string
  status: Exclude<ApprovalStatus, 'None' | 'Pending'>
  by: string
  at: string
  reason: string
}

interface Store {
  alerts: Alert[]
  decisions: Decision[]
  pending: Alert[]
  decide: (alertId: string, status: Decision['status'], reason: string) => void
  currentUser: string
  /** True when data is coming from the backend, false when using seeded mock. */
  live: boolean
  aiLive: boolean

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
  const [caseList, setCaseList] = useState<Case[]>(seedCases)
  const currentUser = 'K. Osei'

  // Try the backend on mount. If it answers, switch to live data and poll it.
  // If it doesn't, we silently stay on the seeded mock data.
  useEffect(() => {
    let cancelled = false
    let timer: ReturnType<typeof setInterval> | undefined

    async function connect() {
      try {
        const health = await api.health()
        if (cancelled) return
        const [live, decs, liveCases] = await Promise.all([api.alerts(), api.decisions(), api.cases()])
        if (cancelled) return
        setAlerts(live)
        setCaseList(liveCases)
        setDecisions(decs.map(d => ({
          alertId: d.alertId,
          status: d.status as Decision['status'],
          by: d.by, at: d.at, reason: d.reason,
        })))
        setLive(true)
        setAiLive(health.aiLive)
        // Poll for new alerts every 5s so live Wazuh events show up.
        timer = setInterval(async () => {
          try {
            const [fresh, freshDecs, freshCases] = await Promise.all([api.alerts(), api.decisions(), api.cases()])
            if (cancelled) return
            setAlerts(fresh)
            setCaseList(freshCases)
            setDecisions(freshDecs.map(d => ({
              alertId: d.alertId, status: d.status as Decision['status'],
              by: d.by, at: d.at, reason: d.reason,
            })))
          } catch { /* backend went away; keep last known data */ }
        }, 5000)
      } catch {
        // Backend not reachable — stay on mock. This is expected before it's up.
        if (!cancelled) setLive(false)
      }
    }
    connect()
    return () => { cancelled = true; if (timer) clearInterval(timer) }
  }, [])

  const applyLocalDecision = useCallback((alertId: string, status: Decision['status'], reason: string) => {
    setAlerts(prev =>
      prev.map(a =>
        a.id === alertId
          ? {
              ...a,
              approvalStatus: status,
              status: status === 'Approved' ? 'Responding' : 'Resolved',
              analyst: a.analyst === 'Unassigned' ? currentUser : a.analyst,
              respondedAt: a.respondedAt || now(),
            }
          : a,
      ),
    )
    setDecisions(prev => [{ alertId, status, by: currentUser, at: now(), reason }, ...prev])
  }, [currentUser])

  const decide = useCallback((alertId: string, status: Decision['status'], reason: string) => {
    // Optimistic update so the UI reacts instantly either way.
    applyLocalDecision(alertId, status, reason)
    if (live) {
      const decision = status === 'Approved' ? 'approve' : 'reject'
      api.approve(alertId, decision, reason, currentUser)
        .then(updated => setAlerts(prev => prev.map(a => (a.id === updated.id ? updated : a))))
        .catch(() => { /* keep optimistic state if the call fails */ })
    }
  }, [live, applyLocalDecision, currentUser])

  const pending = useMemo(() => alerts.filter(a => a.approvalStatus === 'Pending'), [alerts])

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
      alerts, decisions, pending, decide, currentUser, live, aiLive,
      cases: caseList, createCase, updateCaseStatus, addCaseNote, toggleCaseTask,
    }),
    [alerts, decisions, pending, decide, live, aiLive, caseList, createCase, updateCaseStatus, addCaseNote, toggleCaseTask],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore(): Store {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used inside StoreProvider')
  return ctx
}
