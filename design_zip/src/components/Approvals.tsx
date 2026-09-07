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
    <div className="bg-[#161b22] border border-[#f9731630] rounded-lg overflow-hidden">
      {/* What the automation wants to do */}
      <div className="flex items-start gap-4 px-5 py-4">
        <RiskScore score={alert.riskScore} size="lg" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[#e6edf3] font-semibold">{action.action}</span>
            {action.dryRun && (
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#21262d] text-[#8b949e]">
                simulated
              </span>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-[#8b949e] flex-wrap">
            <span className="font-mono text-[#e6edf3]">{action.target}</span>
            <span className="text-[#30363d]">·</span>
            <span>{alert.attackType}</span>
            <span className="text-[#30363d]">·</span>
            <span className="font-mono text-[#a855f7]">{alert.mitreId}</span>
            <span className="text-[#30363d]">·</span>
            <button onClick={() => onSelectAlert(alert.id)} className="font-mono text-[#00d4ff] hover:underline">
              {alert.id}
            </button>
          </div>
          <div className="mt-1.5 text-[11px] font-mono text-[#484f58]">
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
      <div className="border-t border-[#21262d] bg-[#0d1117] px-5 py-3 flex items-center gap-3">
        <input
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Reason for the decision (recorded in the audit trail)"
          className="flex-1 bg-[#161b22] border border-[#21262d] rounded-lg px-3 py-1.5 text-xs text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#00d4ff40] transition-colors"
        />
        <button
          onClick={() => decide(alert.id, 'Rejected', reason || 'No reason given')}
          className="px-3 py-1.5 rounded-lg border border-[#30363d] text-xs text-[#8b949e] hover:text-[#e6edf3] hover:border-[#484f58] transition-colors whitespace-nowrap"
        >
          Reject
        </button>
        <button
          onClick={() => decide(alert.id, 'Approved', reason || 'No reason given')}
          className="px-4 py-1.5 rounded-lg bg-[#22c55e20] border border-[#22c55e50] text-xs font-semibold text-[#22c55e] hover:bg-[#22c55e30] transition-colors whitespace-nowrap"
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
      <div className="bg-[#161b22] border border-[#21262d] rounded-lg px-5 py-4">
        <div className="text-sm text-[#e6edf3] mb-1">Nothing here runs without you</div>
        <p className="text-xs text-[#8b949e] leading-relaxed max-w-2xl">
          Low-risk work — notifying the channel, enriching indicators, opening a case — happens on its own.
          Anything that changes the network waits here for a decision, and every decision is written to the
          audit trail with the reason you give.
        </p>
        <div className="mt-3 flex items-center gap-5 text-[11px] font-mono">
          <span className="text-[#f97316]">{pending.length} waiting on a human</span>
          <span className="text-[#22c55e]">{autoHandled} handled automatically</span>
          <span className="text-[#8b949e]">{decisions.length} decided this session</span>
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
        <div className="bg-[#161b22] border border-[#21262d] rounded-lg flex flex-col items-center justify-center py-14 gap-2">
          <div className="w-10 h-10 rounded-full bg-[#22c55e15] border border-[#22c55e30] flex items-center justify-center">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path d="M4 9.5l3.5 3.5L14 6" stroke="#22c55e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="text-sm text-[#e6edf3]">No actions are waiting</div>
          <div className="text-xs text-[#6b7280]">
            New requests appear here as soon as a playbook proposes a change to the network.
          </div>
        </div>
      )}

      {/* Audit trail */}
      {decisions.length > 0 && (
        <div className="bg-[#161b22] border border-[#21262d] rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-[#21262d] text-xs font-semibold text-[#e6edf3]">
            Audit trail
          </div>
          <div className="divide-y divide-[#21262d]">
            {decisions.map((d, i) => {
              const a = alerts.find(x => x.id === d.alertId)
              const approved = d.status === 'Approved'
              return (
                <div key={i} className="flex items-start gap-3 px-5 py-3">
                  <span
                    className="mt-0.5 w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: approved ? '#22c55e' : '#6b7280' }}
                  />
                  <div className="flex-1 min-w-0 text-xs">
                    <div className="text-[#e6edf3]">
                      <span style={{ color: approved ? '#22c55e' : '#8b949e' }}>
                        {approved ? 'Approved' : 'Rejected'}
                      </span>
                      {' — '}
                      {a?.proposedAction?.action ?? 'action'} on{' '}
                      <span className="font-mono">{a?.sourceIP}</span>
                    </div>
                    <div className="text-[#6b7280] mt-0.5">{d.reason}</div>
                  </div>
                  <div className="text-[10px] font-mono text-[#484f58] whitespace-nowrap">
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
