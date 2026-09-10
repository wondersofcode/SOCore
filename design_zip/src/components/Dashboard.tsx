import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { StatCard, SeverityBadge, AlertStatusPill, Panel, PanelHeader, RiskBadge } from './Shared'
import { riskTrendData, attackTypeData } from '../data'
import { useStore } from '../store'

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
            background: '#00d4ff',
            opacity: active ? (0.2 + i * 0.2) : 0.15,
            animation: active ? `flow-pulse 1.5s ease-in-out ${i * 0.2}s infinite` : 'none',
          }}
        />
      ))}
      <svg width="10" height="10" viewBox="0 0 10 10" className="shrink-0" style={{ marginLeft: -4 }}>
        <path d="M1 5H9M6 2L9 5L6 8" stroke="#00d4ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity={0.6} />
      </svg>
    </div>
  )
}

// ── Risk Gauge ───────────────────────────────────────────────────────────────
function RiskGauge({ score }: { score: number }) {
  const angle = -135 + (score / 100) * 270
  const color = score >= 75 ? '#ef4444' : score >= 50 ? '#f97316' : score >= 25 ? '#eab308' : '#22c55e'
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
        <div className="mt-1 flex items-center gap-1 text-xs font-mono text-[#ef4444]">
          <span>↑</span><span>+12 vs 1h ago</span>
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
  const colors: Record<string, string> = { Critical: '#ef4444', High: '#f97316', Medium: '#eab308', Low: '#3b82f6', Informational: 'var(--color-info)' }
  const color = colors[severity] || 'var(--color-info)'
  return (
    <div className="bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded p-2.5 hover:border-[var(--color-border-bright)] transition-colors cursor-pointer group">
      <div className="h-0.5 rounded-full mb-2" style={{ background: color, opacity: 0.7 }} />
      <div className="text-[10px] font-mono text-[var(--color-info)] mb-1">{id}</div>
      <div className="text-xs text-[var(--color-text-primary)] leading-tight group-hover:text-white transition-colors">{title}</div>
    </div>
  )
}

// ── Main Dashboard ───────────────────────────────────────────────────────────
export default function Dashboard({ onSelectAlert, onOpenQueue, onOpenApprovals }: { onSelectAlert: (id: string) => void; onOpenQueue: () => void; onOpenApprovals: () => void }) {
  const { alerts, pending } = useStore()
  // The dashboard shows only the newest slice — full triage lives on the Alerts queue.
  const recent = [...alerts].sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 5)

  return (
    <div className="space-y-4">
      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="currentColor"><path d="M9 2a7 7 0 1 1 0 14A7 7 0 0 1 9 2zm0 2a5 5 0 1 0 0 10A5 5 0 0 0 9 4zm-.5 2.5h1v4h-1V8.5zm0 5h1v1h-1v-1z" /></svg>}
          label="Active Alerts"
          value={alerts.filter(a => a.status !== 'Resolved').length}
          trend={{ direction: 'up', label: '+8 vs 1h ago', positive: false }}
          accent="#ef4444"
          glow
        />
        <button onClick={onOpenApprovals} className="text-left">
          <StatCard
            icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M9 2l6 2.5V9c0 3.4-2.6 6.4-6 7.2C5.6 15.4 3 12.4 3 9V4.5L9 2z" strokeLinejoin="round" /><path d="M6.5 9l1.8 1.8L11.8 7.3" strokeLinecap="round" strokeLinejoin="round" /></svg>}
            label="Awaiting Your Approval"
            value={pending.length}
            trend={pending.length > 0 ? { direction: 'up', label: 'blocked until reviewed', positive: false } : undefined}
            accent="#f97316"
            glow={pending.length > 0}
          />
        </button>
        <StatCard
          icon={<svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="9" cy="9" r="7" /><path d="M9 5v4l3 2" strokeLinecap="round" /></svg>}
          label="Avg Time-to-Detect"
          value="4:32"
          trend={{ direction: 'down', label: '-1:14 this week', positive: true }}
          accent="#00d4ff"
        />
        <RiskGauge score={81} />
      </div>

      {/* Detection Pipeline */}
      <Panel>
        <PanelHeader title="Detection Pipeline" />
        <div className="px-6 py-5 flex items-center gap-0">
          <PipelineNode label="Detect" count={23} color="#00d4ff" />
          <FlowArrow active />
          <PipelineNode label="Enrich" count={11} color="#a855f7" delay={200} />
          <FlowArrow active />
          <PipelineNode label="Respond" count={8} color="#f97316" delay={400} />
          <FlowArrow active />
          <PipelineNode label="Track" count={5} color="#22c55e" delay={600} />
        </div>
      </Panel>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Risk Trend */}
        <Panel>
          <PanelHeader title="Risk Score — Last 24h" />
          <div className="px-2 py-3" style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={riskTrendData} margin={{ top: 8, right: 16, bottom: 0, left: -20 }}>
                <defs>
                  <linearGradient id="riskGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="time" tick={{ fontSize: 10, fill: 'var(--color-info)', fontFamily: 'JetBrains Mono' }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--color-info)', fontFamily: 'JetBrains Mono' }} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="score" stroke="#ef4444" strokeWidth={2} fill="url(#riskGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Panel>

        {/* Top Attack Types */}
        <Panel>
          <PanelHeader title="Top Attack Types" />
          <div className="px-2 py-3" style={{ height: 180 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={attackTypeData} layout="vertical" margin={{ top: 4, right: 16, bottom: 0, left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10, fill: 'var(--color-info)', fontFamily: 'JetBrains Mono' }} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'var(--color-text-secondary)', fontFamily: 'JetBrains Mono' }} width={60} />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="count" fill="#00d4ff" opacity={0.7} radius={[0, 2, 2, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Panel>
      </div>

      {/* Live Alerts Feed */}
      <Panel>
        <PanelHeader title="Newest alerts">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-[#22c55e] pulse-live" />
              <span className="text-[10px] font-mono text-[#22c55e]">LIVE</span>
            </div>
            <button
              onClick={onOpenQueue}
              className="text-[10px] px-2 py-0.5 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[#00d4ff] hover:border-[#00d4ff40] transition-colors"
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
                  <td className="px-4 py-2.5 font-mono text-[var(--color-text-secondary)] whitespace-nowrap">{alert.timestamp}</td>
                  <td className="px-4 py-2.5"><RiskBadge score={alert.riskScore} /></td>
                  <td className="px-4 py-2.5"><SeverityBadge severity={alert.severity} /></td>
                  <td className="px-4 py-2.5 font-mono text-[var(--color-text-primary)] whitespace-nowrap">{alert.sourceIP}</td>
                  <td className="px-4 py-2.5 text-[var(--color-text-primary)] group-hover:text-[#00d4ff] transition-colors whitespace-nowrap">{alert.attackType}</td>
                  <td className="px-4 py-2.5 font-mono text-[#a855f7] whitespace-nowrap">{alert.mitreId}</td>
                  <td className="px-4 py-2.5"><AlertStatusPill status={alert.status as any} /></td>
                  <td className="px-4 py-2.5 text-[var(--color-text-secondary)] whitespace-nowrap">{alert.analyst}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          onClick={onOpenQueue}
          className="w-full py-2.5 text-[11px] text-[var(--color-text-secondary)] hover:text-[#00d4ff] border-t border-[var(--color-border)] transition-colors"
        >
          View all {alerts.length} alerts in the triage queue
        </button>
      </Panel>

      {/* Mini Kanban */}
      <Panel>
        <PanelHeader title="Case Status Board" />
        <div className="grid grid-cols-3 gap-3 p-4">
          {(['New', 'In Progress', 'Resolved'] as const).map(col => {
            const colCases = [
              { id: 'CASE-2024-0038', title: 'Anomalous Admin Account Activity', severity: 'High' },
              { id: 'CASE-2024-0037', title: 'Lateral Movement via SMB', severity: 'High' },
              { id: 'CASE-2024-0042', title: 'Coordinated SSH Brute Force', severity: 'Critical' },
              { id: 'CASE-2024-0041', title: 'Suspected C2 Callback — WKSTN-088', severity: 'Critical' },
              { id: 'CASE-2024-0040', title: 'Phishing Email — Credential Harvesting', severity: 'High' },
              { id: 'CASE-2024-0039', title: 'Internal Port Sweep — DMZ Segment', severity: 'Medium' },
            ].filter((_, i) =>
              col === 'New' ? i < 2 :
              col === 'In Progress' ? i >= 2 && i < 5 :
              i >= 5
            )
            const colColors = { New: '#00d4ff', 'In Progress': '#f97316', Resolved: '#22c55e' }
            return (
              <div key={col}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-semibold uppercase tracking-widest" style={{ color: colColors[col] }}>{col}</span>
                  <span className="text-[10px] font-mono text-[var(--color-text-muted)]">({colCases.length})</span>
                </div>
                <div className="space-y-2">
                  {colCases.map(c => <KanbanCard key={c.id} {...c} />)}
                </div>
              </div>
            )
          })}
        </div>
      </Panel>
    </div>
  )
}
