import { useEffect, useState } from 'react'
import { SeverityBadge, AlertStatusPill, RiskScore, AiExplanation, ApprovalPill, SourceRow, SimStatusPill } from './Shared'
import { useStore } from '../store'
import { useAuth } from '../lib/AuthContext'
import { formatDateTime, formatTimeOfDay } from '../lib/dateFormat'
import { api } from '../api'
import type { SimulationRun } from '../data'

interface TimelineStep {
  label: string
  time: string
  done: boolean
  color: string
}

export default function AlertDetail({
  alertId,
  onClose,
  onViewEvent,
}: {
  alertId: string
  onClose: () => void
  onViewEvent?: (eventId: string) => void
}) {
  const { alerts, decide } = useStore()
  const { profile } = useAuth()
  const timezone = profile?.timezone
  const alert = alerts.find(a => a.id === alertId)
  const [note, setNote] = useState('')
  const [noteSubmitted, setNoteSubmitted] = useState(false)
  const [reason, setReason] = useState('')
  const [showFullAi, setShowFullAi] = useState(false)
  const [relatedSimRun, setRelatedSimRun] = useState<SimulationRun | null>(null)

  useEffect(() => {
    if (!alert) return
    api.simulationRuns({ techniqueId: alert.mitreId })
      .then(runs => setRelatedSimRun(runs.find(r => r.detectionAlertId === alert.id) ?? null))
      .catch(() => setRelatedSimRun(null))
  }, [alert?.id, alert?.mitreId])

  if (!alert) return null

  const steps: TimelineStep[] = [
    { label: 'Detected', time: formatTimeOfDay(alert.detectedAt, alert.timestamp, timezone), done: true, color: '#4f8cff' },
    { label: 'Enriched', time: alert.enrichedAt ? formatTimeOfDay(alert.enrichedAt, alert.timestamp, timezone) : '—', done: !!alert.enrichedAt, color: '#9c8bfb' },
    { label: 'Responded', time: alert.respondedAt ? formatTimeOfDay(alert.respondedAt, alert.timestamp, timezone) : '—', done: !!alert.respondedAt, color: '#ff9d4d' },
    { label: 'Tracked', time: alert.status === 'Resolved' ? formatTimeOfDay('09:45:00', alert.timestamp, timezone) : '—', done: alert.status === 'Resolved', color: '#30d18a' },
  ]

  const vtColor = alert.vtScore >= 75 ? '#fb4a63' : alert.vtScore >= 40 ? '#ff9d4d' : '#30d18a'
  const abuseColor = alert.abuseScore >= 75 ? '#fb4a63' : alert.abuseScore >= 40 ? '#ff9d4d' : '#30d18a'

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      {/* Backdrop */}
      <div className="flex-1 bg-black/60 backdrop-blur-sm" />
      {/* Panel */}
      <div
        className="w-full max-w-2xl bg-[var(--color-background)] border-l border-[var(--color-border)] overflow-y-auto flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-[var(--color-background)] border-b border-[var(--color-border)] px-6 py-4 flex items-start justify-between z-10">
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-3 flex-wrap">
              <SeverityBadge severity={alert.severity} />
              <AlertStatusPill status={alert.status} />
              <ApprovalPill status={alert.approvalStatus} />
            </div>
            <div className="text-[var(--color-text-primary)] font-semibold text-lg leading-tight">{alert.attackType}</div>
            <div className="flex items-center gap-3 text-xs">
              <span className="font-mono text-[#9c8bfb]">{alert.mitreId}</span>
              <span className="text-[var(--color-text-muted)]">·</span>
              <span className="text-[var(--color-text-secondary)]">{alert.mitreName}</span>
              <span className="text-[var(--color-text-muted)]">·</span>
              <span className="font-mono text-[var(--color-text-secondary)]">{formatDateTime(alert.timestamp, timezone)}</span>
            </div>
            {relatedSimRun && (
              <div className="flex items-center gap-2 text-[11px]">
                <span className="text-[#9c8bfb]">Detected via simulation</span>
                <span className="font-mono text-[var(--color-text-muted)]">{relatedSimRun.simulationName}</span>
                <SimStatusPill status={relatedSimRun.status} />
              </div>
            )}
          </div>
          <div className="flex items-start gap-4">
            <RiskScore score={alert.riskScore} size="lg" />
          <button
            onClick={onClose}
            className="text-[var(--color-info)] hover:text-[var(--color-text-primary)] transition-colors p-1"
          >
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4l10 10M14 4L4 14" />
            </svg>
          </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* AI reasoning — the first thing an analyst should read */}
          <AiExplanation
            text={alert.aiExplanation}
            confidence={alert.aiConfidence}
            collapsed={!showFullAi}
            onToggle={() => setShowFullAi(v => !v)}
          />

          {/* Pending decision */}
          {alert.approvalStatus === 'Pending' && alert.proposedAction && (
            <div className="rounded-lg border border-[#ff9d4d40] bg-[#ff9d4d08] overflow-hidden">
              <div className="px-4 py-3">
                <div className="text-[11px] font-semibold text-[#ff9d4d] mb-1.5">Waiting for your decision</div>
                <div className="text-sm text-[var(--color-text-primary)]">{alert.proposedAction.action}</div>
                <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                  Target <span className="font-mono text-[var(--color-text-primary)]">{alert.proposedAction.target}</span>
                  {alert.proposedAction.dryRun && ' · runs in simulation mode'}
                </div>
                <div className="mt-1 text-[10px] font-mono text-[var(--color-text-muted)]">
                  Raised by {alert.proposedAction.playbook} because risk scored {alert.riskScore}, above the threshold of 70
                </div>
              </div>
              <div className="border-t border-[#ff9d4d30] bg-[var(--color-background)] px-4 py-3 flex items-center gap-2">
                <input
                  value={reason}
                  onChange={e => setReason(e.target.value)}
                  placeholder="Reason (recorded in the audit trail)"
                  className="flex-1 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[#4f8cff40]"
                />
                <button
                  onClick={() => decide(alert.id, 'Rejected', reason || 'No reason given')}
                  className="px-3 py-1.5 rounded-lg border border-[var(--color-border-bright)] text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={() => decide(alert.id, 'Approved', reason || 'No reason given')}
                  className="px-3 py-1.5 rounded-lg bg-[#30d18a20] border border-[#30d18a50] text-xs font-semibold text-[#30d18a] hover:bg-[#30d18a30] transition-colors whitespace-nowrap"
                >
                  Approve and run
                </button>
              </div>
            </div>
          )}

          {/* Already decided */}
          {(alert.approvalStatus === 'Approved' || alert.approvalStatus === 'Rejected') && alert.proposedAction && (
            <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3">
              <div className="text-[11px] text-[var(--color-info)] mb-1">
                {alert.approvalStatus === 'Approved' ? 'Approved by an analyst' : 'Rejected by an analyst'}
              </div>
              <div className="text-sm text-[var(--color-text-primary)]">{alert.proposedAction.action}</div>
              <div className="mt-1 text-xs text-[var(--color-text-secondary)]">
                {alert.approvalStatus === 'Approved'
                  ? `Playbook ${alert.proposedAction.playbook} ran in simulation mode against ${alert.proposedAction.target}.`
                  : 'No change was made to the network.'}
              </div>
            </div>
          )}
          {/* Alert ID & Source */}
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div><div className="text-[var(--color-info)] mb-1 uppercase tracking-widest text-[10px]">Alert ID</div><div className="font-mono text-[var(--color-text-primary)]">{alert.id}</div></div>
              <div><div className="text-[var(--color-info)] mb-1 uppercase tracking-widest text-[10px]">Source IP</div><div className="font-mono text-[var(--color-text-primary)]">{alert.sourceIP}</div></div>
              <div><div className="text-[var(--color-info)] mb-1 uppercase tracking-widest text-[10px]">Country</div><div className="font-mono text-[var(--color-text-primary)]">{alert.country}</div></div>
              <div><div className="text-[var(--color-info)] mb-1 uppercase tracking-widest text-[10px]">ASN</div><div className="font-mono text-[var(--color-text-primary)]">{alert.asn}</div></div>
              <div><div className="text-[var(--color-info)] mb-1 uppercase tracking-widest text-[10px]">Risk score</div><div className="font-mono text-[var(--color-text-primary)]">{alert.riskScore} / 100</div></div>
              <div><div className="text-[var(--color-info)] mb-1 uppercase tracking-widest text-[10px]">Owner</div><div className="font-mono text-[var(--color-text-primary)]">{alert.analyst}</div></div>
            </div>
            {alert.sourceEventId && (
              <button
                onClick={() => onViewEvent?.(alert.sourceEventId!)}
                className="mt-3 text-[11px] font-mono text-[#4f8cff] hover:underline flex items-center gap-1.5"
              >
                <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round">
                  <path d="M1 6s2-3.5 5-3.5S11 6 11 6s-2 3.5-5 3.5S1 6 1 6Z" />
                  <circle cx="6" cy="6" r="1.5" />
                </svg>
                View raw event ({alert.sourceEventId})
              </button>
            )}
          </div>

          {/* Threat Intel */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-info)] font-semibold mb-3">Threat Intelligence</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded bg-[var(--color-surface-2)] flex items-center justify-center">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <circle cx="6" cy="6" r="5" stroke="var(--color-text-secondary)" strokeWidth="1" />
                      <path d="M4 6h4M6 4v4" stroke="var(--color-text-secondary)" strokeWidth="1" strokeLinecap="round" />
                    </svg>
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-[var(--color-info)]">VirusTotal</span>
                </div>
                <div className="text-2xl font-bold font-mono" style={{ color: vtColor }}>{alert.vtScore}<span className="text-base text-[var(--color-text-muted)]">/100</span></div>
                <div className="text-[10px] text-[var(--color-info)] mt-1">Malicious score</div>
              </div>
              <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded bg-[var(--color-surface-2)] flex items-center justify-center">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M6 1L7.5 4.5H11L8.5 7L9.5 10.5L6 8.5L2.5 10.5L3.5 7L1 4.5H4.5L6 1Z" stroke="var(--color-text-secondary)" strokeWidth="1" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="text-[10px] uppercase tracking-widest text-[var(--color-info)]">AbuseIPDB</span>
                </div>
                <div className="text-2xl font-bold font-mono" style={{ color: abuseColor }}>{alert.abuseScore}<span className="text-base text-[var(--color-text-muted)]">%</span></div>
                <div className="text-[10px] text-[var(--color-info)] mt-1">Abuse confidence</div>
              </div>
            </div>
          </div>

          {/* Where the enrichment came from */}
          <div>
            <div className="text-[11px] font-semibold text-[var(--color-text-primary)] mb-2">Enrichment trail</div>
            <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-1">
              {alert.sources.map(src => <SourceRow key={src.name} source={src} />)}
            </div>
          </div>

          {/* Raw Log */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-info)] font-semibold mb-3">Raw Log Excerpt</div>
            <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#fb4a63] opacity-60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#f2c94c] opacity-60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#30d18a] opacity-60" />
                </div>
                <span className="text-[10px] font-mono text-[var(--color-text-muted)] ml-2">raw.log</span>
              </div>
              <pre className="p-4 text-[11px] font-mono text-[var(--color-text-secondary)] overflow-x-auto leading-relaxed whitespace-pre-wrap">
                <code>{alert.raw}</code>
              </pre>
            </div>
          </div>

          {/* Timeline */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-info)] font-semibold mb-4">Response Timeline</div>
            <div className="relative">
              {/* Line */}
              <div className="absolute left-[18px] top-0 bottom-0 w-px bg-[var(--color-border)]" />
              <div className="space-y-5">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div
                      className="relative z-10 w-9 h-9 rounded-full border-2 flex items-center justify-center shrink-0"
                      style={{
                        borderColor: step.done ? step.color : 'var(--color-border)',
                        background: step.done ? `${step.color}15` : 'var(--color-surface)',
                        boxShadow: step.done ? `0 0 12px ${step.color}30` : 'none',
                      }}
                    >
                      {step.done
                        ? <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke={step.color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        : <div className="w-2 h-2 rounded-full bg-[var(--color-border)]" />
                      }
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-[var(--color-text-primary)]">{step.label}</div>
                      <div className="text-[10px] font-mono text-[var(--color-info)]">{step.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Add Note */}
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-info)] font-semibold mb-3">Add Note</div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="Add analyst note..."
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-xs font-mono text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[#4f8cff] transition-colors resize-none"
            />
          </div>
        </div>

        {/* Action Bar */}
        <div className="sticky bottom-0 bg-[var(--color-background)] border-t border-[var(--color-border)] px-6 py-4 flex items-center gap-3">
          <button className="flex-1 py-2 rounded-lg bg-[#fb4a6320] border border-[#fb4a6340] text-[#fb4a63] text-xs font-semibold uppercase tracking-wider hover:bg-[#fb4a6330] transition-colors">
            Escalate to Case
          </button>
          <button className="flex-1 py-2 rounded-lg bg-[#f2c94c20] border border-[#f2c94c40] text-[#f2c94c] text-xs font-semibold uppercase tracking-wider hover:bg-[#f2c94c30] transition-colors">
            Mark False Positive
          </button>
          <button
            onClick={() => { if (note.trim()) { setNoteSubmitted(true); setNote('') } }}
            className="flex-1 py-2 rounded-lg bg-[#4f8cff15] border border-[#4f8cff40] text-[#4f8cff] text-xs font-semibold uppercase tracking-wider hover:bg-[#4f8cff25] transition-colors"
          >
            {noteSubmitted ? 'Note Saved ✓' : 'Save Note'}
          </button>
        </div>
      </div>
    </div>
  )
}
