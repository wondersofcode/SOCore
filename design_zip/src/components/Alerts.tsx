import { useMemo, useState } from 'react'
import { SeverityDot, AlertStatusPill, RiskBadge } from './Shared'
import { useStore } from '../store'
import type { Alert, Severity, AlertStatus } from '../data'

const SEVERITIES: Severity[] = ['Critical', 'High', 'Medium', 'Low', 'Informational']
const STATUSES: AlertStatus[] = ['New', 'Enriching', 'Responding', 'Resolved']

const sevColor: Record<Severity, string> = {
  Critical: '#ef4444',
  High: '#f97316',
  Medium: '#eab308',
  Low: '#3b82f6',
  Informational: '#6b7280',
}

const sevRank: Record<Severity, number> = {
  Critical: 0, High: 1, Medium: 2, Low: 3, Informational: 4,
}

type SortKey = 'time' | 'risk' | 'severity' | 'reputation'

// ── Reputation bar (enrichment signal — only lives on this screen) ──────────
function RepBar({ label, score }: { label: string; score: number }) {
  const color = score >= 75 ? '#ef4444' : score >= 40 ? '#f97316' : score > 0 ? '#eab308' : '#30363d'
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[9px] font-mono text-[#484f58] w-5">{label}</span>
      <div className="w-12 h-1 rounded-full bg-[#21262d] overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </div>
      <span className="text-[10px] font-mono w-6" style={{ color: score > 0 ? color : '#484f58' }}>{score}</span>
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
    <div className="border-b border-[#21262d] px-3 py-3">
      <div className="text-[10px] font-semibold tracking-widest text-[#6b7280] mb-2">{title}</div>
      <div className="space-y-0.5">
        {options.map(opt => {
          const on = selected.includes(opt)
          return (
            <button
              key={opt}
              onClick={() => onToggle(opt)}
              className="w-full flex items-center gap-2 px-2 py-1 rounded text-[11px] transition-colors"
              style={{
                background: on ? '#00d4ff12' : 'transparent',
                color: on ? '#e6edf3' : '#8b949e',
              }}
            >
              <span
                className="w-3 h-3 rounded-[3px] border flex items-center justify-center shrink-0"
                style={{ borderColor: on ? '#00d4ff' : '#30363d', background: on ? '#00d4ff' : 'transparent' }}
              >
                {on && (
                  <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                    <path d="M1.5 4l1.75 1.75L6.5 2.5" stroke="#0d1117" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </span>
              <span className="truncate">{opt}</span>
              <span className="ml-auto text-[10px] font-mono text-[#484f58]">{counts[opt] ?? 0}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export default function Alerts({ onSelectAlert }: { onSelectAlert: (id: string) => void }) {
  const { alerts } = useStore()
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
      <aside className="w-52 shrink-0 bg-[#161b22] border border-[#21262d] rounded-lg sticky top-0">
        <div className="flex items-center justify-between px-3 py-2.5 border-b border-[#21262d]">
          <span className="text-[11px] font-semibold text-[#e6edf3]">Filters</span>
          {activeFilterCount > 0 && (
            <button onClick={clearFilters} className="text-[10px] text-[#00d4ff] hover:underline">
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
            style={{ background: unassignedOnly ? '#f9731615' : 'transparent', color: unassignedOnly ? '#f97316' : '#8b949e' }}
          >
            <span>Needs an owner</span>
            <span className="font-mono text-[10px]">{unassignedCount}</span>
          </button>
        </div>
      </aside>

      {/* ── Queue ───────────────────────────────────────────────────────── */}
      <div className="flex-1 min-w-0 space-y-3">
        {/* Triage summary strip — queue health, not dashboard KPIs */}
        <div className="flex items-stretch bg-[#161b22] border border-[#21262d] rounded-lg divide-x divide-[#21262d]">
          {[
            { label: 'In queue', value: rows.length, color: '#e6edf3' },
            { label: 'Awaiting triage', value: newCount, color: '#00d4ff' },
            { label: 'No owner', value: unassignedCount, color: '#f97316' },
            { label: 'Critical open', value: criticalOpen, color: '#ef4444' },
            { label: 'Needs approval', value: awaitingApproval, color: '#f97316' },
          ].map(s => (
            <div key={s.label} className="flex-1 px-4 py-2.5">
              <div className="text-[10px] text-[#6b7280]">{s.label}</div>
              <div className="text-xl font-mono font-bold leading-tight" style={{ color: s.color }}>{s.value}</div>
            </div>
          ))}
          <div className="flex items-center gap-2 px-4">
            <span className="text-[10px] text-[#6b7280]">Sort</span>
            <select
              value={sort}
              onChange={e => setSort(e.target.value as SortKey)}
              className="bg-[#0d1117] border border-[#21262d] rounded px-2 py-1 text-[11px] text-[#e6edf3] focus:outline-none focus:border-[#00d4ff40]"
            >
              <option value="time">Newest first</option>
              <option value="risk">Highest risk</option>
              <option value="severity">Severity</option>
              <option value="reputation">Worst reputation</option>
            </select>
            <button
              onClick={() => setDense(d => !d)}
              className="text-[10px] px-2 py-1 rounded border border-[#21262d] text-[#8b949e] hover:text-[#e6edf3] hover:border-[#30363d] transition-colors"
            >
              {dense ? 'Comfortable' : 'Compact'}
            </button>
          </div>
        </div>

        {/* Bulk action bar — appears only on selection */}
        {selected.length > 0 && (
          <div className="flex items-center gap-3 bg-[#00d4ff10] border border-[#00d4ff30] rounded-lg px-4 py-2">
            <span className="text-[11px] text-[#00d4ff] font-mono">{selected.length} selected</span>
            <div className="flex items-center gap-2 ml-auto">
              {['Assign to me', 'Escalate to case', 'Mark resolved'].map(a => (
                <button
                  key={a}
                  className="text-[11px] px-2.5 py-1 rounded border border-[#00d4ff30] text-[#e6edf3] hover:bg-[#00d4ff15] transition-colors"
                >
                  {a}
                </button>
              ))}
              <button onClick={() => setSelected([])} className="text-[11px] text-[#6b7280] hover:text-[#e6edf3] px-1">
                Clear
              </button>
            </div>
          </div>
        )}

        {/* Queue table */}
        <div className="bg-[#161b22] border border-[#21262d] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#21262d] bg-[#0d1117]">
                  <th className="pl-4 pr-2 py-2 w-8">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={() => setSelected(allSelected ? [] : rows.map(r => r.id))}
                      className="w-3 h-3 accent-[#00d4ff] cursor-pointer"
                    />
                  </th>
                  {['Alert', 'Risk', 'Detected', 'Source', 'Technique', 'Reputation', 'State', 'Owner'].map(h => (
                    <th key={h} className="px-3 py-2 text-left text-[10px] tracking-widest text-[#6b7280] font-semibold whitespace-nowrap">
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
                      className="border-b border-[#21262d] hover:bg-[#1c2128] cursor-pointer group transition-colors"
                      style={checked ? { background: '#00d4ff08' } : undefined}
                    >
                      <td className={`pl-4 pr-2 ${rowPad}`} onClick={e => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => setSelected(s => checked ? s.filter(x => x !== a.id) : [...s, a.id])}
                          className="w-3 h-3 accent-[#00d4ff] cursor-pointer"
                        />
                      </td>

                      {/* Alert identity — severity carried by a rail, not a badge */}
                      <td className={`px-3 ${rowPad}`}>
                        <div className="flex items-center gap-2.5">
                          <span className="w-0.5 h-7 rounded-full shrink-0" style={{ background: sevColor[a.severity] }} />
                          <div className="min-w-0">
                            <div className="text-[#e6edf3] group-hover:text-[#00d4ff] transition-colors truncate">
                              {a.attackType}
                            </div>
                            <div className="text-[10px] font-mono text-[#484f58]">{a.id}</div>
                          </div>
                        </div>
                      </td>

                      <td className={`px-3 ${rowPad} whitespace-nowrap`}>
                        <RiskBadge score={a.riskScore} />
                        {a.approvalStatus === 'Pending' && (
                          <div className="text-[9px] text-[#f97316] mt-0.5">needs approval</div>
                        )}
                      </td>

                      <td className={`px-3 ${rowPad} font-mono text-[#8b949e] whitespace-nowrap`}>
                        {a.timestamp.slice(11)}
                        <span className="text-[#484f58] text-[10px] ml-1.5">18 Jan</span>
                      </td>

                      <td className={`px-3 ${rowPad} whitespace-nowrap`}>
                        <div className="font-mono text-[#e6edf3]">{a.sourceIP}</div>
                        <div className="text-[10px] text-[#484f58] truncate max-w-[140px]">
                          {a.country === 'INTERNAL' ? 'Internal network' : `${a.country} · ${a.asn.split(' ')[0]}`}
                        </div>
                      </td>

                      <td className={`px-3 ${rowPad} whitespace-nowrap`}>
                        <span className="font-mono text-[#a855f7]">{a.mitreId}</span>
                        <div className="text-[10px] text-[#484f58] truncate max-w-[130px]">{a.mitreName}</div>
                      </td>

                      {/* Enrichment — the column the dashboard never shows */}
                      <td className={`px-3 ${rowPad}`}>
                        {worst > 0 ? (
                          <div className="space-y-1">
                            <RepBar label="VT" score={a.vtScore} />
                            <RepBar label="AIP" score={a.abuseScore} />
                          </div>
                        ) : (
                          <span className="text-[10px] font-mono text-[#484f58]">no reputation data</span>
                        )}
                      </td>

                      <td className={`px-3 ${rowPad}`}><AlertStatusPill status={a.status} /></td>

                      <td className={`px-3 ${rowPad} whitespace-nowrap`}>
                        {a.analyst === 'Unassigned' ? (
                          <button
                            onClick={e => e.stopPropagation()}
                            className="text-[10px] px-2 py-0.5 rounded border border-[#30363d] text-[#8b949e] hover:border-[#00d4ff40] hover:text-[#00d4ff] transition-colors"
                          >
                            Claim
                          </button>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <span className="w-5 h-5 rounded-full bg-[#21262d] text-[9px] font-mono text-[#8b949e] flex items-center justify-center">
                              {a.analyst.replace('. ', '').slice(0, 2).toUpperCase()}
                            </span>
                            <span className="text-[#8b949e]">{a.analyst}</span>
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
              <div className="text-sm text-[#e6edf3]">Nothing matches these filters</div>
              <div className="text-xs text-[#6b7280]">Widen the severity or state selection to see more of the queue.</div>
              <button onClick={clearFilters} className="mt-1 text-xs text-[#00d4ff] hover:underline">
                Clear all filters
              </button>
            </div>
          )}

          {rows.length > 0 && (
            <div className="flex items-center justify-between px-4 py-2 border-t border-[#21262d] text-[10px] font-mono text-[#484f58]">
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
