import { useState } from 'react'
import { useStore } from '../store'
import type { Alert } from '../data'
import { RiskScore, AiExplanation } from './Shared'

// ── One approval request ────────────────────────────────────────────────────
function ApprovalCard({ alert, onSelectAlert }: { alert: Alert; onSelectAlert: (id: string) => void }) {
  const { decide, currentUser } = useStore()
  const [reason, setReason] = useState('')
  const [expanded, setExpanded] = useState(false)
  const action = alert.proposedAction!

  return (
    <div className="bg-[var(--color-surface)] border border-[#ff9d4d30] rounded-lg overflow-hidden">
      {/* What the automation wants to do */}
      <div className="flex items-start gap-4 px-5 py-4">
        <RiskScore score={alert.riskScore} size="lg" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[var(--color-text-primary)] font-semibold">{action.action}</span>
            {action.dryRun && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-border)] text-[var(--color-text-secondary)]">
                simulated
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-[var(--color-text-secondary)] flex-wrap">
            <span className="font-mono text-[var(--color-text-primary)]">{action.target}</span>
            <span className="text-[var(--color-border-bright)]">·</span>
            <span>{alert.attackType}</span>
            <span className="text-[var(--color-border-bright)]">·</span>
            <span className="font-mono text-[#9c8bfb]">{alert.mitreId}</span>
            <span className="text-[var(--color-border-bright)]">·</span>
            <button onClick={() => onSelectAlert(alert.id)} className="font-mono text-[#4f8cff] hover:underline">
              {alert.id}
            </button>
          </div>
          <div className="mt-1.5 text-[11px] font-mono text-[var(--color-text-muted)]">
            Raised by {action.playbook} · waiting on {currentUser}
          </div>
        </div>
      </div>

      {/* Why the system thinks so */}
      <div className="px-5 pb-4">
        <AiExplanation
          text={alert.aiExplanation}
          confidence={alert.aiConfidence}
          collapsed={!expanded}
          onToggle={() => setExpanded(e => !e)}
        />
      </div>

      {/* The human decision */}
      <div className="border-t border-[var(--color-border)] bg-[var(--color-background)] px-5 py-3 flex items-center gap-3">
        <input
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Reason for the decision (recorded in the audit trail)"
          className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[#4f8cff40] transition-colors"
        />
        <button
          onClick={() => decide(alert.id, 'Rejected', reason || 'No reason given')}
          className="px-3 py-1.5 rounded-lg border border-[var(--color-border-bright)] text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-text-muted)] transition-colors whitespace-nowrap"
        >
          Reject
        </button>
        <button
          onClick={() => decide(alert.id, 'Approved', reason || 'No reason given')}
          className="px-4 py-1.5 rounded-lg bg-[#30d18a20] border border-[#30d18a50] text-xs font-semibold text-[#30d18a] hover:bg-[#30d18a30] transition-colors whitespace-nowrap"
        >
          Approve and run
        </button>
      </div>
    </div>
  )
}

export default function Approvals({ onSelectAlert }: { onSelectAlert: (id: string) => void }) {
  const { pending, decisions, alerts } = useStore()

  const autoHandled = alerts.filter(a => a.approvalStatus === 'None' && a.status !== 'New').length

  return (
    <div className="space-y-4 max-w-5xl">
      {/* How the split between automatic and human work is drawn */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-5 py-4">
        <div className="text-sm text-[var(--color-text-primary)] mb-1">Nothing here runs without you</div>
        <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed max-w-2xl">
          Low-risk work — notifying the channel, enriching indicators, opening a case — happens on its own.
          Anything that changes the network waits here for a decision, and every decision is written to the
          audit trail with the reason you give.
        </p>
        <div className="mt-3 flex items-center gap-5 text-[11px] font-mono">
          <span className="text-[#ff9d4d]">{pending.length} waiting on a human</span>
          <span className="text-[#30d18a]">{autoHandled} handled automatically</span>
          <span className="text-[var(--color-text-secondary)]">{decisions.length} decided this session</span>
        </div>
      </div>

      {/* Queue */}
      {pending.length > 0 ? (
        <div className="space-y-3">
          {pending.map(a => (
            <ApprovalCard key={a.id} alert={a} onSelectAlert={onSelectAlert} />
          ))}
        </div>
      ) : (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg flex flex-col items-center justify-center py-14 gap-2">
          <div className="w-10 h-10 rounded-full bg-[#30d18a15] border border-[#30d18a30] flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 9.5l3.5 3.5L14 6" stroke="#30d18a" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="text-sm text-[var(--color-text-primary)]">No actions are waiting</div>
          <div className="text-xs text-[var(--color-info)]">
            New requests appear here as soon as a playbook proposes a change to the network.
          </div>
        </div>
      )}

      {/* Audit trail */}
      {decisions.length > 0 && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-primary)]">
            Audit trail
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {decisions.map((d, i) => {
              const a = alerts.find(x => x.id === d.alertId)
              const approved = d.status === 'Approved'
              return (
                <div key={i} className="flex items-start gap-3 px-5 py-3">
                  <span
                    className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: approved ? '#30d18a' : 'var(--color-info)' }}
                  />
                  <div className="flex-1 min-w-0 text-xs">
                    <div className="text-[var(--color-text-primary)]">
                      <span style={{ color: approved ? '#30d18a' : 'var(--color-text-secondary)' }}>
                        {approved ? 'Approved' : 'Rejected'}
                      </span>
                      {' — '}
                      {a?.proposedAction?.action ?? 'action'} on{' '}
                      <span className="font-mono">{a?.sourceIP}</span>
                    </div>
                    <div className="text-[var(--color-info)] mt-0.5">{d.reason}</div>
                  </div>
                  <div className="text-[10px] font-mono text-[var(--color-text-muted)] whitespace-nowrap">
                    {d.by} · {d.at}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
