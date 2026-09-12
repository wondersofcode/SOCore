import { useEffect, useState } from 'react'
import { api } from '../api'
import { useAuth } from '../lib/AuthContext'
import { formatDateTime } from '../lib/dateFormat'
import {
  Chip, EmptyState, KpiTile, Panel, RiskBadge, SectionLabel, SeverityBadge,
  SimStatusPill, TechniqueStatusPill, techniqueCoverageStyle,
} from './Shared'
import type { MitreCenterResponse, TechniqueCoverage, TechniqueCoverageStatus, TechniqueDetail } from '../data'

const STATUS_ORDER: TechniqueCoverageStatus[] = ['detected', 'tested_passed', 'testing', 'tested_failed', 'not_tested']

const ICONS = {
  grid: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="2" y="2" width="7" height="7" rx="1" /><rect x="11" y="2" width="7" height="7" rx="1" /><rect x="2" y="11" width="7" height="7" rx="1" /><rect x="11" y="11" width="7" height="7" rx="1" /></svg>,
  target: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="10" cy="10" r="7.5" /><circle cx="10" cy="10" r="3.5" /><path d="M10 2v2.5M10 15.5V18M2 10h2.5M15.5 10H18" /></svg>,
  flask: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2.5h4M8.5 2.5v4.8L4.8 14a1.5 1.5 0 001.3 2.3h7.8a1.5 1.5 0 001.3-2.3l-3.7-6.7V2.5" /></svg>,
  ghost: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="10" cy="10" r="7.5" /></svg>,
  alert: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M8.6 3.2a1.6 1.6 0 012.8 0l6.1 10.8a1.6 1.6 0 01-1.4 2.4H3.9a1.6 1.6 0 01-1.4-2.4L8.6 3.2z" /><path d="M10 8v3.5M10 14v.01" /></svg>,
  gap: <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="10" cy="10" r="7.5" /><path d="M10 6v4.5l3 2" /></svg>,
  clock: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="6" /><path d="M8 4.5V8l2.5 1.5" /></svg>,
  bolt: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M8.5 1.5L3 9h4l-.5 5.5L13 7H9l-.5-5.5z" /></svg>,
  host: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="12" height="7" rx="1" /><path d="M5 13h6M8 10v3" /></svg>,
  rule: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 2h7l3 3v9a1 1 0 01-1 1H3a1 1 0 01-1-1V3a1 1 0 011-1z" /><path d="M5.5 7h5M5.5 9.5h5M5.5 12h3" /></svg>,
  case: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1.5" y="4" width="13" height="9.5" rx="1.5" /><path d="M5.5 4V3a1 1 0 011-1h3a1 1 0 011 1v1" /></svg>,
  event: <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 8h3l1.5-4 3 8 1.5-4h3" /></svg>,
  sparkle: <svg viewBox="0 0 13 13" fill="none"><path d="M6.5 1l1.3 3.2L11 5.5 7.8 6.8 6.5 10 5.2 6.8 2 5.5l3.2-1.3L6.5 1z" stroke="#9c8bfb" strokeWidth="1" strokeLinejoin="round" /></svg>,
}

function CoverageBadge({ tech }: { tech: TechniqueCoverage }) {
  const cfg = techniqueCoverageStyle(tech.status)
  if (tech.alertCount > 0) {
    return <span className="text-[8px] font-mono mt-1 inline-flex items-center gap-1" style={{ color: cfg.dot }}>
      <span className="w-1 h-1 rounded-full" style={{ background: cfg.dot }} />{tech.alertCount} alert{tech.alertCount === 1 ? '' : 's'}
    </span>
  }
  if (tech.simulationRuns > 0) {
    return <span className="text-[8px] font-mono mt-1 inline-flex items-center gap-1" style={{ color: cfg.dot }}>
      <span className="w-1 h-1 rounded-full" style={{ background: cfg.dot }} />{tech.simulationRuns} test{tech.simulationRuns === 1 ? '' : 's'}
    </span>
  }
  return null
}

function DetailStat({ label, value, color }: { label: string; value: React.ReactNode; color?: string }) {
  return (
    <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg px-3 py-2.5">
      <div className="text-[9px] uppercase tracking-widest text-[var(--color-info)] font-semibold">{label}</div>
      <div className="text-sm font-mono font-bold mt-0.5" style={{ color: color ?? 'var(--color-text-primary)' }}>{value}</div>
    </div>
  )
}

export default function MitreMatrix({
  onSelectAlert,
  onTestTechnique,
  prefillTechniqueId,
  onConsumedPrefill,
}: {
  onSelectAlert: (id: string) => void
  onTestTechnique?: (techniqueId: string) => void
  prefillTechniqueId?: string | null
  onConsumedPrefill?: () => void
}) {
  const { profile, role } = useAuth()
  const [data, setData] = useState<MitreCenterResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [selected, setSelected] = useState<TechniqueCoverage | null>(null)
  const [detail, setDetail] = useState<TechniqueDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<TechniqueCoverageStatus | 'all'>('all')
  const [search, setSearch] = useState('')

  const load = () => {
    setLoading(true)
    setError(false)
    api.mitreCenter().then(setData).catch(() => setError(true)).finally(() => setLoading(false))
  }

  useEffect(load, [])

  useEffect(() => {
    if (!selected) { setDetail(null); return }
    setDetailLoading(true)
    api.mitreTechnique(selected.id).then(setDetail).catch(() => setDetail(null)).finally(() => setDetailLoading(false))
  }, [selected])

  // Cross-link from the Simulation Center ("view coverage impact") — opens
  // straight into a technique's drawer once the matrix has loaded.
  useEffect(() => {
    if (!prefillTechniqueId || !data) return
    const tech = data.tactics.flatMap(t => t.techniques).find(t => t.id === prefillTechniqueId)
    if (tech) setSelected(tech)
    onConsumedPrefill?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillTechniqueId, data])

  if (loading) {
    return <div className="text-xs text-[var(--color-text-muted)] py-10 text-center">Loading ATT&CK coverage…</div>
  }
  if (error || !data) {
    return (
      <Panel>
        <div className="p-8 text-center">
          <div className="text-sm text-[#fb4a63] mb-2">Could not load ATT&CK coverage from the backend.</div>
          <button onClick={load} className="text-xs text-[#4f8cff] hover:underline">Retry</button>
        </div>
      </Panel>
    )
  }

  const { summary, tactics } = data
  const q = search.trim().toLowerCase()
  const matches = (t: TechniqueCoverage) =>
    (statusFilter === 'all' || t.status === statusFilter) &&
    (q === '' || t.id.toLowerCase().includes(q) || t.name.toLowerCase().includes(q))
  const statusCounts = STATUS_ORDER.reduce<Record<string, number>>((acc, s) => {
    acc[s] = tactics.flatMap(t => t.techniques).filter(t => t.status === s).length
    return acc
  }, {})
  const canTest = role !== 'l1_analyst'

  return (
    <div className="space-y-4">
      {/* Coverage dashboard */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiTile icon={ICONS.grid} value={`${summary.coveragePercent}%`} label="Coverage" accent="#30d18a" />
        <KpiTile icon={ICONS.target} value={summary.detectedTechniques} label="Detected" accent="#30d18a" />
        <KpiTile icon={ICONS.flask} value={summary.testedTechniques} label="Tested" accent="#4f8cff" />
        <KpiTile icon={ICONS.ghost} value={summary.notTestedTechniques} label="Not Tested" accent="#7d8798" />
        <KpiTile icon={ICONS.alert} value={summary.failedTests} label="Failed Tests" accent="#fb4a63" />
        <KpiTile icon={ICONS.gap} value={summary.highRiskGaps} label="High-Risk Gaps" accent="#ff9d4d" />
      </div>

      <Panel>
        {/* Header + filters */}
        <div className="flex items-center justify-between flex-wrap gap-3 px-4 pt-4 pb-3">
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)] flex items-center gap-2">
              MITRE ATT&CK<span className="text-[10px] align-super">®</span> Enterprise Matrix
            </h2>
            <p className="text-[11px] text-[var(--color-info)] mt-0.5 font-mono">
              {summary.totalTechniques} technique cells across {tactics.length} tactics · coverage computed live from alerts + simulation runs
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap justify-end">
            <div className="relative">
              <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" width="12" height="12" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><circle cx="5.5" cy="5.5" r="4" /><path d="M9 9l2.5 2.5" /></svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search technique…"
                className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg pl-7 pr-3 py-1.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[#4f8cff40] font-mono w-40 transition-colors"
              />
            </div>
            <div className="inline-flex items-center gap-1 rounded-lg border border-[var(--color-border)] bg-[var(--color-surface-2)] p-1 flex-wrap">
              <button
                onClick={() => setStatusFilter('all')}
                className="text-[10px] font-mono font-semibold px-2 py-1 rounded-md transition-colors"
                style={statusFilter === 'all' ? { color: '#4f8cff', background: '#4f8cff18' } : { color: 'var(--color-text-secondary)' }}
              >
                All {summary.totalTechniques}
              </button>
              {STATUS_ORDER.map(s => {
                const cfg = techniqueCoverageStyle(s)
                const active = statusFilter === s
                return (
                  <button
                    key={s}
                    onClick={() => setStatusFilter(active ? 'all' : s)}
                    className="flex items-center gap-1.5 text-[10px] font-mono font-semibold px-2 py-1 rounded-md transition-colors"
                    style={{ color: cfg.text, background: active ? cfg.bg : 'transparent' }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: cfg.dot }} />
                    {cfg.label} {statusCounts[s]}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Matrix */}
        <div className="border-t border-[var(--color-border)] overflow-x-auto">
          <div className="min-w-max grid gap-px bg-[var(--color-border)] p-px" style={{ gridTemplateColumns: `repeat(${tactics.length}, 172px)` }}>
            {tactics.map(tactic => (
              <div key={tactic.id} className="flex flex-col gap-px bg-[var(--color-background)]">
                <div className="px-2.5 py-2.5 bg-[var(--color-surface)] border-b border-[var(--color-border-bright)] sticky top-0">
                  <div className="text-[10px] font-bold uppercase tracking-wider text-[#4f8cff] truncate" title={tactic.name}>{tactic.name}</div>
                  <div className="text-[9px] font-mono text-[var(--color-text-muted)] mt-0.5">{tactic.id} · {tactic.techniques.length}</div>
                </div>
                <div className="flex flex-col gap-px flex-1">
                  {tactic.techniques.filter(matches).map(tech => {
                    const cfg = techniqueCoverageStyle(tech.status)
                    const isSelected = selected?.id === tech.id
                    return (
                      <button
                        key={tech.id}
                        onClick={() => setSelected(tech)}
                        title={tech.name}
                        className="px-2.5 py-2 text-left transition-all hover:brightness-125 hover:z-10 relative"
                        style={{
                          background: cfg.bg,
                          boxShadow: isSelected ? `inset 0 0 0 1.5px ${cfg.dot}` : 'inset 0 0 0 1px transparent',
                        }}
                      >
                        <div className="flex items-center gap-1">
                          <div className="text-[9.5px] font-mono font-bold" style={{ color: cfg.dot }}>{tech.id}</div>
                          {tech.status === 'testing' && <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: cfg.dot }} />}
                        </div>
                        <div className="text-[9.5px] text-[var(--color-text-secondary)] leading-tight mt-0.5 line-clamp-2">{tech.name}</div>
                        <CoverageBadge tech={tech} />
                      </button>
                    )
                  })}
                  {/* fills remaining column height so short columns still align to the grid rhythm */}
                  <div className="flex-1 bg-[var(--color-background)]" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coverage summary bar */}
        <div className="border-t border-[var(--color-border)] p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] uppercase tracking-widest text-[var(--color-info)] font-semibold">Overall Coverage</span>
            <span className="text-xs font-mono text-[var(--color-text-primary)]">{summary.coveragePercent}% Detected</span>
          </div>
          <div className="h-2.5 bg-[var(--color-surface-2)] rounded-full overflow-hidden flex gap-px">
            {STATUS_ORDER.map(s => {
              const pct = (statusCounts[s] / summary.totalTechniques) * 100
              return <div key={s} className="h-full" style={{ width: `${pct}%`, background: techniqueCoverageStyle(s).dot, opacity: 0.9 }} />
            })}
          </div>
          <div className="flex items-center gap-x-5 gap-y-1.5 mt-2.5 flex-wrap">
            {STATUS_ORDER.map(s => (
              <div key={s} className="flex items-center gap-1.5 text-[10px] font-mono">
                <span className="w-1.5 h-1.5 rounded-full" style={{ background: techniqueCoverageStyle(s).dot }} />
                <span className="text-[var(--color-text-primary)]">{statusCounts[s]}</span>
                <span className="text-[var(--color-text-muted)]">{techniqueCoverageStyle(s).label}</span>
              </div>
            ))}
          </div>
        </div>
      </Panel>

      {/* Technique detail drawer */}
      {selected && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="absolute inset-0 bg-black/60" onClick={() => setSelected(null)} />
          <div className="relative w-full max-w-lg h-full bg-[var(--color-background)] border-l border-[var(--color-border)] overflow-y-auto shadow-2xl">
            <div className="sticky top-0 bg-[var(--color-background)]/95 backdrop-blur border-b border-[var(--color-border)] px-5 py-4 z-10">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-base font-bold text-[#9c8bfb]">{selected.id}</span>
                    <TechniqueStatusPill status={selected.status} />
                  </div>
                  <div className="text-sm text-[var(--color-text-primary)] font-semibold mt-0.5">{selected.name}</div>
                  <div className="text-[10px] uppercase tracking-widest text-[var(--color-info)] mt-1">{selected.tacticName} · {selected.tacticId}</div>
                </div>
                <button onClick={() => setSelected(null)} className="text-[var(--color-info)] hover:text-[var(--color-text-primary)] shrink-0 p-1">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M4 4l8 8M12 4L4 12" /></svg>
                </button>
              </div>
            </div>

            <div className="p-5 space-y-5">
              {detailLoading ? (
                <div className="text-xs text-[var(--color-text-muted)]">Loading detail…</div>
              ) : detail ? (
                <>
                  <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">{detail.description}</p>

                  <div className="grid grid-cols-3 gap-2">
                    <DetailStat label="Alerts" value={detail.coverage.alertCount} color={detail.coverage.alertCount > 0 ? '#30d18a' : undefined} />
                    <DetailStat label="First Observed" value={detail.coverage.firstDetected ? formatDateTime(detail.coverage.firstDetected, profile?.timezone) : '—'} />
                    <DetailStat label="Last Observed" value={detail.coverage.lastDetected ? formatDateTime(detail.coverage.lastDetected, profile?.timezone) : '—'} />
                    <DetailStat label="Simulation Runs" value={detail.coverage.simulationRuns} />
                    <DetailStat label="Last Tested" value={detail.coverage.lastTested ? formatDateTime(detail.coverage.lastTested, profile?.timezone) : '—'} />
                    <DetailStat
                      label="Detection Success"
                      value={detail.coverage.detectionSuccessRate != null ? `${detail.coverage.detectionSuccessRate}%` : '—'}
                      color={detail.coverage.detectionSuccessRate != null ? (detail.coverage.detectionSuccessRate >= 70 ? '#30d18a' : '#ff9d4d') : undefined}
                    />
                  </div>

                  {onTestTechnique && (
                    <button
                      onClick={() => canTest && onTestTechnique(selected.id)}
                      disabled={!canTest}
                      title={canTest ? undefined : 'Requires L2 analyst or admin'}
                      className="w-full py-2.5 rounded-lg border text-xs font-bold uppercase tracking-wider transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                      style={{ borderColor: '#9c8bfb50', background: '#9c8bfb18', color: '#9c8bfb' }}
                    >
                      Test This Technique
                    </button>
                  )}

                  <div>
                    <SectionLabel icon={ICONS.alert} title="Related Alerts" count={detail.relatedAlerts.length} />
                    {detail.relatedAlerts.length === 0 ? (
                      <div className="text-xs text-[var(--color-text-muted)]">No alerts have mapped to this technique yet.</div>
                    ) : (
                      <div className="space-y-1.5">
                        {detail.relatedAlerts.slice(0, 8).map(a => (
                          <button
                            key={a.id}
                            onClick={() => onSelectAlert(a.id)}
                            className="w-full flex items-start gap-2 px-2.5 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-border-bright)] transition-colors text-left"
                          >
                            <RiskBadge score={a.riskScore} />
                            <SeverityBadge severity={a.severity} />
                            <div className="min-w-0 flex-1">
                              <div className="text-[10px] font-mono text-[var(--color-text-secondary)] truncate">{a.id} · {a.sourceIP}</div>
                              {a.proposedAction && a.approvalStatus !== 'None' && (
                                <div className="text-[9px] text-[var(--color-text-muted)] truncate mt-0.5">{a.approvalStatus}: {a.proposedAction.action}</div>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <SectionLabel icon={ICONS.event} title="Related Events" count={detail.relatedEvents.length} />
                    {detail.relatedEvents.length === 0 ? (
                      <div className="text-xs text-[var(--color-text-muted)]">No raw events recorded for this technique.</div>
                    ) : (
                      <div className="space-y-1.5">
                        {detail.relatedEvents.slice(0, 6).map(e => (
                          <div key={e.id} className="px-2.5 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                            <div className="text-[10px] text-[var(--color-text-secondary)] truncate">{e.ruleDescription || `Rule ${e.ruleId}`}</div>
                            <div className="text-[9px] font-mono text-[var(--color-text-muted)] mt-0.5">{e.id} · {e.sourceIP}{e.agentName ? ` · ${e.agentName}` : ''}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {detail.affectedHosts.length > 0 && (
                    <div>
                      <SectionLabel icon={ICONS.host} title="Affected Hosts" count={detail.affectedHosts.length} />
                      <div className="flex flex-wrap gap-1.5">
                        {detail.affectedHosts.map(h => <Chip key={h}>{h}</Chip>)}
                      </div>
                    </div>
                  )}

                  {detail.relatedRules.length > 0 && (
                    <div>
                      <SectionLabel icon={ICONS.rule} title="Related Rules" count={detail.relatedRules.length} />
                      <div className="space-y-1">
                        {detail.relatedRules.slice(0, 6).map(r => (
                          <div key={r.ruleId} className="flex items-center justify-between gap-2 text-[10px] px-2.5 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                            <span className="text-[var(--color-text-secondary)] truncate">{r.ruleDescription || `Rule ${r.ruleId}`}</span>
                            <span className="font-mono text-[var(--color-text-muted)] shrink-0">×{r.occurrences}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <SectionLabel icon={ICONS.case} title="Related Cases" count={detail.relatedCases.length} />
                    {detail.relatedCases.length === 0 ? (
                      <div className="text-xs text-[var(--color-text-muted)]">No cases opened from this technique.</div>
                    ) : (
                      <div className="space-y-1.5">
                        {detail.relatedCases.map(c => (
                          <div key={c.id} className="px-2.5 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)] text-xs text-[var(--color-text-secondary)]">
                            {c.id} · {c.title}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <SectionLabel icon={ICONS.bolt} title="Simulation History" count={detail.relatedSimulationRuns.length} />
                    {detail.relatedSimulationRuns.length === 0 ? (
                      <EmptyState message="No simulation results yet" sub="Run a controlled detection validation test to measure coverage here." />
                    ) : (
                      <div className="space-y-1.5">
                        {detail.relatedSimulationRuns.slice(0, 8).map(r => (
                          <div key={r.id} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-[var(--color-surface)] border border-[var(--color-border)]">
                            <span className="text-[10px] font-mono text-[var(--color-text-muted)] truncate">{r.id} · {formatDateTime(r.startedAt, profile?.timezone)}</span>
                            <SimStatusPill status={r.status} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-xs text-[#fb4a63]">Could not load technique detail.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
