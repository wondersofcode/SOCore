import { useEffect, useMemo, useState } from 'react'
import {
  AreaChart, Area, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { SeverityBadge, AlertStatusPill, Panel, PanelHeader, RiskBadge } from './Shared'
import AssistantWidget from './AssistantWidget'
import { riskTrendData } from '../data'
import type { WazuhRawEvent } from '../data'
import { useStore } from '../store'
import { api } from '../api'
import type { ConnectionStatus } from '../api'
import { useAuth } from '../lib/AuthContext'
import { formatDateTime } from '../lib/dateFormat'

const SEVERITY_ORDER = ['Critical', 'High', 'Medium', 'Low', 'Informational'] as const
const SEVERITY_COLOR: Record<string, string> = {
  Critical: '#fb4a63', High: '#ff9d4d', Medium: '#f2c94c', Low: '#4f8cff', Informational: 'var(--color-info)',
}

const INTEGRATIONS: { key: string; name: string }[] = [
  { key: 'wazuh', name: 'Wazuh' },
  { key: 'misp', name: 'MISP' },
  { key: 'cortex', name: 'Cortex' },
  { key: 'shuffle', name: 'Shuffle' },
  { key: 'slack', name: 'Slack' },
  { key: 'ai', name: 'AI (Groq)' },
]

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000))
  if (totalSeconds < 60) return `${totalSeconds}s`
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes < 60) return `${minutes}:${String(seconds).padStart(2, '0')}`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

// ── Detection Pipeline Node ─────────────────────────────────────────────────
function PipelineNode({ label, count, color, delay = 0 }: { label: string; count: number; color: string; delay?: number }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <div
        className="relative w-20 h-20 rounded-full border-2 flex flex-col items-center justify-center"
        style={{ borderColor: color, boxShadow: `0 0 20px ${color}30, inset 0 0 20px ${color}10` }}
      >
        <div className="absolute inset-0 rounded-full opacity-10" style={{ background: color }} />
        <span className="text-2xl font-bold font-mono" style={{ color }}>{count}</span>
      </div>
      <span className="text-[10px] uppercase tracking-widest text-[var(--color-text-secondary)] font-semibold">{label}</span>
    </div>
  )
}

function FlowArrow({ active }: { active?: boolean }) {
  return (
    <div className="flex-1 flex items-center justify-center gap-0.5 pb-6">
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          className="h-px flex-1"
          style={{
            background: '#4f8cff',
            opacity: active ? (0.2 + i * 0.2) : 0.15,
            animation: active ? `flow-pulse 1.5s ease-in-out ${i * 0.2}s infinite` : 'none',
          }}
        />
      ))}
      <svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0" style={{ marginLeft: -4 }}>
        <path d="M1 5H9M6 2L9 5L6 8" stroke="#4f8cff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.6} />
      </svg>
    </div>
  )
}

// ── Risk Gauge ───────────────────────────────────────────────────────────────
function RiskGauge({ score }: { score: number }) {
  const angle = -135 + (score / 100) * 270
  const color = score >= 75 ? '#fb4a63' : score >= 50 ? '#ff9d4d' : score >= 25 ? '#f2c94c' : '#30d18a'
  return (
    <div className="relative bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 overflow-hidden hover:border-[var(--color-border-bright)] transition-colors">
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${color}60, transparent)` }} />
      <div className="text-[var(--color-text-secondary)] text-xs uppercase tracking-widest font-semibold mb-3">System Risk Score</div>
      <div className="flex flex-col items-center gap-1">
        <svg width="100" height="60" viewBox="0 0 100 60">
          {/* Track */}
          <path d="M 10 55 A 40 40 0 0 1 90 55" fill="none" stroke="var(--color-border)" strokeWidth="6" strokeLinecap="round" />
          {/* Fill */}
          <path d="M 10 55 A 40 40 0 0 1 90 55" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 125.6} 125.6`} opacity={0.8} />
          {/* Needle */}
          <g transform={`translate(50 55) rotate(${angle})`}>
            <line x1="0" y1="0" x2="0" y2="-28" stroke={color} strokeWidth="2" strokeLinecap="round" />
            <circle cx="0" cy="0" r="3" fill={color} />
          </g>
          {/* Labels */}
          <text x="8" y="58" fill="var(--color-text-muted)" fontSize="8" fontFamily="JetBrains Mono">0</text>
          <text x="86" y="58" fill="var(--color-text-muted)" fontSize="8" fontFamily="JetBrains Mono">100</text>
        </svg>
        <div className="text-3xl font-bold font-mono" style={{ color }}>{score}</div>
        <div className="text-[10px] uppercase tracking-widest" style={{ color }}>
          {score >= 75 ? 'Critical' : score >= 50 ? 'Elevated' : score >= 25 ? 'Moderate' : 'Low'}
        </div>
        <div className="mt-1 text-[10px] font-mono text-[var(--color-text-muted)]">
          Avg across open alerts
        </div>
      </div>
    </div>
  )
}

// ── Custom Tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[var(--color-surface-2)] border border-[var(--color-border-bright)] rounded px-3 py-2 text-xs font-mono shadow-xl">
      <div className="text-[var(--color-text-secondary)] mb-1">{label}</div>
      <div className="text-[var(--color-text-primary)] font-semibold">{payload[0].value}</div>
    </div>
  )
}

// ── Mini Kanban ──────────────────────────────────────────────────────────────
function KanbanCard({ id, title, severity }: { id: string; title: string; severity: string }) {
  const colors: Record<string, string> = { Critical: '#fb4a63', High: '#ff9d4d', Medium: '#f2c94c', Low: '#4f8cff', Informational: 'var(--color-info)' }
  const color = colors[severity] || 'var(--color-info)'
  return (
    <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded p-2.5 hover:border-[var(--color-border-bright)] transition-colors cursor-pointer group">
      <div className="h-0.5 rounded-full mb-2" style={{ background: color, opacity: 0.7 }} />
      <div className="text-[10px] font-mono text-[var(--color-info)] mb-1">{id}</div>
      <div className="text-xs text-[var(--color-text-primary)] leading-tight group-hover:text-white transition-colors">{title}</div>
    </div>
  )
}

// ── Distribution bar row (severity / attack type breakdowns) ────────────────
function BarRow({ label, n, max, color }: { label: string; n: number; max: number; color: string }) {
  const pct = max > 0 ? Math.round((n / max) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] text-[var(--color-text-secondary)] w-24 shrink-0 truncate">{label}</span>
      <div className="flex-1 h-1.5 rounded-full bg-[var(--color-border)] overflow-hidden">
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: color, opacity: 0.85 }} />
      </div>
      <span className="text-[11px] font-mono font-semibold w-6 text-right shrink-0" style={{ color }}>{n}</span>
    </div>
  )
}

// ── Metric tile (compact stat card for the strip beside the posture panel) ──
function MetricTile({ icon, value, label, accent }: { icon: React.ReactNode; value: React.ReactNode; label: string; accent: string }) {
  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-3.5 flex items-center gap-3">
      <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 [&_svg]:w-[16px] [&_svg]:h-[16px]" style={{ background: `${accent}18`, color: accent }}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-lg font-bold font-mono leading-tight text-[var(--color-text-primary)] truncate">{value}</div>
        <div className="text-[10.5px] text-[var(--color-text-muted)] truncate">{label}</div>
      </div>
    </div>
  )
}

// ── System Health row (real connection status from GET /api/health) ─────────
function HealthRow({ name, status }: { name: string; status: ConnectionStatus | undefined }) {
  const connected = status?.connected ?? false
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-[var(--color-border)] last:border-0">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: connected ? '#30d18a' : 'var(--color-text-muted)' }} />
      <span className="text-xs font-semibold text-[var(--color-text-primary)] flex-1">{name}</span>
      <span className="text-[10px] font-mono font-semibold uppercase" style={{ color: connected ? '#30d18a' : 'var(--color-text-muted)' }}>
        {connected ? 'Online' : 'Offline'}
      </span>
    </div>
  )
}

// ── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard({ onSelectAlert, onOpenQueue, onOpenApprovals }: { onSelectAlert: (id: string) => void; onOpenQueue: () => void; onOpenApprovals: () => void }) {
  const { alerts, cases, pending, live } = useStore()
  const { profile } = useAuth()
  const timezone = profile?.timezone
  const [connections, setConnections] = useState<Record<string, ConnectionStatus>>({})
  useEffect(() => { api.health().then(h => setConnections(h.connections ?? {})).catch(() => {}) }, [])
  // The dashboard shows only the newest slice — full triage lives on the Alerts queue.
  const recent = [...alerts].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 5)
  const openAlerts = alerts.filter(a => a.status !== 'Resolved')

  // System Risk Score — real average across every open (non-Resolved) alert.
  const riskScore = openAlerts.length
    ? Math.round(openAlerts.reduce((sum, a) => sum + a.riskScore, 0) / openAlerts.length)
    : 0

  // Raw event history — only the Dashboard needs the total count and the
  // createdAt timestamps (for time-to-detect below), so it fetches its own
  // copy rather than adding events to the global poller everything else uses.
  const [events, setEvents] = useState<WazuhRawEvent[]>([])
  const [eventsTotal, setEventsTotal] = useState<number | null>(null)
  useEffect(() => {
    if (!live) return
    let cancelled = false
    Promise.all([api.events(200), api.eventsCount()])
      .then(([evs, count]) => { if (!cancelled) { setEvents(evs); setEventsTotal(count.count) } })
      .catch(() => { /* backend went away; keep whatever we last had */ })
    return () => { cancelled = true }
  }, [live])

  // Detection Pipeline — real counts, not sample data.
  const pipelineDetect = eventsTotal ?? 0
  const pipelineEnrich = alerts.filter(a => !!a.enrichedAt).length
  const pipelineRespond = alerts.filter(a => a.status === 'Responding').length
  const pipelineTrack = cases.filter(c => c.status === 'Closed' || c.status === 'Contained').length

  // Avg Time-to-Detect — the real elapsed time between a raw event landing
  // (events.createdAt) and the alert it produced landing (alerts.createdAt).
  // `timestamp`/`detectedAt` can't be used for this: both are copied
  // verbatim from the source event by the correlation engine, so they're
  // always identical and would show a meaningless flat 0.
  const mttd = useMemo(() => {
    const eventById = new Map(events.map(e => [e.id, e]))
    const samples: { ms: number; at: number }[] = []
    for (const a of alerts) {
      if (!a.sourceEventId || !a.createdAt) continue
      const ev = eventById.get(a.sourceEventId)
      if (!ev?.createdAt) continue
      const evAt = new Date(ev.createdAt).getTime()
      const alAt = new Date(a.createdAt).getTime()
      if (!Number.isFinite(evAt) || !Number.isFinite(alAt) || alAt < evAt) continue
      samples.push({ ms: alAt - evAt, at: alAt })
    }
    if (samples.length === 0) return { value: '—', trend: undefined }

    const avg = (xs: { ms: number }[]) => xs.reduce((s, x) => s + x.ms, 0) / xs.length
    const value = formatDuration(avg(samples))

    const DAY = 86_400_000
    const now = Date.now()
    const last7 = samples.filter(s => now - s.at < 7 * DAY)
    const prev7 = samples.filter(s => now - s.at >= 7 * DAY && now - s.at < 14 * DAY)
    let trend: { direction: 'up' | 'down'; label: string; positive: boolean } | undefined
    if (last7.length > 0 && prev7.length > 0) {
      const avgLast = avg(last7), avgPrev = avg(prev7)
      const pct = avgPrev > 0 ? Math.round((Math.abs(avgLast - avgPrev) / avgPrev) * 100) : 0
      const faster = avgLast <= avgPrev
      trend = { direction: faster ? 'down' : 'up', label: `${faster ? '-' : '+'}${pct}% this week`, positive: faster }
    }
    return { value, trend }
  }, [alerts, events])

  const severityCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const a of alerts) counts[a.severity] = (counts[a.severity] ?? 0) + 1
    return counts
  }, [alerts])
  const maxSeverity = Math.max(1, ...SEVERITY_ORDER.map(s => severityCounts[s] ?? 0))

  const topAttackTypes = useMemo(() => {
    const counts = new Map<string, number>()
    for (const a of alerts) counts.set(a.attackType, (counts.get(a.attackType) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
  }, [alerts])
  const maxAttackType = Math.max(1, ...topAttackTypes.map(([, n]) => n))

  const criticalUnresolved = alerts.filter(a => a.severity === 'Critical' && a.status !== 'Resolved').length
  const openCases = cases.filter(c => c.status !== 'Closed').length
  const healthyCount = INTEGRATIONS.filter(i => connections[i.key]?.connected).length

  return (
    <div className="space-y-4">
      <AssistantWidget />

      {/* Posture panel + metric strip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-8 relative overflow-hidden rounded-lg border border-[var(--color-border)] p-5 flex flex-col sm:flex-row gap-6 items-center"
          style={{ background: 'linear-gradient(155deg, var(--color-surface) 0%, var(--color-background) 65%)' }}>
          <RiskGauge score={riskScore} />
          <div className="flex-1 min-w-0 w-full">
            <div className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-widest mb-1.5" style={{ color: riskScore >= 75 ? '#fb4a63' : riskScore >= 50 ? '#ff9d4d' : '#30d18a' }}>
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M6 1l5 2.3v3c0 3-2 5.4-5 6.2-3-.8-5-3.2-5-6.2v-3L6 1z" /><path d="M6 5.5v2M6 9v.01" /></svg>
              {criticalUnresolved > 0 ? `${criticalUnresolved} unresolved critical alert${criticalUnresolved === 1 ? '' : 's'}` : 'No unresolved critical alerts'}
            </div>
            <h2 className="text-[17px] font-bold text-[var(--color-text-primary)] leading-snug mb-1.5">
              {pending.length > 0
                ? `${pending.length} action${pending.length === 1 ? ' is' : 's are'} awaiting analyst approval before response runs.`
                : 'No actions are currently blocked on analyst approval.'}
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)] mb-4 max-w-[52ch]">
              Correlation engine has scored {alerts.length} alert{alerts.length === 1 ? '' : 's'} across {cases.length} case{cases.length === 1 ? '' : 's'} this retention window.
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-3">
              <div>
                <div className="text-base font-mono font-bold text-[var(--color-text-primary)]">{alerts.filter(a => a.status !== 'Resolved').length}</div>
                <div className="text-[10.5px] text-[var(--color-text-muted)]">Active alerts</div>
              </div>
              <div>
                <div className="text-base font-mono font-bold text-[var(--color-text-primary)]">{pending.length}</div>
                <div className="text-[10.5px] text-[var(--color-text-muted)]">Awaiting approval</div>
              </div>
              <div>
                <div className="text-base font-mono font-bold text-[var(--color-text-primary)]">{mttd.value}</div>
                <div className="text-[10.5px] text-[var(--color-text-muted)]">Avg time-to-detect</div>
              </div>
              <div>
                <div className="text-base font-mono font-bold text-[var(--color-text-primary)]">{healthyCount}/{INTEGRATIONS.length}</div>
                <div className="text-[10.5px] text-[var(--color-text-muted)]">Integrations healthy</div>
              </div>
            </div>
          </div>
        </div>

        <div className="lg:col-span-4 flex flex-col gap-2.5">
          <MetricTile
            accent="#fb4a63"
            value={criticalUnresolved}
            label="Critical, unresolved"
            icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="10" cy="10" r="7.5" /><path d="M10 6v4.5l3 2" /></svg>}
          />
          <MetricTile
            accent="#4f8cff"
            value={openCases}
            label="Open cases"
            icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="14" height="12" rx="1.5" /><path d="M6 4V2.5M14 4V2.5M3 8h14" /></svg>}
          />
          <MetricTile
            accent="#30d18a"
            value={eventsTotal ?? '—'}
            label="Raw events ingested"
            icon={<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10h3l2-5 4 10 2-5h3" /></svg>}
          />
        </div>
      </div>

      {/* Detection Pipeline */}
      <Panel>
        <PanelHeader title="Detection Pipeline" />
        <div className="px-6 py-5 flex items-center gap-0">
          <PipelineNode label="Detect" count={pipelineDetect} color="#4f8cff" />
          <FlowArrow active />
          <PipelineNode label="Enrich" count={pipelineEnrich} color="#9c8bfb" delay={200} />
          <FlowArrow active />
          <PipelineNode label="Respond" count={pipelineRespond} color="#ff9d4d" delay={400} />
          <FlowArrow active />
          <PipelineNode label="Track" count={pipelineTrack} color="#30d18a" delay={600} />
        </div>
      </Panel>

      {/* Threat activity chart */}
      <Panel>
        <PanelHeader title="Risk Score — Last 24h" />
        <div className="px-2 py-3" style={{ height: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={riskTrendData} margin={{ top: 8, right: 16, bottom: 0, left: -20 }}>
              <defs>
                <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#fb4a63" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#fb4a63" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
              <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--color-info)', fontFamily: 'JetBrains Mono' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--color-info)', fontFamily: 'JetBrains Mono' }} />
              <Tooltip content={<ChartTooltip />} />
              <Area type="monotone" dataKey="score" stroke="#fb4a63" strokeWidth={2} fill="url(#riskGrad)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </Panel>

      {/* Severity distribution · Top attack types · System health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Panel>
          <PanelHeader title="Severity Distribution">
            <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{alerts.length} alerts</span>
          </PanelHeader>
          <div className="p-4 flex flex-col gap-2.5">
            {SEVERITY_ORDER.map(s => (
              <BarRow key={s} label={s} n={severityCounts[s] ?? 0} max={maxSeverity} color={SEVERITY_COLOR[s]} />
            ))}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="Top Attack Types" />
          <div className="p-4 flex flex-col gap-2.5">
            {topAttackTypes.length === 0
              ? <div className="text-[11px] text-[var(--color-text-muted)] italic">No alerts yet</div>
              : topAttackTypes.map(([type, n]) => (
                <BarRow key={type} label={type} n={n} max={maxAttackType} color="#4f8cff" />
              ))}
          </div>
        </Panel>

        <Panel>
          <PanelHeader title="System Health">
            <span className="text-[10px] font-mono text-[var(--color-text-muted)]">{healthyCount}/{INTEGRATIONS.length} connected</span>
          </PanelHeader>
          <div>
            {INTEGRATIONS.map(i => <HealthRow key={i.key} name={i.name} status={connections[i.key]} />)}
          </div>
        </Panel>
      </div>

      {/* Analyst Workspace */}
      <Panel>
        <PanelHeader title="Analyst Workspace">
          <span className="text-[10px] font-mono text-[var(--color-text-muted)]">Suggested next actions</span>
        </PanelHeader>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4">
          <button onClick={onOpenQueue} className="text-left bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg p-3.5 flex flex-col gap-2.5 hover:border-[#4f8cff] hover:-translate-y-0.5 transition-all">
            <div className="w-8 h-8 rounded-lg bg-[#4f8cff18] text-[#4f8cff] flex items-center justify-center [&_svg]:w-4 [&_svg]:h-4">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><path d="M10 2l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" /><circle cx="10" cy="12" r="5" /></svg>
            </div>
            <div>
              <div className="text-xs font-bold text-[var(--color-text-primary)]">Triage the alert queue</div>
              <div className="text-[10.5px] text-[var(--color-text-muted)]">{alerts.filter(a => a.status !== 'Resolved').length} alerts open</div>
            </div>
          </button>
          <button onClick={onOpenApprovals} className="text-left bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-lg p-3.5 flex flex-col gap-2.5 hover:border-[#ff9d4d] hover:-translate-y-0.5 transition-all">
            <div className="w-8 h-8 rounded-lg bg-[#ff9d4d18] text-[#ff9d4d] flex items-center justify-center [&_svg]:w-4 [&_svg]:h-4">
              <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10 2l6 2.5V9c0 3.4-2.6 6.4-6 7.2C5.6 15.4 3 12.4 3 9V4.5L9 2z" /><path d="M6.5 9l1.8 1.8L11.8 7.3" /></svg>
            </div>
            <div>
              <div className="text-xs font-bold text-[var(--color-text-primary)]">Review pending approvals</div>
              <div className="text-[10.5px] text-[var(--color-text-muted)]">{pending.length} waiting on a decision</div>
            </div>
          </button>
        </div>
      </Panel>

      {/* Live Alerts Feed */}
      <Panel>
        <PanelHeader title="Newest alerts">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#30d18a] pulse-live" />
              <span className="text-[10px] font-mono text-[#30d18a]">LIVE</span>
            </div>
            <button
              onClick={onOpenQueue}
              className="text-[10px] px-2 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[#4f8cff] hover:border-[#4f8cff40] transition-colors"
            >
              Open triage queue
            </button>
          </div>
        </PanelHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border)]">
                {['Timestamp', 'Risk', 'Severity', 'Source IP', 'Attack Type', 'ATT&CK ID', 'Status', 'Analyst'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest text-[var(--color-info)] font-semibold whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {recent.map((alert) => (
                <tr
                  key={alert.id}
                  onClick={() => onSelectAlert(alert.id)}
                  className="border-b border-[var(--color-border)] hover:bg-[var(--color-surface-2)] cursor-pointer group transition-colors"
                >
                  <td className="px-4 py-2.5 font-mono text-[var(--color-text-secondary)] whitespace-nowrap">{formatDateTime(alert.timestamp, timezone)}</td>
                  <td className="px-4 py-2.5"><RiskBadge score={alert.riskScore} /></td>
                  <td className="px-4 py-2.5"><SeverityBadge severity={alert.severity} /></td>
                  <td className="px-4 py-2.5 font-mono text-[var(--color-text-primary)] whitespace-nowrap">{alert.sourceIP}</td>
                  <td className="px-4 py-2.5 text-[var(--color-text-primary)] group-hover:text-[#4f8cff] transition-colors whitespace-nowrap">{alert.attackType}</td>
                  <td className="px-4 py-2.5 font-mono text-[#9c8bfb] whitespace-nowrap">{alert.mitreId}</td>
                  <td className="px-4 py-2.5"><AlertStatusPill status={alert.status as any} /></td>
                  <td className="px-4 py-2.5 text-[var(--color-text-secondary)] whitespace-nowrap">{alert.analyst}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          onClick={onOpenQueue}
          className="w-full py-2.5 text-[11px] text-[var(--color-text-secondary)] hover:text-[#4f8cff] border-t border-[var(--color-border)] transition-colors"
        >
          View all {alerts.length} alerts in the triage queue
        </button>
      </Panel>

      {/* Mini Kanban — grouped from the real /api/cases data */}
      <Panel>
        <PanelHeader title="Case Status Board" />
        <div className="grid grid-cols-3 gap-3 p-4">
          {(['New', 'In Progress', 'Resolved'] as const).map(col => {
            const colCases = cases.filter(c =>
              col === 'New' ? c.status === 'Open' :
              col === 'In Progress' ? c.status === 'Investigating' :
              c.status === 'Closed' || c.status === 'Contained'
            )
            const colColors = { New: '#4f8cff', 'In Progress': '#ff9d4d', Resolved: '#30d18a' }
            return (
              <div key={col}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: colColors[col] }}>{col}</span>
                  <span className="text-[10px] font-mono text-[var(--color-text-muted)]">({colCases.length})</span>
                </div>
                <div className="space-y-2">
                  {colCases.length === 0
                    ? <div className="text-[11px] text-[var(--color-text-muted)] italic px-1 py-2">No cases</div>
                    : colCases.map(c => <KanbanCard key={c.id} id={c.id} title={c.title} severity={c.severity} />)}
                </div>
              </div>
            )
          })}
        </div>
      </Panel>
    </div>
  )
}
