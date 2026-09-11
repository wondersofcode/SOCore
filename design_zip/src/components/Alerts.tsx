import { useMemo, useState } from 'react'
import { SeverityDot, AlertStatusPill, RiskBadge } from './Shared'
import { useStore } from '../store'
import { useAuth } from '../lib/AuthContext'
import { formatTime, formatShortDate } from '../lib/dateFormat'
import type { Alert, Severity, AlertStatus } from '../data'

const SEVERITIES: Severity[] = ['Critical', 'High', 'Medium', 'Low', 'Informational']
const STATUSES: AlertStatus[] = ['New', 'Enriching', 'Responding', 'Resolved']

const sevColor: Record<Severity, string> = {
  Critical: '#fb4a63',
  High: '#ff9d4d',
  Medium: '#f2c94c',
  Low: '#4f8cff',
  Informational: 'var(--color-info)',
}

const sevRank: Record<Severity, number> = {
  Critical: 0, High: 1, Medium: 2, Low: 3, Informational: 4,
}

type SortKey = 'time' | 'risk' | 'severity' | 'reputation'

// ── Reputation bar (enrichment signal — only lives on this screen) ──────────
function RepBar({ label, score }: { label: string; score: number }) {
  const color = score >= 75 ? '#fb4a63' : score >= 40 ? '#ff9d4d' : score > 0 ? '#f2c94c' : 'var(--color-border-bright)'
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-mono text-[var(--color-text-muted)] w-5">{label}</span>
      <div className="w-12 h-1 rounded-full bg-[var(--color-border)] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-[10px] font-mono w-6" style={{ color: score > 0 ? color : 'var(--color-text-muted)' }}>{score}</span>
    </div>
  )
}

// ── Facet group in the filter rail ─────────────────────────────────────────
function Facet({
  title, options, selected, counts, onToggle,
}: {
  title: string
  options: string[]
  selected: string[]
  counts: Record<string, number>
  onToggle: (v: string) => void
}) {
  return (
    <div className="border-b border-[var(--color-border)] px-3 py-3">
      <div className="text-[10px] font-semibold tracking-widest text-[var(--color-info)] mb-2">{title}</div>
      <div className="space-y-0.5">
        {options.map(opt => {
          const on = selected.includes(opt)
          return (
            <button
              key={opt}
              onClick={() => onToggle(opt)}
              className="w-full flex items-center gap-2 px-2 py-1 rounded text-[11px] transition-colors"
              style={{
                background: on ? '#4f8cff12' : 'transparent',
                color: on ? 'var(--color-text-primary)' : 'var(--color-text-secondary)',
              }}
            >
              <span
                className="w-3 h-3 rounded-[3px] border flex items-center justify-center shrink-0"
                style={{ borderColor: on ? '#4f8cff' : 'var(--color-border-bright)', background: on ? '#4f8cff' : 'transparent' }}
              >
                {on && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4l1.75 1.75L6.5 2.5" stroke="var(--color-background)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className="truncate">{opt}</span>
              <span className="ml-auto text-[10px] font-mono text-[var(--color-text-muted)]">{counts[opt] ?? 0}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function Alerts({ onSelectAlert }: { onSelectAlert: (id: string) => void }) {
  const { alerts } = useStore()
  const { profile } = useAuth()
  const timezone = profile?.timezone
  const [sevFilter, setSevFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [originFilter, setOriginFilter] = useState<string[]>([])
  const [unassignedOnly, setUnassignedOnly] = useState(false)
  const [sort, setSort] = useState<SortKey>('time')
  const [selected, setSelected] = useState<string[]>([])
  const [dense, setDense] = useState(false)

  const originOf = (a: Alert) => (a.country === 'INTERNAL' ? 'Internal' : 'External')

  const counts = useMemo(() => {
    const c: Record<string, number> = {}
    for (const a of alerts) {
      c[a.severity] = (c[a.severity] ?? 0) + 1
      c[a.status] = (c[a.status] ?? 0) + 1
      const o = originOf(a)
      c[o] = (c[o] ?? 0) + 1
    }
    return c
  }, [alerts])

  const rows = useMemo(() => {
    let out = alerts.filter(a => {
      if (sevFilter.length && !sevFilter.includes(a.severity)) return false
      if (statusFilter.length && !statusFilter.includes(a.status)) return false
      if (originFilter.length && !originFilter.includes(originOf(a))) return false
      if (unassignedOnly && a.analyst !== 'Unassigned') return false
      return true
    })
    out = [...out].sort((a, b) => {
      if (sort === 'risk') return b.riskScore - a.riskScore
      if (sort === 'severity') return sevRank[a.severity] - sevRank[b.severity]
      if (sort === 'reputation') return Math.max(b.vtScore, b.abuseScore) - Math.max(a.vtScore, a.abuseScore)
      return b.timestamp.localeCompare(a.timestamp)
    })
    return out
  }, [alerts, sevFilter, statusFilter, originFilter, unassignedOnly, sort])

  const toggle = (list: string[], set: (v: string[]) => void) => (v: string) =>
    set(list.includes(v) ? list.filter(x => x !== v) : [...list, v])

  const allSelected = rows.length > 0 && selected.length === rows.length
  const clearFilters = () => {
    setSevFilter([]); setStatusFilter([]); setOriginFilter([]); setUnassignedOnly(false)
  }
  const activeFilterCount = sevFilter.length + statusFilter.length + originFilter.length + (unassignedOnly ? 1 : 0)

  const newCount = alerts.filter(a => a.status === 'New').length
  const unassignedCount = alerts.filter(a => a.analyst === 'Unassigned').length
  const criticalOpen = alerts.filter(a => a.severity === 'Critical' && a.status !== 'Resolved').length
  const awaitingApproval = alerts.filter(a => a.approvalStatus === 'Pending').length

  const rowPad = dense ? 'py-1.5' : 'py-3'

  return (
    <div className="flex gap-3 items-start">
      {/* ── Filter rail ─────────────────────────────────────────────────── */}
      <aside className="w-52 shrink-0 bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg sticky top-0">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[var(--color-border)]">
          <span className="text-[11px] font-semibold text-[var(--color-text-primary)]">Filters</span>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-[10px] text-[#4f8cff] hover:underline">
              Clear {activeFilterCount}
            </button>
          )}
        </div>

        <Facet title="Severity" options={SEVERITIES} selected={sevFilter} counts={counts} onToggle={toggle(sevFilter, setSevFilter)} />
        <Facet title="Triage state" options={STATUSES} selected={statusFilter} counts={counts} onToggle={toggle(statusFilter, setStatusFilter)} />
        <Facet title="Origin" options={['External', 'Internal']} selected={originFilter} counts={counts} onToggle={toggle(originFilter, setOriginFilter)} />

        <div className="px-3 py-3">
          <button
            onClick={() => setUnassignedOnly(v => !v)}
            className="w-full flex items-center justify-between px-2 py-1.5 rounded text-[11px] transition-colors"
            style={{ background: unassignedOnly ? '#ff9d4d15' : 'transparent', color: unassignedOnly ? '#ff9d4d' : 'var(--color-text-secondary)' }}
          >
            <span>Needs an owner</span>
            <span className="font-mono text-[10px]">{unassignedCount}</span>
          </button>
        </div>
      </aside>

      {/* ── Queue ───────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Triage summary strip — queue health, not dashboard KPIs */}
        <div className="flex items-stretch bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg divide-x divide-[var(--color-border)]">
          {[
            { label: 'In queue', value: rows.length, color: 'var(--color-text-primary)' },
            { label: 'Awaiting triage', value: newCount, color: '#4f8cff' },
            { label: 'No owner', value: unassignedCount, color: '#ff9d4d' },
            { label: 'Critical open', value: criticalOpen, color: '#fb4a63' },
            { label: 'Needs approval', value: awaitingApproval, color: '#ff9d4d' },
          ].map(s => (
            <div key={s.label} className="flex-1 px-4 py-2.5">
              <div className="text-[10px] text-[var(--color-info)]">{s.label}</div>
              <div className="text-xl font-mono font-bold leading-tight" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
          <div className="flex items-center gap-2 px-4">
            <span className="text-[10px] text-[var(--color-info)]">Sort</span>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
              className="bg-[var(--color-background)] border border-[var(--color-border)] rounded px-2 py-1 text-[11px] text-[var(--color-text-primary)] focus:outline-none focus:border-[#4f8cff40]"
            >
              <option value="time">Newest first</option>
              <option value="risk">Highest risk</option>
              <option value="severity">Severity</option>
              <option value="reputation">Worst reputation</option>
            </select>
            <button
              onClick={() => setDense(d => !d)}
              className="text-[10px] px-2 py-1 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-bright)] transition-colors"
            >
              {dense ? 'Comfortable' : 'Compact'}
            </button>
          </div>
        </div>

        {/* Bulk action bar — appears only on selection */}
        {selected.length > 0 && (
          <div className="flex items-center gap-3 bg-[#4f8cff10] border border-[#4f8cff30] rounded-lg px-4 py-2">
            <span className="text-[11px] text-[#4f8cff] font-mono">{selected.length} selected</span>
            <div className="flex items-center gap-2 ml-auto">
              {['Assign to me', 'Escalate to case', 'Mark resolved'].map(a => (
                <button
                  key={a}
                  className="text-[11px] px-2.5 py-1 rounded border border-[#4f8cff30] text-[var(--color-text-primary)] hover:bg-[#4f8cff15] transition-colors"
                >
                  {a}
                </button>
              ))}
              <button onClick={() => setSelected([])} className="text-[11px] text-[var(--color-info)] hover:text-[var(--color-text-primary)] px-1">
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Queue table */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] bg-[var(--color-background)]">
                  <th className="pl-4 pr-2 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? [] : rows.map(r => r.id))}
                      className="w-3 h-3 accent-[#4f8cff] cursor-pointer"
                    />
                  </th>
                  {['Alert', 'Risk', 'Detected', 'Source', 'Technique', 'Reputation', 'State', 'Owner'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] tracking-widest text-[var(--color-info)] font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map(a => {
                  const checked = selected.includes(a.id)
                  const worst = Math.max(a.vtScore, a.abuseScore)
                  return (
                    <tr
                      key={a.id}
                      onClick={() => onSelectAlert(a.id)}
                      className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-2)] cursor-pointer group transition-colors"
                      style={checked ? { background: '#4f8cff08' } : undefined}
                    >
                      <td className={`pl-4 pr-2 ${rowPad}`} onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setSelected(s => checked ? s.filter(x => x !== a.id) : [...s, a.id])}
                          className="w-3 h-3 accent-[#4f8cff] cursor-pointer"
                        />
                      </td>

                      {/* Alert identity — severity carried by a rail, not a badge */}
                      <td className={`px-3 ${rowPad}`}>
                        <div className="flex items-center gap-2.5">
                          <span className="w-0.5 h-7 rounded-full shrink-0" style={{ background: sevColor[a.severity] }} />
                          <div className="min-w-0">
                            <div className="text-[var(--color-text-primary)] group-hover:text-[#4f8cff] transition-colors truncate">
                              {a.attackType}
                            </div>
                            <div className="text-[10px] font-mono text-[var(--color-text-muted)]">{a.id}</div>
                          </div>
                        </div>
                      </td>

                      <td className={`px-3 ${rowPad} whitespace-nowrap`}>
                        <RiskBadge score={a.riskScore} />
                        {a.approvalStatus === 'Pending' && (
                          <div className="text-[9px] text-[#ff9d4d] mt-0.5">needs approval</div>
                        )}
                      </td>

                      <td className={`px-3 ${rowPad} font-mono text-[var(--color-text-secondary)] whitespace-nowrap`}>
                        {formatTime(a.timestamp, timezone)}
                        <span className="text-[var(--color-text-muted)] text-[10px] ml-1.5">{formatShortDate(a.timestamp, timezone)}</span>
                      </td>

                      <td className={`px-3 ${rowPad} whitespace-nowrap`}>
                        <div className="font-mono text-[var(--color-text-primary)]">{a.sourceIP}</div>
                        <div className="text-[10px] text-[var(--color-text-muted)] truncate max-w-[140px]">
                          {a.country === 'INTERNAL' ? 'Internal network' : `${a.country} · ${a.asn.split(' ')[0]}`}
                        </div>
                      </td>

                      <td className={`px-3 ${rowPad} whitespace-nowrap`}>
                        <span className="font-mono text-[#9c8bfb]">{a.mitreId}</span>
                        <div className="text-[10px] text-[var(--color-text-muted)] truncate max-w-[130px]">{a.mitreName}</div>
                      </td>

                      {/* Enrichment — the column the dashboard never shows */}
                      <td className={`px-3 ${rowPad}`}>
                        {worst > 0 ? (
                          <div className="space-y-1">
                            <RepBar label="VT" score={a.vtScore} />
                            <RepBar label="AIP" score={a.abuseScore} />
                          </div>
                        ) : (
                          <span className="text-[10px] font-mono text-[var(--color-text-muted)]">no reputation data</span>
                        )}
                      </td>

                      <td className={`px-3 ${rowPad}`}><AlertStatusPill status={a.status} /></td>

                      <td className={`px-3 ${rowPad} whitespace-nowrap`}>
                        {a.analyst === 'Unassigned' ? (
                          <button
                            onClick={e => e.stopPropagation()}
                            className="text-[10px] px-2 py-0.5 rounded border border-[var(--color-border-bright)] text-[var(--color-text-secondary)] hover:border-[#4f8cff40] hover:text-[#4f8cff] transition-colors"
                          >
                            Claim
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-[var(--color-border)] text-[9px] font-mono text-[var(--color-text-secondary)] flex items-center justify-center">
                              {a.analyst.replace('. ', '').slice(0, 2).toUpperCase()}
                            </span>
                            <span className="text-[var(--color-text-secondary)]">{a.analyst}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {rows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-14 gap-2">
              <div className="text-sm text-[var(--color-text-primary)]">Nothing matches these filters</div>
              <div className="text-xs text-[var(--color-info)]">Widen the severity or state selection to see more of the queue.</div>
              <button onClick={clearFilters} className="mt-1 text-xs text-[#4f8cff] hover:underline">
                Clear all filters
              </button>
            </div>
          )}

          {rows.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--color-border)] text-[10px] font-mono text-[var(--color-text-muted)]">
              <span>Showing {rows.length} of {alerts.length} alerts</span>
              <span className="flex items-center gap-1.5">
                <SeverityDot severity="Critical" />
                {alerts.filter(a => a.severity === 'Critical').length} critical in window
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
