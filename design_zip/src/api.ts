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
import type { Alert, Case } from './data'
import { supabase } from './lib/supabase'

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

async function authHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  return token ? { Authorization: `Bearer ${token}` } : {}
}

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const auth = await authHeaders()
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...auth, ...(init?.headers ?? {}) },
    // Fail fast so the UI doesn't hang when the backend is down.
    signal: AbortSignal.timeout(4000),
  })
  if (!res.ok) throw new Error(`${path} -> ${res.status}`)
  return res.json() as Promise<T>
}

export interface Health {
  status: string
  aiLive: boolean
  alerts: number
  pending: number
}

export const api = {
  health: () => req<Health>('/api/health'),
  alerts: () => req<Alert[]>('/api/alerts'),
  pending: () => req<Alert[]>('/api/pending'),
  decisions: () => req<{ alertId: string; status: string; by: string; at: string; reason: string }[]>('/api/decisions'),
  approve: (id: string, decision: 'approve' | 'reject', reason: string, analyst: string) =>
    req<Alert>(`/api/approve/${id}`, {
      method: 'POST',
      body: JSON.stringify({ decision, reason, analyst }),
    }),

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
}
