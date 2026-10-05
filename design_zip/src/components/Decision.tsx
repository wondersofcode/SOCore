import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { useAuth } from '../lib/AuthContext'
import { api, describeApiError } from '../api'
import { formatDateTime } from '../lib/dateFormat'
import type { Alert, AuditEntry } from '../data'

/** Mirrors the backend rule (REVIEW_ROLES in main.py). The backend is
 *  authoritative: this only decides whether to offer the buttons. */
function useCanDecide() {
  const { role } = useAuth()
  return role === 'l2_analyst' || role === 'admin'
}

const btnBase = 'px-3 py-1.5 rounded-lg text-xs transition-colors whitespace-nowrap disabled:opacity-40 disabled:cursor-not-allowed'

// ── Approve & Run / Reject ──────────────────────────────────────────────────
export function DecisionControls({ alert }: { alert: Alert }) {
  const { decide, live } = useStore()
  const canDecide = useCanDecide()
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState<'Approved' | 'Rejected' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const inFlight = useRef(false) // blocks a second click before React re-renders
  const action = alert.proposedAction

  const run = async (status: 'Approved' | 'Rejected') => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(status)
    setError(null)
    const outcome = await decide(alert.id, status, reason.trim())
    inFlight.current = false
    setBusy(null)
    if (outcome.ok) setReason('')
    else setError(outcome.error)
  }

  if (!canDecide || !live) {
    return (
      <div className="border-t border-[#ff9d4d30] bg-[var(--color-background)] px-4 py-3 text-[11px] text-[var(--color-text-secondary)]">
        {!live
          ? 'Backend not connected. Decisions are only recorded by the backend.'
          : 'Approving or rejecting a response action needs an L2 analyst or admin. You can add notes or escalate this alert to a case.'}
      </div>
    )
  }

  const real = action?.executor === 'fail2ban'
  return (
    <div className="border-t border-[#ff9d4d30] bg-[var(--color-background)] px-4 py-3">
      <div className="flex items-center gap-2">
        <input
          value={reason}
          onChange={e => setReason(e.target.value)}
          disabled={!!busy}
          maxLength={2000}
          placeholder="Reason (required to reject, recorded in the audit trail)"
          className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[#4f8cff40]"
        />
        <button
          onClick={() => run('Rejected')}
          disabled={!!busy || !reason.trim()}
          title={reason.trim() ? undefined : 'Give a reason to reject'}
          className={`${btnBase} border border-[var(--color-border-bright)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]`}
        >
          {busy === 'Rejected' ? 'Rejecting…' : 'Reject'}
        </button>
        <button
          onClick={() => run('Approved')}
          disabled={!!busy}
          className={`${btnBase} font-semibold bg-[#30d18a20] border border-[#30d18a50] text-[#30d18a] hover:bg-[#30d18a30]`}
        >
          {busy === 'Approved' ? 'Running…' : real ? 'Approve and run' : 'Approve (simulated)'}
        </button>
      </div>
      <div className="mt-1.5 text-[10px] text-[var(--color-text-muted)]">
        {real
          ? `Approving bans ${action?.target} in the host's fail2ban jail. Private, loopback and protected addresses are always refused.`
          : 'SOCore has no executor for this action type: approving records your decision and the action is labelled Simulated. Nothing is changed on any system.'}
      </div>
      {error && <div role="alert" className="mt-2 text-[11px] text-[#fb4a63]">{error}</div>}
    </div>
  )
}

// ── What happened after the decision ────────────────────────────────────────
export function DecisionOutcome({ alert }: { alert: Alert }) {
  const { retryExecution, unblock } = useStore()
  const canDecide = useCanDecide()
  const { profile } = useAuth()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [unblockReason, setUnblockReason] = useState('')
  const inFlight = useRef(false)
  const action = alert.proposedAction
  if (!action || (alert.approvalStatus !== 'Approved' && alert.approvalStatus !== 'Rejected')) return null

  const res = alert.executionResult
  const who = alert.decidedBy
    ? `${alert.decidedBy}${alert.decidedByRole ? ` (${alert.decidedByRole.replace('_', ' ')})` : ''}`
    : 'an analyst'
  const when = alert.decidedAt ? ` · ${formatDateTime(alert.decidedAt, profile?.timezone)}` : ''

  const act = async (fn: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setError(null)
    const out = await fn()
    inFlight.current = false
    setBusy(false)
    if (!out.ok) setError(out.error)
  }

  let tone = '#9497ac'
  let title = ''
  let body: React.ReactNode = null

  if (alert.approvalStatus === 'Rejected') {
    title = `Rejected by ${who}${when}`
    body = 'No change was made to any system.'
  } else {
    switch (alert.executionStatus) {
      case 'Executing':
        tone = '#4f8cff'; title = `Approved by ${who}${when} · running…`
        body = 'The backend is executing the action. This view updates when it finishes.'
        break
      case 'Executed':
        tone = '#30d18a'; title = `Approved by ${who}${when} · Executed`
        body = (
          <>
            Banned <span className="font-mono">{res?.target ?? action.target}</span> in fail2ban jail{' '}
            <span className="font-mono">{res?.jail}</span>
            {res?.verified ? ' (verified in the jail’s banned list)' : ''}.
          </>
        )
        break
      case 'Simulated':
        tone = '#f2c94c'; title = `Approved by ${who}${when} · Simulated`
        body = res?.detail ?? 'No executor exists for this action type. Nothing was changed on any system.'
        break
      case 'ExecutionFailed':
        tone = '#fb4a63'; title = `Approved by ${who}${when} · Execution failed`
        body = <>Action execution failed: {res?.error ?? 'unknown error'}</>
        break
      case 'Reverted':
        tone = '#9497ac'; title = `Approved by ${who}${when} · Block reverted`
        body = <>Unbanned <span className="font-mono">{res?.target ?? action.target}</span> from jail <span className="font-mono">{res?.jail}</span>.</>
        break
      default:
        title = `Approved by ${who}${when}`
        body = 'Approved before execution tracking existed: there is no execution record for this decision.'
    }
  }

  return (
    <div className="rounded-lg border bg-[var(--color-surface)] px-4 py-3" style={{ borderColor: `${tone}50` }}>
      <div className="text-[11px] font-semibold mb-1" style={{ color: tone }}>{title}</div>
      <div className="text-sm text-[var(--color-text-primary)]">{action.action}</div>
      <div className="mt-1 text-xs text-[var(--color-text-secondary)]">{body}</div>
      {alert.decisionReason && (
        <div className="mt-1.5 text-xs text-[var(--color-text-secondary)]">
          Reason: <span className="text-[var(--color-text-primary)]">{alert.decisionReason}</span>
        </div>
      )}
      {res?.command && (
        <div className="mt-1.5 text-[10px] font-mono text-[var(--color-text-muted)] break-all">
          $ {res.command}{res.exit_code !== undefined && res.exit_code !== null ? ` → exit ${res.exit_code}` : ''}
        </div>
      )}

      {canDecide && alert.executionStatus === 'ExecutionFailed' && (
        <button
          onClick={() => act(() => retryExecution(alert.id))}
          disabled={busy}
          className={`mt-3 ${btnBase} border border-[#fb4a6350] text-[#fb4a63] hover:bg-[#fb4a6315]`}
        >
          {busy ? 'Retrying…' : 'Retry execution'}
        </button>
      )}
      {canDecide && alert.executionStatus === 'Executed' && res?.mode === 'fail2ban' && (
        <div className="mt-3 flex items-center gap-2">
          <input
            value={unblockReason}
            onChange={e => setUnblockReason(e.target.value)}
            disabled={busy}
            placeholder="Reason to unblock (optional)"
            className="flex-1 bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none"
          />
          <button
            onClick={() => act(() => unblock(alert.id, unblockReason.trim()))}
            disabled={busy}
            className={`${btnBase} border border-[var(--color-border-bright)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]`}
          >
            {busy ? 'Unblocking…' : 'Unblock'}
          </button>
        </div>
      )}
      {res?.revert_error?.error && (
        <div className="mt-2 text-[11px] text-[#fb4a63]">Last unblock attempt failed: {res.revert_error.error}</div>
      )}
      {error && <div role="alert" className="mt-2 text-[11px] text-[#fb4a63]">{error}</div>}
    </div>
  )
}

// ── Append-only audit trail for one alert ───────────────────────────────────
const ACTION_LABEL: Record<string, string> = {
  approve: 'Approved',
  reject: 'Rejected',
  execution: 'Execution result',
  retry_requested: 'Retry requested',
  execution_retry: 'Retry result',
  unblock_requested: 'Unblock requested',
  unblock: 'Block reverted',
  unblock_failed: 'Unblock failed',
  execution_interrupted: 'Execution interrupted',
  approve_denied: 'Approve denied (role)',
  reject_denied: 'Reject denied (role)',
  retry_denied: 'Retry denied (role)',
  unblock_denied: 'Unblock denied (role)',
  approve_refused_protected_target: 'Approve refused (protected target)',
  retry_refused_protected_target: 'Retry refused (protected target)',
}

function auditLabel(action: string): string {
  if (ACTION_LABEL[action]) return ACTION_LABEL[action]
  if (action.endsWith('_conflict')) return `${action.replace('_conflict', '')} refused (already handled)`
  return action
}

export function AuditTrail({ alert }: { alert: Alert }) {
  const { profile } = useAuth()
  const [entries, setEntries] = useState<AuditEntry[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api.alertAudit(alert.id)
      .then(e => { if (!cancelled) { setEntries(e); setError(null) } })
      .catch(err => { if (!cancelled) setError(describeApiError(err)) })
    return () => { cancelled = true }
  }, [alert.id, alert.approvalStatus, alert.executionStatus, alert.falsePositive])

  return (
    <div>
      <div className="text-[10px] uppercase tracking-widest text-[var(--color-info)] font-semibold mb-3">
        Audit trail{entries && entries.length > 0 ? ` (${entries.length})` : ''}
      </div>
      {error && <div className="text-[11px] text-[#fb4a63]">Could not load the audit trail: {error}</div>}
      {entries && entries.length === 0 && (
        <div className="text-xs text-[var(--color-text-muted)]">No decisions or actions recorded for this alert yet.</div>
      )}
      {entries && entries.length > 0 && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg divide-y divide-[var(--color-border)]">
          {entries.map(e => (
            <div key={e.id} className="px-3 py-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[var(--color-text-primary)] font-semibold">{auditLabel(e.action)}</span>
                <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{formatDateTime(e.createdAt, profile?.timezone)}</span>
              </div>
              <div className="text-[var(--color-text-secondary)]">
                {e.actorName}{e.actorRole ? ` · ${e.actorRole}` : ''}
                {e.previousState || e.newState ? ` · ${e.previousState || '—'} → ${e.newState || '—'}` : ''}
              </div>
              {e.reason && <div className="text-[var(--color-text-secondary)]">{e.reason}</div>}
              {e.result?.error && <div className="text-[#fb4a63]">{e.result.error}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
