import { useEffect, useState } from 'react'
import { useStore } from '../store'
import { riskColor } from './Shared'
import { api } from '../api'
import type { ShiftSummary } from '../api'
import type { SimulationCenterSummary } from '../data'
import { useAuth } from '../lib/AuthContext'
import { formatDateTime } from '../lib/dateFormat'

function Metric({ label, value, note, color = 'var(--color-text-primary)' }: { label: string; value: string; note: string; color?: string }) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-3.5">
      <div className="text-[11px] text-[var(--color-info)]">{label}</div>
      <div className="text-2xl font-mono font-bold leading-tight mt-0.5" style={{ color }}>{value}</div>
      <div className="text-[11px] text-[var(--color-text-muted)] mt-0.5">{note}</div>
    </div>
  )
}

const WINDOWS = [8, 12, 24] as const

/** Renders the AI Shift Summary card. All state (selected window, fetched
 * data) lives in the parent Reports component so the KPI cards below can
 * share the exact same report window and numbers — see Reports() for why. */
function AiShiftSummaryCard({
  hours,
  setHours,
  data,
  loading,
  error,
  onRefresh,
}: {
  hours: 8 | 12 | 24
  setHours: (h: 8 | 12 | 24) => void
  data: ShiftSummary | null
  loading: boolean
  error: boolean
  onRefresh: () => void
}) {
  const { profile } = useAuth()
  const [exporting, setExporting] = useState(false)
  const [exportError, setExportError] = useState(false)

  const exportExcel = async () => {
    setExporting(true)
    setExportError(false)
    try {
      await api.exportReport(hours)
    } catch {
      setExportError(true)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-5 py-4">
      <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#4f8cff]" />
          <span className="text-sm text-[var(--color-text-primary)]">AI Shift Summary</span>
          <span className="text-[10px] text-[var(--color-text-muted)] font-mono">Groq</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg border border-[var(--color-border)] p-0.5 bg-[var(--color-background)]">
            {WINDOWS.map(w => (
              <button
                key={w}
                onClick={() => setHours(w)}
                className="px-2.5 py-1 rounded-md text-[10px] font-semibold transition-colors"
                style={hours === w ? { background: '#4f8cff20', color: '#4f8cff' } : { color: 'var(--color-text-secondary)' }}
              >
                {w}h
              </button>
            ))}
          </div>
          <button
            onClick={onRefresh}
            disabled={loading}
            title="Refresh"
            className="w-7 h-7 rounded-lg border border-[var(--color-border)] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[#4f8cff] hover:border-[#4f8cff40] transition-colors disabled:opacity-50"
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" className={loading ? 'animate-spin' : ''}>
              <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2.5v3.2h-3.2" />
            </svg>
          </button>
          <button
            onClick={exportExcel}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[var(--color-border)] text-[11px] font-semibold text-[var(--color-text-secondary)] hover:text-[#30d18a] hover:border-[#30d18a40] transition-colors disabled:opacity-50"
          >
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M8 1.5v9M8 10.5L5 7.5M8 10.5l3-3M2.5 12v1.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V12" />
            </svg>
            {exporting ? 'Exporting…' : 'Export to Excel'}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="text-xs text-[var(--color-text-muted)] py-1">Generating summary…</div>
      ) : error ? (
        <div className="text-xs text-[#fb4a63] py-1">Could not load the shift summary — try refreshing.</div>
      ) : (
        <>
          <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed max-w-3xl">{data?.summary}</p>
          <div className="text-[10px] font-mono text-[var(--color-text-muted)] mt-2">
            {data?.alertCount} alert(s) in window · generated {data ? formatDateTime(data.generatedAt, profile?.timezone) : ''}
            {data?.cached ? ' · cached' : ''}
          </div>
        </>
      )}
      {exportError && <div className="text-[11px] text-[#fb4a63] mt-2">Could not export — try again.</div>}
    </div>
  )
}

export default function Reports() {
  const { alerts } = useStore()
  const [simSummary, setSimSummary] = useState<SimulationCenterSummary | null>(null)

  // Single source of truth for every shift/report KPI on this page — the AI
  // Shift Summary card and the "Alerts this shift"/"Decisions logged" tiles
  // below all read from this one selected window and its one API response,
  // so they can never disagree the way they used to (that card windowed by
  // hours; these tiles silently used all-time alerts.length/decisions.length).
  const [hours, setHours] = useState<8 | 12 | 24>(8)
  const [shiftData, setShiftData] = useState<ShiftSummary | null>(null)
  const [shiftLoading, setShiftLoading] = useState(true)
  const [shiftError, setShiftError] = useState(false)

  const loadShiftSummary = async (h: 8 | 12 | 24, refresh: boolean) => {
    setShiftLoading(true)
    setShiftError(false)
    try {
      setShiftData(await api.shiftSummary(h, refresh))
    } catch {
      setShiftError(true)
    } finally {
      setShiftLoading(false)
    }
  }

  useEffect(() => { loadShiftSummary(hours, false) }, [hours])

  useEffect(() => { api.simulationsSummary().then(setSimSummary).catch(() => setSimSummary(null)) }, [])

  const avgRisk = Math.round(alerts.reduce((s, a) => s + a.riskScore, 0) / alerts.length)
  const simTerminal = simSummary ? simSummary.passed + simSummary.failed + simSummary.partial + simSummary.notObserved : 0

  // Attack types ranked by how much risk they contributed, not just by count.
  const byType = Object.values(
    alerts.reduce<Record<string, { type: string; count: number; risk: number }>>((acc, a) => {
      acc[a.attackType] ??= { type: a.attackType, count: 0, risk: 0 }
      acc[a.attackType].count++
      acc[a.attackType].risk = Math.max(acc[a.attackType].risk, a.riskScore)
      return acc
    }, {}),
  ).sort((a, b) => b.risk - a.risk).slice(0, 6)

  const topRisk = [...alerts].sort((a, b) => b.riskScore - a.riskScore).slice(0, 5)

  return (
    <div className="space-y-4 max-w-5xl">
      <AiShiftSummaryCard
        hours={hours}
        setHours={setHours}
        data={shiftData}
        loading={shiftLoading}
        error={shiftError}
        onRefresh={() => loadShiftSummary(hours, true)}
      />

      <div className="grid grid-cols-4 gap-3">
        <Metric label="Alerts this shift" value={String(shiftData?.alertCount ?? 0)} note={`${hours}h window`} />
        <Metric label="Average risk" value={String(avgRisk)} note="across all alerts" color={riskColor(avgRisk)} />
        <Metric label="Decisions logged" value={String(shiftData?.decisionCount ?? 0)} note={`${hours}h window`} color="#ff9d4d" />
        <Metric
          label="Simulations passed"
          value={simSummary && simTerminal > 0 ? `${simSummary.passed}/${simTerminal}` : 'No data'}
          note={simSummary && simTerminal > 0 ? 'detection validation' : 'run a simulation to measure this'}
          color="#30d18a"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Risk contribution by attack type */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-primary)]">
            Attack types by peak risk
          </div>
          <div className="px-5 py-4 space-y-3">
            {byType.map(t => (
              <div key={t.type}>
                <div className="flex items-baseline justify-between text-xs mb-1">
                  <span className="text-[var(--color-text-primary)]">{t.type}</span>
                  <span className="font-mono text-[var(--color-info)]">
                    {t.count} alert{t.count > 1 ? 's' : ''} · peak {t.risk}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${t.risk}%`, background: riskColor(t.risk) }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Highest risk alerts */}
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-primary)]">
            Highest risk this shift
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {topRisk.map(a => (
              <div key={a.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className="font-mono font-bold text-sm w-8 shrink-0" style={{ color: riskColor(a.riskScore) }}>
                  {a.riskScore}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[var(--color-text-primary)] truncate">{a.attackType}</div>
                  <div className="text-[10px] font-mono text-[var(--color-text-muted)] truncate">{a.sourceIP} · {a.mitreId}</div>
                </div>
                <span className="text-[10px] font-mono text-[var(--color-text-muted)] shrink-0">{a.timestamp.slice(11, 16)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
