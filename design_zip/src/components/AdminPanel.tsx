import { useEffect, useState } from 'react'
import { api } from '../api'
import type { AdminUser, UserRole } from '../data'
import { Panel, PanelHeader } from './Shared'

const ROLE_LABEL: Record<UserRole, string> = {
  l1_analyst: 'L1 Analyst',
  l2_analyst: 'L2 Analyst',
  admin: 'Admin',
}

const STATUS_STYLE: Record<AdminUser['status'], { bg: string; text: string; label: string }> = {
  pending: { bg: 'bg-[#f9731615]', text: 'text-[#f97316]', label: 'Pending' },
  approved: { bg: 'bg-[#22c55e15]', text: 'text-[#22c55e]', label: 'Approved' },
  rejected: { bg: 'bg-[#6b728015]', text: 'text-[var(--color-info)]', label: 'Rejected' },
}

function StatusBadge({ status }: { status: AdminUser['status'] }) {
  const s = STATUS_STYLE[status]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${s.bg} ${s.text}`}>
      {s.label}
    </span>
  )
}

export default function AdminPanel() {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    setError(false)
    try {
      setUsers(await api.adminUsers())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const withBusy = async (id: string, fn: () => Promise<AdminUser>) => {
    setBusyId(id)
    try {
      const updated = await fn()
      setUsers(prev => prev.map(u => (u.id === updated.id ? updated : u)))
    } catch {
      // leave the list as-is; the row's own state didn't change
    } finally {
      setBusyId(null)
    }
  }

  const pendingCount = users.filter(u => u.status === 'pending').length

  return (
    <div className="space-y-4 max-w-5xl">
      <Panel>
        <PanelHeader title="Users">
          <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
            {pendingCount > 0 ? `${pendingCount} awaiting approval` : `${users.length} total`}
          </span>
        </PanelHeader>

        {loading && <div className="px-5 py-10 text-center text-xs text-[var(--color-info)] font-mono">Loading users…</div>}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-14 gap-2">
            <div className="text-sm text-[var(--color-text-primary)]">Unable to load users</div>
            <button onClick={load} className="mt-1 text-xs text-[#00d4ff] hover:underline">Retry</button>
          </div>
        )}

        {!loading && !error && (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  {['User', 'Role', 'Status', 'Joined', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest text-[var(--color-info)] font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.displayName
                  const busy = busyId === u.id
                  return (
                    <tr key={u.id} className="border-b border-[var(--color-border)] last:border-0">
                      <td className="px-4 py-2.5">
                        <div className="text-[var(--color-text-primary)]">{name}</div>
                        <div className="text-[10px] font-mono text-[var(--color-info)]">{u.email}</div>
                      </td>
                      <td className="px-4 py-2.5">
                        <select
                          value={u.role}
                          disabled={busy}
                          onChange={e => withBusy(u.id, () => api.adminSetRole(u.id, e.target.value))}
                          className="bg-[var(--color-background)] border border-[var(--color-border)] rounded px-2 py-1 text-[11px] text-[var(--color-text-primary)] focus:outline-none focus:border-[#00d4ff40] disabled:opacity-50"
                        >
                          {(Object.keys(ROLE_LABEL) as UserRole[]).map(r => (
                            <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-2.5"><StatusBadge status={u.status} /></td>
                      <td className="px-4 py-2.5 font-mono text-[var(--color-info)] whitespace-nowrap">{u.createdAt.slice(0, 10)}</td>
                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        {u.status === 'pending' && (
                          <div className="flex items-center justify-end gap-2">
                            <button
                              disabled={busy}
                              onClick={() => withBusy(u.id, () => api.adminReject(u.id))}
                              className="px-2.5 py-1 rounded border border-[var(--color-border-bright)] text-[var(--color-text-secondary)] hover:text-[#ef4444] hover:border-[#ef444440] transition-colors disabled:opacity-50"
                            >
                              Reject
                            </button>
                            <button
                              disabled={busy}
                              onClick={() => withBusy(u.id, () => api.adminApprove(u.id))}
                              className="px-2.5 py-1 rounded bg-[#22c55e20] border border-[#22c55e50] text-[#22c55e] font-semibold hover:bg-[#22c55e30] transition-colors disabled:opacity-50"
                            >
                              Approve
                            </button>
                          </div>
                        )}
                        {u.status === 'approved' && (
                          <button
                            disabled={busy}
                            onClick={() => withBusy(u.id, () => api.adminReject(u.id))}
                            className="px-2.5 py-1 rounded border border-[var(--color-border-bright)] text-[var(--color-text-secondary)] hover:text-[#ef4444] hover:border-[#ef444440] transition-colors disabled:opacity-50"
                          >
                            Revoke
                          </button>
                        )}
                        {u.status === 'rejected' && (
                          <button
                            disabled={busy}
                            onClick={() => withBusy(u.id, () => api.adminApprove(u.id))}
                            className="px-2.5 py-1 rounded bg-[#22c55e20] border border-[#22c55e50] text-[#22c55e] font-semibold hover:bg-[#22c55e30] transition-colors disabled:opacity-50"
                          >
                            Approve
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  )
}
