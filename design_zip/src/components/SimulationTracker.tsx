import { useEffect, useMemo, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../lib/AuthContext'
import { formatDateTime } from '../lib/dateFormat'
import { Chip, EmptyState, KpiTile, Panel, PanelHeader, SectionLabel, SimStatusPill } from './Shared'
import type {
  SimulationCenterSummary, SimulationDefinition, SimulationRun, SimulationRunDetail,
  SimulationRunStatus, SimulationTimelineStage,
} from '../data'

const ICONS = {
  runs: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 4l12 6-12 6V4z" /></svg>,
  pass: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="10" r="7.5" /><path d="M6.5 10l2.3 2.3L14 7.7" /></svg>,
  fail: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="10" cy="10" r="7.5" /><path d="M7.3 7.3l5.4 5.4M12.7 7.3l-5.4 5.4" /></svg>,
  live: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="10" cy="10" r="7.5" /><circle cx="10" cy="10" r="2.3" /></svg>,
  gauge: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M3 14a7 7 0 0114 0" /><path d="M10 14l3.2-4.2" /></svg>,
  clock: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="10" cy="10" r="7.5" /><path d="M10 5.5V10l3 2" /></svg>,
  ghost: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="10" cy="10" r="7.5" /></svg>,
  shield: <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8 1.5l5.5 2.5v4c0 3-2.3 5.6-5.5 6.5C4.8 13.6 2.5 11 2.5 8V4L8 1.5z" /></svg>,
  target: <svg width="13" height="13" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="6" /><circle cx="8" cy="8" r="2.5" /></svg>,
  map: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="2" y="2" width="7" height="7" rx="1" /><rect x="11" y="2" width="7" height="7" rx="1" /><rect x="2" y="11" width="7" height="7" rx="1" /><rect x="11" y="11" width="7" height="7" rx="1" /></svg>,
}

const STATUS_FILTERS: (SimulationRunStatus | 'all')[] = ['all', 'running', 'passed', 'partial', 'failed', 'not_observed']

const STATUS_VERDICT: Record<SimulationRunStatus, { label: string; color: string; icon: string; detail: string }> = {
  running: { label: 'RUNNING', color: '#9c8bfb', icon: '◐', detail: 'Awaiting real telemetry before the detection window closes.' },
  passed: { label: 'PASSED', color: '#30d18a', icon: '✓', detail: 'A matching event and alert landed inside the detection window.' },
  partial: { label: 'PARTIAL', color: '#f2c94c', icon: '◑', detail: 'Telemetry arrived but never became a correctly-mapped alert.' },
  failed: { label: 'FAILED', color: '#fb4a63', icon: '✕', detail: 'The analyst confirmed execution, but nothing was detected.' },
  not_observed: { label: 'NOT OBSERVED', color: '#7d8798', icon: '○', detail: 'The window closed and the test was never confirmed as run.' },
}

function fmtDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const m = Math.floor(seconds / 60), s = seconds % 60
  return `${m}m ${s}s`
}

// ── Start-run modal ──────────────────────────────────────────────────────────
function StartRunModal({
  defn, onClose, onStarted,
}: {
  defn: SimulationDefinition
  onClose: () => void
  onStarted: (run: SimulationRun) => void
}) {
  const [techniqueId, setTechniqueId] = useState(defn.techniqueId)
  const [platform, setPlatform] = useState(defn.platform)
  const [objective, setObjective] = useState(defn.objective)
  const [sourceHint, setSourceHint] = useState('')
  const [windowSeconds, setWindowSeconds] = useState(defn.defaultWindowSeconds)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const start = async () => {
    setStarting(true)
    setError(null)
    try {
      const run = await api.startSimulationRun(defn.id, {
        techniqueId: defn.custom ? techniqueId.trim().toUpperCase() : undefined,
        platform: defn.custom ? platform : undefined,
        objective: defn.custom ? objective : undefined,
        sourceHint: sourceHint.trim() || undefined,
        windowSeconds,
      })
      onStarted(run)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not start the run')
    } finally {
      setStarting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-xl bg-[var(--color-background)] border border-[var(--color-border-bright)] rounded-xl shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-[var(--color-background)]/95 backdrop-blur px-5 py-4 border-b border-[var(--color-border)] flex items-center justify-between z-10">
          <div>
            <div className="text-[10px] uppercase tracking-widest text-[#9c8bfb] font-semibold">Start Detection Validation</div>
            <div className="text-sm font-semibold text-[var(--color-text-primary)] mt-0.5">{defn.name}</div>
          </div>
          <button onClick={onClose} className="text-[var(--color-info)] hover:text-[var(--color-text-primary)] p-1">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l8 8M12 4L4 12" /></svg>
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* What / Why / Target at a glance */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2.5">
              <div className="text-[9px] uppercase tracking-widest text-[var(--color-info)] font-semibold">Technique</div>
              <div className="text-xs font-mono font-bold text-[#9c8bfb] mt-0.5">{defn.custom ? (techniqueId || '—') : defn.techniqueId}</div>
              {!defn.custom && defn.techniqueName && <div className="text-[10px] text-[var(--color-text-muted)] truncate">{defn.techniqueName}</div>}
            </div>
            <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2.5">
              <div className="text-[9px] uppercase tracking-widest text-[var(--color-info)] font-semibold">Platform</div>
              <div className="text-xs font-semibold text-[var(--color-text-primary)] mt-0.5">{defn.custom ? platform : defn.platform}</div>
              {!defn.custom && defn.tacticName && <div className="text-[10px] text-[var(--color-text-muted)] truncate">{defn.tacticName}</div>}
            </div>
            <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2.5">
              <div className="text-[9px] uppercase tracking-widest text-[var(--color-info)] font-semibold">Detection Window</div>
              <div className="text-xs font-mono font-bold text-[var(--color-text-primary)] mt-0.5">{fmtDuration(windowSeconds)}</div>
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-info)] font-semibold mb-1">Why this test</div>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{defn.custom ? objective : defn.objective}</p>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-info)] font-semibold mb-1">Expected Evidence</div>
            <p className="text-xs font-mono text-[var(--color-text-secondary)] leading-relaxed bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2.5">{defn.detectionHint}</p>
          </div>

          <div className="rounded-lg border border-[#9c8bfb40] bg-[#9c8bfb0c] p-3.5">
            <div className="flex items-center gap-1.5 text-[11px] font-semibold text-[#9c8bfb] mb-1.5">{ICONS.shield} Safety & control</div>
            <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
              SOCore executes nothing. You perform the manual action yourself, against infrastructure you already control —
              this only opens a detection window and records the real evidence that arrives.
            </p>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-info)] font-semibold mb-2">Manual Execution Instructions</div>
            <ol className="space-y-1.5 list-decimal list-inside text-xs text-[var(--color-text-secondary)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3.5">
              {defn.instructions.map((step, i) => <li key={i} className="pl-1">{step}</li>)}
            </ol>
          </div>

          {defn.custom && (
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-[10px] uppercase tracking-widest text-[var(--color-info)] font-semibold">ATT&CK Technique ID</label>
                <input value={techniqueId} onChange={e => setTechniqueId(e.target.value)} placeholder="e.g. T1059.001"
                  className="mt-1 w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-xs font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[#4f8cff40]" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[var(--color-info)] font-semibold">Platform</label>
                <input value={platform} onChange={e => setPlatform(e.target.value)}
                  className="mt-1 w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[#4f8cff40]" />
              </div>
              <div>
                <label className="text-[10px] uppercase tracking-widest text-[var(--color-info)] font-semibold">Objective</label>
                <input value={objective} onChange={e => setObjective(e.target.value)}
                  className="mt-1 w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[#4f8cff40]" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] uppercase tracking-widest text-[var(--color-info)] font-semibold">Source hint (optional)</label>
              <input value={sourceHint} onChange={e => setSourceHint(e.target.value)} placeholder="IP or agent name"
                className="mt-1 w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-xs font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[#4f8cff40]" />
              <div className="text-[10px] text-[var(--color-text-muted)] mt-1">Narrows detection matching to this source.</div>
            </div>
            <div>
              <label className="text-[10px] uppercase tracking-widest text-[var(--color-info)] font-semibold">Detection window (sec)</label>
              <input type="number" min={30} max={3600} value={windowSeconds} onChange={e => setWindowSeconds(Number(e.target.value))}
                className="mt-1 w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3 py-1.5 text-xs font-mono text-[var(--color-text-primary)] focus:outline-none focus:border-[#4f8cff40]" />
            </div>
          </div>

          {error && <div className="text-xs text-[#fb4a63] bg-[#fb4a6310] border border-[#fb4a6330] rounded-lg px-3 py-2">{error}</div>}

          <div className="flex items-center gap-2 pt-1">
            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg border border-[var(--color-border-bright)] text-xs font-semibold text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={start}
              disabled={starting || (defn.custom && !techniqueId.trim())}
              className="flex-[2] py-2.5 rounded-lg bg-[#9c8bfb20] border border-[#9c8bfb50] text-[#9c8bfb] text-xs font-bold uppercase tracking-wider hover:bg-[#9c8bfb30] transition-colors disabled:opacity-50"
            >
              {starting ? 'Starting…' : 'Start Run'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Run detail drawer ────────────────────────────────────────────────────────
function TimelineStageIcon({ stage, status, color }: { stage: string; status: string; color: string }) {
  const observed = status === 'observed'
  return (
    <span
      className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 border"
      style={{
        background: observed ? `${color}18` : 'var(--color-surface-2)',
        borderColor: observed ? `${color}60` : 'var(--color-border)',
      }}
    >
      {observed ? (
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      ) : (
        <span className="w-1.5 h-1.5 rounded-full bg-[var(--color-border-bright)]" />
      )}
    </span>
  )
}

function RunDetailDrawer({ runId, onClose, onMarkedExecuted, timezone }: {
  runId: string
  onClose: () => void
  onMarkedExecuted: () => void
  timezone?: string
}) {
  const [detail, setDetail] = useState<SimulationRunDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [marking, setMarking] = useState(false)
  const [now, setNow] = useState(Date.now())

  const load = () => {
    setLoading(true)
    api.simulationRun(runId).then(setDetail).finally(() => setLoading(false))
  }
  useEffect(load, [runId])

  useEffect(() => {
    if (!detail || detail.run.status !== 'running') return
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [detail?.run.status])

  // Live countdown tick for the running-state progress bar — display only,
  // the server (not the client clock) is what actually decides the verdict.
  useEffect(() => {
    if (!detail || detail.run.status !== 'running') return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [detail?.run.status])

  const markExecuted = async () => {
    setMarking(true)
    try {
      await api.markSimulationRunExecuted(runId)
      onMarkedExecuted()
      load()
    } finally {
      setMarking(false)
    }
  }

  const run = detail?.run
  const verdict = run ? STATUS_VERDICT[run.status] : null
  const elapsedPct = useMemo(() => {
    if (!run) return 0
    const started = new Date(run.startedAt).getTime()
    const pct = ((now - started) / 1000 / run.windowSeconds) * 100
    return Math.max(0, Math.min(100, pct))
  }, [run, now])

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-lg h-full bg-[var(--color-background)] border-l border-[var(--color-border)] overflow-y-auto shadow-2xl">
        <div className="sticky top-0 bg-[var(--color-background)]/95 backdrop-blur border-b border-[var(--color-border)] px-5 py-4 z-10 flex items-center justify-between">
          <div>
            <div className="font-mono text-sm font-semibold text-[#9c8bfb]">{runId}</div>
            {detail && <div className="text-xs text-[var(--color-text-secondary)]">{detail.run.simulationName}</div>}
          </div>
          <button onClick={onClose} className="text-[var(--color-info)] hover:text-[var(--color-text-primary)] p-1">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l8 8M12 4L4 12" /></svg>
          </button>
        </div>

        {loading || !detail || !run || !verdict ? (
          <div className="p-5 text-xs text-[var(--color-text-muted)]">Loading…</div>
        ) : (
          <div className="p-5 space-y-5">
            {/* Big, unambiguous verdict banner */}
            <div className="rounded-xl border p-4" style={{ borderColor: `${verdict.color}50`, background: `${verdict.color}12` }}>
              <div className="flex items-center gap-3">
                <span className="text-2xl leading-none" style={{ color: verdict.color }}>{verdict.icon}</span>
                <div className="min-w-0">
                  <div className="text-sm font-black tracking-wide" style={{ color: verdict.color }}>{verdict.label}</div>
                  <div className="text-[11px] text-[var(--color-text-secondary)] mt-0.5">{verdict.detail}</div>
                </div>
              </div>
              {run.status === 'running' && (
                <div className="mt-3">
                  <div className="h-1.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${elapsedPct}%`, background: verdict.color }} />
                  </div>
                  <div className="flex justify-between text-[9px] font-mono text-[var(--color-text-muted)] mt-1">
                    <span>started {formatDateTime(run.startedAt, timezone)}</span>
                    <span>{fmtDuration(run.windowSeconds)} window</span>
                  </div>
                </div>
              )}
              {run.detectionLatencySeconds != null && (
                <div className="text-[10px] font-mono text-[var(--color-text-muted)] mt-2">Detected in {run.detectionLatencySeconds}s</div>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-2 py-2">
                <div className="text-[9px] uppercase tracking-widest text-[var(--color-info)]">Technique</div>
                <div className="text-xs font-mono font-bold text-[#9c8bfb] mt-0.5">{run.techniqueId}</div>
              </div>
              <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-2 py-2">
                <div className="text-[9px] uppercase tracking-widest text-[var(--color-info)]">Platform</div>
                <div className="text-xs font-semibold text-[var(--color-text-primary)] mt-0.5">{run.platform || '—'}</div>
              </div>
              <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-2 py-2">
                <div className="text-[9px] uppercase tracking-widest text-[var(--color-info)]">Started By</div>
                <div className="text-xs font-semibold text-[var(--color-text-primary)] mt-0.5 truncate">{run.startedBy}</div>
              </div>
            </div>

            {run.status === 'running' && !run.executedAt && (
              <button
                onClick={markExecuted}
                disabled={marking}
                className="w-full py-2.5 rounded-lg border border-[#ff9d4d50] bg-[#ff9d4d15] text-[#ff9d4d] text-xs font-bold uppercase tracking-wider hover:bg-[#ff9d4d25] transition-colors disabled:opacity-50"
              >
                {marking ? 'Marking…' : 'Mark as Executed'}
              </button>
            )}
            {run.status === 'running' && run.executedAt && (
              <div className="text-[11px] text-[var(--color-text-muted)] text-center bg-[var(--color-surface-2)] rounded-lg py-2">
                Execution confirmed — evaluating automatically until the window closes.
              </div>
            )}

            <div>
              <SectionLabel title="Evidence Timeline" />
              <div className="space-y-0">
                {detail.timeline.map((stage: SimulationTimelineStage, i) => {
                  const isLast = i === detail.timeline.length - 1
                  const color = isLast ? verdict.color : (stage.status === 'observed' ? '#30d18a' : 'var(--color-text-muted)')
                  return (
                    <div key={i} className="flex gap-3 pb-4 last:pb-0">
                      <div className="flex flex-col items-center">
                        <TimelineStageIcon stage={stage.stage} status={stage.status} color={color} />
                        {!isLast && <span className="w-px flex-1 min-h-[14px] bg-[var(--color-border)] mt-1" />}
                      </div>
                      <div className="flex-1 min-w-0 pb-1">
                        <div className={`text-[11px] font-bold uppercase tracking-wide ${stage.status === 'observed' ? 'text-[var(--color-text-primary)]' : 'text-[var(--color-text-muted)]'}`}>
                          {stage.stage}
                        </div>
                        {stage.timestamp && (
                          <div className="text-[10px] font-mono text-[var(--color-text-muted)] mt-0.5">{formatDateTime(stage.timestamp, timezone)}</div>
                        )}
                        {stage.detail && <div className="text-[11px] text-[var(--color-text-secondary)] mt-0.5 leading-relaxed">{stage.detail}</div>}
                        {stage.status === 'not_observed' && !stage.detail && (
                          <div className="text-[10px] text-[var(--color-text-muted)] italic mt-0.5">Not observed</div>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Main Simulation Center ───────────────────────────────────────────────────
export default function SimulationTracker({ prefillTechniqueId, onConsumedPrefill, onViewTechnique }: {
  prefillTechniqueId?: string | null
  onConsumedPrefill?: () => void
  onViewTechnique?: (techniqueId: string) => void
} = {}) {
  const { role, profile } = useAuth()
  const canRun = role === 'l2_analyst' || role === 'admin'

  const [definitions, setDefinitions] = useState<SimulationDefinition[] | null>(null)
  const [summary, setSummary] = useState<SimulationCenterSummary | null>(null)
  const [runs, setRuns] = useState<SimulationRun[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [startModal, setStartModal] = useState<SimulationDefinition | null>(null)
  const [openRunId, setOpenRunId] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<SimulationRunStatus | 'all'>('all')

  const loadAll = () => {
    Promise.all([api.simulations(), api.simulationsSummary(), api.simulationRuns()])
      .then(([defs, sum, r]) => { setDefinitions(defs); setSummary(sum); setRuns(r); setError(false) })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }

  useEffect(loadAll, [])

  useEffect(() => {
    if (!prefillTechniqueId || !definitions) return
    const custom = definitions.find(d => d.custom)
    if (custom) setStartModal({ ...custom, techniqueId: prefillTechniqueId })
    onConsumedPrefill?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillTechniqueId, definitions])

  // Poll while anything is still running.
  useEffect(() => {
    if (!runs.some(r => r.status === 'running')) return
    const t = setInterval(loadAll, 6000)
    return () => clearInterval(t)
  }, [runs])

  const runningRuns = useMemo(() => runs.filter(r => r.status === 'running'), [runs])
  const recentRuns = useMemo(() => runs.filter(r => r.status !== 'running').slice(0, 8), [runs])
  const filteredRuns = useMemo(
    () => (statusFilter === 'all' ? runs : runs.filter(r => r.status === statusFilter)),
    [runs, statusFilter],
  )

  // Simulation → ATT&CK coverage impact: which techniques these runs have
  // actually touched, and how they've fared — a real rollup of `runs`, not a
  // second network call.
  const coverageImpact = useMemo(() => {
    const byTechnique = new Map<string, { techniqueId: string; techniqueName: string | null; tacticName: string | null; passed: number; failed: number; total: number; lastRun: string }>()
    for (const r of runs) {
      const base = r.techniqueId.split('.')[0]
      const entry = byTechnique.get(base) ?? { techniqueId: base, techniqueName: r.techniqueName, tacticName: r.tacticName, passed: 0, failed: 0, total: 0, lastRun: r.startedAt }
      entry.total += 1
      if (r.status === 'passed') entry.passed += 1
      if (r.status === 'failed' || r.status === 'partial') entry.failed += 1
      if (r.startedAt > entry.lastRun) entry.lastRun = r.startedAt
      byTechnique.set(base, entry)
    }
    return [...byTechnique.values()].sort((a, b) => b.lastRun.localeCompare(a.lastRun))
  }, [runs])

  if (loading) return <div className="text-xs text-[var(--color-text-muted)] py-10 text-center">Loading Simulation Center…</div>
  if (error || !definitions || !summary) {
    return (
      <Panel><div className="p-8 text-center">
        <div className="text-sm text-[#fb4a63] mb-2">Could not load the Simulation Center from the backend.</div>
        <button onClick={() => { setLoading(true); loadAll() }} className="text-xs text-[#4f8cff] hover:underline">Retry</button>
      </div></Panel>
    )
  }

  const terminalTotal = summary.passed + summary.failed + summary.partial + summary.notObserved

  return (
    <div className="space-y-4">
      {/* Header banner + KPIs */}
      <div className="relative bg-[var(--color-surface)] border border-[#9c8bfb40] rounded-lg p-4 overflow-hidden">
        <div className="absolute inset-0 opacity-[0.06]" style={{ background: 'linear-gradient(135deg, #9c8bfb 0%, #ec4899 100%)' }} />
        <div className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, #9c8bfb80, transparent)' }} />
        <div className="relative">
          <div className="flex items-center gap-3 mb-3.5">
            <div className="w-8 h-8 rounded-lg bg-[#9c8bfb20] border border-[#9c8bfb40] flex items-center justify-center">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none"><path d="M3 8L7 12L13 4" stroke="#9c8bfb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <div>
              <div className="text-sm font-bold text-[var(--color-text-primary)]">Simulation Center</div>
              <div className="text-[10px] text-[#9c8bfb] font-mono mt-0.5">PURPLE TEAM · CONTROLLED, EVIDENCE-BASED VALIDATION</div>
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
            <KpiTile icon={ICONS.runs} value={summary.totalRuns} label="Total Runs" accent="#9c8bfb" />
            <KpiTile icon={ICONS.pass} value={summary.passed} label="Passed" accent="#30d18a" />
            <KpiTile icon={ICONS.fail} value={summary.failed} label="Failed" accent="#fb4a63" />
            <KpiTile icon={ICONS.live} value={summary.running} label="Running" accent="#9c8bfb" />
            <KpiTile icon={ICONS.gauge} value={summary.detectionRate != null ? `${summary.detectionRate}%` : '—'} label="Detection Rate" accent="#4f8cff" />
            <KpiTile icon={ICONS.clock} value={summary.averageDetectionSeconds != null ? `${Math.round(summary.averageDetectionSeconds)}s` : '—'} label="Avg. Detect Time" accent="#4f8cff" />
            <KpiTile icon={ICONS.ghost} value={summary.techniquesNeverTested} label="Never Tested" accent="#7d8798" />
          </div>
        </div>
      </div>

      {!canRun && (
        <div className="text-[11px] text-[var(--color-text-muted)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-3.5 py-2 flex items-center gap-2">
          {ICONS.shield} Starting a simulation requires the L2 analyst or admin role. You can still view the library, history, and coverage impact.
        </div>
      )}

      {/* Active / Running */}
      <Panel>
        <PanelHeader title="Active Runs">
          <span className="text-[10px] font-mono" style={{ color: runningRuns.length ? '#9c8bfb' : 'var(--color-text-muted)' }}>
            {runningRuns.length} in progress
          </span>
        </PanelHeader>
        {runningRuns.length === 0 ? (
          <div className="px-4 py-6 text-center text-xs text-[var(--color-text-muted)]">No simulations are currently running.</div>
        ) : (
          <div className="divide-y divide-[var(--color-border)]">
            {runningRuns.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-3">
                <span className="w-2 h-2 rounded-full bg-[#9c8bfb] pulse-live shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-xs font-semibold text-[var(--color-text-primary)] truncate">{r.simulationName}</div>
                  <div className="text-[10px] font-mono text-[var(--color-text-muted)]">{r.techniqueId} · started {formatDateTime(r.startedAt, profile?.timezone)} · {fmtDuration(r.windowSeconds)} window</div>
                </div>
                {!r.executedAt && <Chip color="#ff9d4d">awaiting execution</Chip>}
                <button onClick={() => setOpenRunId(r.id)} className="text-[10px] font-semibold text-[#9c8bfb] hover:underline shrink-0">View</button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="grid lg:grid-cols-3 gap-4">
        {/* Simulation library */}
        <div className="lg:col-span-2">
          <Panel>
            <PanelHeader title="Simulation Library">
              <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{definitions.length} controlled tests</span>
            </PanelHeader>
            <div className="grid sm:grid-cols-2 gap-3 p-4">
              {definitions.map(defn => {
                const lastRunEntry = recentRuns.concat(runningRuns).find(r => r.simulationId === defn.id)
                return (
                  <div key={defn.id} className="border border-[var(--color-border)] rounded-lg p-3.5 bg-[var(--color-surface-2)] flex flex-col gap-2 hover:border-[var(--color-border-bright)] transition-colors">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-xs font-bold text-[var(--color-text-primary)]">{defn.name}</div>
                        <div className="text-[10px] font-mono text-[#9c8bfb] mt-0.5 truncate">
                          {defn.custom ? 'Custom technique' : `${defn.techniqueId} · ${defn.techniqueName ?? ''}`}
                        </div>
                        {defn.tacticName && <div className="text-[9px] uppercase tracking-wider text-[var(--color-info)] mt-0.5">{defn.tacticName}</div>}
                      </div>
                      {defn.lastResult && <SimStatusPill status={defn.lastResult} />}
                    </div>
                    <p className="text-[11px] text-[var(--color-text-secondary)] leading-relaxed">{defn.description}</p>
                    <div className="text-[10px] font-mono text-[var(--color-text-muted)] bg-[var(--color-surface)] border border-[var(--color-border)] rounded-md px-2 py-1.5 truncate" title={defn.detectionHint}>
                      Expects: {defn.detectionHint}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] font-mono text-[var(--color-text-muted)] flex-wrap">
                      <span>{defn.platform}</span>
                      <span>·</span>
                      <span>{defn.totalRuns} run{defn.totalRuns === 1 ? '' : 's'}</span>
                      {defn.totalRuns > 0 && <><span>·</span><span>{defn.passedRuns} passed</span></>}
                      {defn.lastRun && <><span>·</span><span>last {formatDateTime(defn.lastRun, profile?.timezone)}</span></>}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <button
                        onClick={() => setStartModal(defn)}
                        disabled={!canRun}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all disabled:opacity-40"
                        style={{ borderColor: '#9c8bfb50', background: '#9c8bfb15', color: '#9c8bfb' }}
                      >
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2 2l6 3-6 3V2z" /></svg>
                        Start
                      </button>
                      {lastRunEntry && (
                        <button onClick={() => setOpenRunId(lastRunEntry.id)} className="text-[10px] text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)]">
                          View last run
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </Panel>
        </div>

        {/* Detection validation results + coverage impact */}
        <div className="space-y-4">
          <Panel>
            <PanelHeader title="Detection Validation Results" />
            <div className="p-4">
              {terminalTotal === 0 ? (
                <EmptyState message="No results yet" sub="Results appear here once a run reaches a verdict." />
              ) : (
                <>
                  <div className="h-2.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden flex gap-px mb-3">
                    {(['passed', 'partial', 'failed', 'not_observed'] as const).map(s => {
                      const count = s === 'passed' ? summary.passed : s === 'partial' ? summary.partial : s === 'failed' ? summary.failed : summary.notObserved
                      const pct = (count / terminalTotal) * 100
                      return <div key={s} className="h-full" style={{ width: `${pct}%`, background: STATUS_VERDICT[s].color, opacity: 0.9 }} />
                    })}
                  </div>
                  <div className="space-y-1.5">
                    {(['passed', 'partial', 'failed', 'not_observed'] as const).map(s => {
                      const count = s === 'passed' ? summary.passed : s === 'partial' ? summary.partial : s === 'failed' ? summary.failed : summary.notObserved
                      return (
                        <div key={s} className="flex items-center justify-between text-[11px]">
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full" style={{ background: STATUS_VERDICT[s].color }} />
                            <span className="text-[var(--color-text-secondary)]">{STATUS_VERDICT[s].label}</span>
                          </span>
                          <span className="font-mono text-[var(--color-text-primary)]">{count}</span>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </Panel>

          <Panel>
            <PanelHeader title="ATT&CK Coverage Impact" />
            {coverageImpact.length === 0 ? (
              <div className="p-4"><EmptyState message="No techniques tested yet" sub="Start a run to see its impact on ATT&CK coverage here." /></div>
            ) : (
              <div className="divide-y divide-[var(--color-border)]">
                {coverageImpact.slice(0, 6).map(t => (
                  <button
                    key={t.techniqueId}
                    onClick={() => onViewTechnique?.(t.techniqueId)}
                    disabled={!onViewTechnique}
                    className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-[var(--color-surface-2)] transition-colors disabled:cursor-default"
                  >
                    <span className="text-[var(--color-text-muted)] shrink-0">{ICONS.map}</span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[11px] font-mono font-bold text-[#9c8bfb]">{t.techniqueId}</div>
                      <div className="text-[10px] text-[var(--color-text-muted)] truncate">{t.techniqueName ?? t.tacticName ?? 'Custom'}</div>
                    </div>
                    <div className="text-[10px] font-mono text-right shrink-0">
                      <span className="text-[#30d18a]">{t.passed}✓</span>{' '}
                      {t.failed > 0 && <span className="text-[#fb4a63]">{t.failed}✕</span>}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </Panel>
        </div>
      </div>

      {/* History */}
      <Panel>
        <PanelHeader title="Recent Runs">
          <div className="flex items-center gap-1 flex-wrap">
            {STATUS_FILTERS.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className="px-2 py-1 rounded text-[9px] font-bold uppercase tracking-widest transition-colors"
                style={statusFilter === s
                  ? { background: '#9c8bfb20', color: '#9c8bfb' }
                  : { color: 'var(--color-info)' }}
              >
                {s === 'all' ? 'All' : s.replace('_', ' ')}
              </button>
            ))}
          </div>
        </PanelHeader>
        {filteredRuns.length === 0 ? (
          <EmptyState message="No simulation results yet" sub="Run a controlled detection validation test to begin measuring ATT&CK coverage." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  {['Started', 'Simulation', 'ATT&CK ID', 'Platform', 'Status', 'Detect Time', ''].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest text-[var(--color-info)] font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRuns.map(run => (
                  <tr key={run.id} className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-2)] transition-colors">
                    <td className="px-4 py-2.5 font-mono text-[var(--color-info)] whitespace-nowrap">{formatDateTime(run.startedAt, profile?.timezone)}</td>
                    <td className="px-4 py-2.5 text-[var(--color-text-primary)]">{run.simulationName}</td>
                    <td className="px-4 py-2.5 font-mono text-[#9c8bfb]">{run.techniqueId}</td>
                    <td className="px-4 py-2.5 text-[var(--color-text-secondary)]">{run.platform}</td>
                    <td className="px-4 py-2.5"><SimStatusPill status={run.status} /></td>
                    <td className="px-4 py-2.5 font-mono">
                      {run.detectionLatencySeconds != null ? <span className="text-[#4f8cff]">{run.detectionLatencySeconds}s</span> : <span className="text-[var(--color-text-muted)]">—</span>}
                    </td>
                    <td className="px-4 py-2.5">
                      <button onClick={() => setOpenRunId(run.id)} className="text-[10px] font-semibold text-[#9c8bfb] hover:underline">View</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {startModal && (
        <StartRunModal
          defn={startModal}
          onClose={() => setStartModal(null)}
          onStarted={run => { setStartModal(null); loadAll(); setOpenRunId(run.id) }}
        />
      )}
      {openRunId && (
        <RunDetailDrawer runId={openRunId} onClose={() => { setOpenRunId(null); loadAll() }} onMarkedExecuted={loadAll} timezone={profile?.timezone} />
      )}
    </div>
  )
}
