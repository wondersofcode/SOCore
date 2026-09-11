import { useState } from 'react'
import { SeverityBadge, CaseStatusPill, SeverityDot } from './Shared'
import { useStore } from '../store'
import { useAuth } from '../lib/AuthContext'
import { formatTime } from '../lib/dateFormat'
import type { Case, CaseStatus } from '../data'

const STATUS_FLOW: CaseStatus[] = ['Open', 'Investigating', 'Contained', 'Closed']

function CaseDetail({ caseItem, onClose }: { caseItem: Case; onClose: () => void }) {
  const { alerts, currentUser, updateCaseStatus, addCaseNote, toggleCaseTask, live } = useStore()
  const { profile } = useAuth()
  const timezone = profile?.timezone
  const [note, setNote] = useState('')

  const linkedAlerts = caseItem.alertIds
    ? alerts.filter(a => caseItem.alertIds!.includes(a.id))
    : alerts.filter((_, i) => i < caseItem.alertCount && i < 4)

  const notes = caseItem.notes ?? []
  const tasks = caseItem.tasks ?? []
  const doneCount = tasks.filter(t => t.done).length

  const addNote = () => {
    if (!note.trim()) return
    addCaseNote(caseItem.id, currentUser, note.trim())
    setNote('')
  }

  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/60 backdrop-blur-sm" />
      <div className="w-full max-w-2xl bg-[var(--color-background)] border-l border-[var(--color-border)] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="sticky top-0 bg-[var(--color-background)] border-b border-[var(--color-border)] px-6 py-4 flex items-start justify-between">
          <div className="flex flex-col gap-2 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <SeverityBadge severity={caseItem.severity} />
              <CaseStatusPill status={caseItem.status} />
              {typeof caseItem.riskScore === 'number' && (
                <span className="text-[10px] font-mono text-[var(--color-info)]">risk {caseItem.riskScore}</span>
              )}
            </div>
            <div className="text-[var(--color-text-primary)] font-semibold text-base">{caseItem.title}</div>
            <div className="flex items-center gap-3 text-xs font-mono flex-wrap">
              <span className="text-[#00d4ff]">{caseItem.id}</span>
              <span className="text-[var(--color-text-muted)]">·</span>
              <span className="text-[var(--color-text-secondary)]">{caseItem.assignedTo}</span>
              <span className="text-[var(--color-text-muted)]">·</span>
              <span className="text-[var(--color-info)]">opened {caseItem.created}</span>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {caseItem.tags.map(tag => (
                <span key={tag} className="px-2 py-0.5 bg-[var(--color-border)] rounded text-[10px] font-mono text-[var(--color-text-secondary)]">#{tag}</span>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--color-info)] hover:text-[var(--color-text-primary)] transition-colors p-1 shrink-0">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4l10 10M14 4L4 14" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="flex items-center gap-1.5 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-1.5">
            {STATUS_FLOW.map(s => (
              <button
                key={s}
                onClick={() => updateCaseStatus(caseItem.id, s)}
                className="flex-1 text-[10px] font-semibold uppercase tracking-wider py-1.5 rounded transition-colors"
                style={caseItem.status === s ? { background: '#00d4ff20', color: '#00d4ff' } : { color: 'var(--color-info)' }}
              >
                {s}
              </button>
            ))}
          </div>
          {!live && (
            <div className="text-[10px] text-[#f97316] -mt-2">
              Backend not connected — status changes here won't be saved.
            </div>
          )}

          {caseItem.summary && (
            <div className="rounded-lg border border-[#a855f730] bg-[#a855f708] p-3.5">
              <div className="text-[11px] font-semibold text-[#a855f7] mb-1.5">Opened from</div>
              <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{caseItem.summary}</p>
            </div>
          )}

          {tasks.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="text-[10px] uppercase tracking-widest text-[var(--color-info)] font-semibold">Response Checklist</div>
                <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{doneCount}/{tasks.length}</span>
              </div>
              <div className="space-y-1.5">
                {tasks.map(t => (
                  <button
                    key={t.id}
                    onClick={() => toggleCaseTask(caseItem.id, t.id)}
                    className="w-full flex items-center gap-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 hover:border-[var(--color-border-bright)] transition-colors text-left"
                  >
                    <span
                      className="w-4 h-4 rounded border flex items-center justify-center shrink-0"
                      style={{ borderColor: t.done ? '#22c55e' : 'var(--color-border-bright)', background: t.done ? '#22c55e20' : 'transparent' }}
                    >
                      {t.done && (
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M2 5l2 2 4-4" stroke="#22c55e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    <span className={`text-xs ${t.done ? 'text-[var(--color-info)] line-through' : 'text-[var(--color-text-primary)]'}`}>{t.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-info)] font-semibold mb-3">
              Linked Alerts <span className="text-[var(--color-text-muted)] ml-1">({linkedAlerts.length})</span>
            </div>
            <div className="space-y-2">
              {linkedAlerts.map(a => (
                <div key={a.id} className="flex items-center gap-3 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 hover:border-[var(--color-border-bright)] transition-colors">
                  <SeverityDot severity={a.severity} />
                  <span className="font-mono text-[10px] text-[var(--color-text-muted)] shrink-0">{a.id}</span>
                  <span className="text-xs text-[var(--color-text-primary)] flex-1 truncate">{a.attackType}</span>
                  <span className="font-mono text-[10px] text-[#a855f7] shrink-0">{a.mitreId}</span>
                  <span className="font-mono text-[10px] text-[var(--color-info)] shrink-0">{formatTime(a.timestamp, timezone)}</span>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-info)] font-semibold mb-3">Analyst Notes</div>
            <div className="space-y-3">
              {notes.length === 0 && <div className="text-xs text-[var(--color-text-muted)]">No notes yet.</div>}
              {notes.map((n, i) => (
                <div key={i} className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[10px] font-semibold text-[#00d4ff]">{n.author}</span>
                    <span className="text-[var(--color-text-muted)]">·</span>
                    <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{n.at}</span>
                  </div>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{n.text}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={3}
              placeholder="Add analyst note..."
              className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2.5 text-xs font-mono text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[#00d4ff] transition-colors resize-none"
            />
            <button
              onClick={addNote}
              className="mt-2 px-4 py-2 rounded-lg bg-[#00d4ff15] border border-[#00d4ff40] text-[#00d4ff] text-xs font-semibold uppercase tracking-wider hover:bg-[#00d4ff25] transition-colors"
            >
              Add Note
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function NewCaseModal({ onClose }: { onClose: () => void }) {
  const { alerts, currentUser, createCase, live } = useStore()
  const [alertId, setAlertId] = useState('')
  const [title, setTitle] = useState('')
  const [busy, setBusy] = useState(false)

  const eligible = alerts.filter(a => a.status !== 'Resolved')

  const submit = async () => {
    if (!alertId) return
    setBusy(true)
    const created = await createCase(alertId, title.trim() || undefined, currentUser)
    setBusy(false)
    if (created) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div className="relative w-full max-w-md bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg p-5" onClick={e => e.stopPropagation()}>
        <div className="text-sm font-semibold text-[var(--color-text-primary)] mb-4">Escalate an alert to a case</div>

        {!live && (
          <div className="text-[11px] text-[#f97316] bg-[#f9731610] border border-[#f9731630] rounded-lg px-3 py-2 mb-3">
            Backend not connected. Connect it to create real cases.
          </div>
        )}

        <label className="block text-[10px] uppercase tracking-widest text-[var(--color-info)] font-semibold mb-1.5">Alert</label>
        <select
          value={alertId}
          onChange={e => setAlertId(e.target.value)}
          className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)] mb-3 focus:outline-none focus:border-[#00d4ff40]"
        >
          <option value="">Select an alert…</option>
          {eligible.map(a => (
            <option key={a.id} value={a.id}>{a.id} — {a.attackType} ({a.sourceIP})</option>
          ))}
        </select>

        <label className="block text-[10px] uppercase tracking-widest text-[var(--color-info)] font-semibold mb-1.5">Title (optional)</label>
        <input
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Defaults to the alert's attack type and source"
          className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-2 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] mb-4 focus:outline-none focus:border-[#00d4ff40]"
        />

        <div className="flex items-center justify-end gap-2">
          <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]">Cancel</button>
          <button
            onClick={submit}
            disabled={!alertId || !live || busy}
            className="px-4 py-1.5 rounded-lg bg-[#00d4ff15] border border-[#00d4ff40] text-[#00d4ff] text-xs font-semibold disabled:opacity-40 disabled:cursor-not-allowed hover:bg-[#00d4ff25] transition-colors"
          >
            {busy ? 'Creating…' : 'Create case'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function CaseManagement() {
  const { cases } = useStore()
  const [selectedCase, setSelectedCase] = useState<Case | null>(null)
  const [statusFilter, setStatusFilter] = useState<'All' | CaseStatus>('All')
  const [showNewCase, setShowNewCase] = useState(false)

  const filtered = statusFilter === 'All' ? cases : cases.filter(c => c.status === statusFilter)
  const openCase = selectedCase ? cases.find(c => c.id === selectedCase.id) ?? selectedCase : null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {(['All', ...STATUS_FLOW] as const).map(s => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 rounded text-[10px] font-semibold uppercase tracking-widest transition-colors border ${
                statusFilter === s
                  ? 'bg-[#00d4ff15] border-[#00d4ff40] text-[#00d4ff]'
                  : 'border-transparent text-[var(--color-info)] hover:text-[var(--color-text-secondary)]'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={() => setShowNewCase(true)}
          className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#00d4ff15] border border-[#00d4ff40] text-[#00d4ff] text-[10px] font-semibold uppercase tracking-wider hover:bg-[#00d4ff25] transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
            <path d="M6 1v10M1 6h10" />
          </svg>
          New Case
        </button>
      </div>

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              {['Case ID', 'Title', 'Severity', 'Status', 'Assigned To', 'Alerts', 'Created'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-[var(--color-info)] font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => (
              <tr
                key={c.id}
                onClick={() => setSelectedCase(c)}
                className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-2)] cursor-pointer group transition-colors"
              >
                <td className="px-4 py-3 font-mono text-[#00d4ff] group-hover:text-[#33ddff] transition-colors">{c.id}</td>
                <td className="px-4 py-3 text-[var(--color-text-primary)] max-w-[240px] truncate">{c.title}</td>
                <td className="px-4 py-3"><SeverityBadge severity={c.severity} /></td>
                <td className="px-4 py-3"><CaseStatusPill status={c.status} /></td>
                <td className="px-4 py-3 text-[var(--color-text-secondary)]">{c.assignedTo}</td>
                <td className="px-4 py-3 font-mono text-[var(--color-text-secondary)]">{c.alertIds?.length ?? c.alertCount}</td>
                <td className="px-4 py-3 font-mono text-[var(--color-info)] whitespace-nowrap">{c.created}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-[var(--color-text-muted)] font-mono">No cases in this state.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {openCase && <CaseDetail caseItem={openCase} onClose={() => setSelectedCase(null)} />}
      {showNewCase && <NewCaseModal onClose={() => setShowNewCase(false)} />}
    </div>
  )
}
