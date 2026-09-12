import type { Severity, AlertStatus, CaseStatus, SimulationRunStatus, TechniqueCoverageStatus } from '../data'

// ── Severity Badge ──────────────────────────────────────────────────────────
const severityConfig: Record<Severity, { bg: string; text: string; border: string }> = {
  Critical: { bg: 'bg-[#fb4a6320]', text: 'text-[#fb4a63]', border: 'border-[#fb4a6340]' },
  High: { bg: 'bg-[#ff9d4d20]', text: 'text-[#ff9d4d]', border: 'border-[#ff9d4d40]' },
  Medium: { bg: 'bg-[#f2c94c20]', text: 'text-[#f2c94c]', border: 'border-[#f2c94c40]' },
  Low: { bg: 'bg-[#4f8cff20]', text: 'text-[#4f8cff]', border: 'border-[#4f8cff40]' },
  Informational: { bg: 'bg-[#6b728020]', text: 'text-[var(--color-info)]', border: 'border-[#6b728040]' },
}

export function SeverityBadge({ severity }: { severity: Severity }) {
  const c = severityConfig[severity]
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-widest border font-mono ${c.bg} ${c.text} ${c.border}`}>
      {severity}
    </span>
  )
}

export function SeverityDot({ severity }: { severity: Severity }) {
  const colors: Record<Severity, string> = {
    Critical: 'bg-[#fb4a63]',
    High: 'bg-[#ff9d4d]',
    Medium: 'bg-[#f2c94c]',
    Low: 'bg-[#4f8cff]',
    Informational: 'bg-[var(--color-info)]',
  }
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[severity]} shrink-0`} />
}

// ── Status Pill ─────────────────────────────────────────────────────────────
const alertStatusConfig: Record<AlertStatus, { bg: string; text: string }> = {
  New: { bg: 'bg-[#4f8cff15]', text: 'text-[#4f8cff]' },
  Enriching: { bg: 'bg-[#9c8bfb15]', text: 'text-[#9c8bfb]' },
  Responding: { bg: 'bg-[#ff9d4d15]', text: 'text-[#ff9d4d]' },
  Resolved: { bg: 'bg-[#30d18a15]', text: 'text-[#30d18a]' },
}

export function AlertStatusPill({ status }: { status: AlertStatus }) {
  const c = alertStatusConfig[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${c.text} bg-current opacity-80`} />
      {status}
    </span>
  )
}

const caseStatusConfig: Record<CaseStatus, { bg: string; text: string }> = {
  Open: { bg: 'bg-[#4f8cff15]', text: 'text-[#4f8cff]' },
  Investigating: { bg: 'bg-[#ff9d4d15]', text: 'text-[#ff9d4d]' },
  Contained: { bg: 'bg-[#9c8bfb15]', text: 'text-[#9c8bfb]' },
  Closed: { bg: 'bg-[#30d18a15]', text: 'text-[#30d18a]' },
}

export function CaseStatusPill({ status }: { status: CaseStatus }) {
  const c = caseStatusConfig[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${c.bg} ${c.text}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {status}
    </span>
  )
}

const simRunStatusConfig: Record<SimulationRunStatus, { bg: string; text: string; label: string }> = {
  running: { bg: 'bg-[#9c8bfb20]', text: 'text-[#9c8bfb]', label: 'Running' },
  passed: { bg: 'bg-[#30d18a20]', text: 'text-[#30d18a]', label: 'Passed' },
  partial: { bg: 'bg-[#f2c94c20]', text: 'text-[#f2c94c]', label: 'Partial' },
  failed: { bg: 'bg-[#fb4a6320]', text: 'text-[#fb4a63]', label: 'Failed' },
  not_observed: { bg: 'bg-[#6b728020]', text: 'text-[var(--color-info)]', label: 'Not Observed' },
}

export function SimStatusPill({ status }: { status: SimulationRunStatus }) {
  const c = simRunStatusConfig[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${c.bg} ${c.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full bg-current ${status === 'running' ? 'pulse-live' : ''}`} />
      {c.label}
    </span>
  )
}

const techCoverageConfig: Record<TechniqueCoverageStatus, { bg: string; border: string; text: string; label: string; dot: string }> = {
  detected: { bg: '#30d18a18', border: '#30d18a40', text: '#30d18a', dot: '#30d18a', label: 'Detected' },
  testing: { bg: '#9c8bfb18', border: '#9c8bfb40', text: '#9c8bfb', dot: '#9c8bfb', label: 'Testing' },
  tested_passed: { bg: '#4f8cff18', border: '#4f8cff40', text: '#4f8cff', dot: '#4f8cff', label: 'Tested · Passed' },
  tested_failed: { bg: '#fb4a6318', border: '#fb4a6340', text: '#fb4a63', dot: '#fb4a63', label: 'Tested · Failed' },
  not_tested: { bg: 'var(--color-surface-2)', border: 'var(--color-border)', text: 'var(--color-text-muted)', dot: 'var(--color-text-muted)', label: 'Not Tested' },
}

export function techniqueCoverageStyle(status: TechniqueCoverageStatus) {
  return techCoverageConfig[status]
}

export function TechniqueStatusPill({ status }: { status: TechniqueCoverageStatus }) {
  const c = techCoverageConfig[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider"
      style={{ background: c.bg, color: c.text }}
    >
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c.dot }} />
      {c.label}
    </span>
  )
}

// ── Stat Card ───────────────────────────────────────────────────────────────
interface StatCardProps {
  icon: React.ReactNode
  label: string
  value: string | number
  trend?: { direction: 'up' | 'down'; label: string; positive?: boolean }
  accent?: string
  glow?: boolean
}

export function StatCard({ icon, label, value, trend, accent = '#4f8cff', glow }: StatCardProps) {
  return (
    <div
      className="relative bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 overflow-hidden group hover:border-[var(--color-border-bright)] transition-colors"
      style={glow ? { boxShadow: `0 0 0 1px ${accent}30, 0 4px 24px ${accent}10` } : undefined}
    >
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}60, transparent)` }} />
      <div className="flex items-start justify-between mb-3">
        <div className="text-[var(--color-text-secondary)] text-xs uppercase tracking-widest font-semibold">{label}</div>
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 [&_svg]:w-[18px] [&_svg]:h-[18px]"
          style={{ background: `${accent}18`, color: accent }}
        >
          {icon}
        </div>
      </div>
      <div className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight font-mono">{value}</div>
      {trend && (
        <div className={`mt-2 flex items-center gap-1 text-xs font-mono ${trend.positive ? 'text-[#30d18a]' : 'text-[#fb4a63]'}`}>
          <span>{trend.direction === 'up' ? '↑' : '↓'}</span>
          <span>{trend.label}</span>
        </div>
      )}
    </div>
  )
}

// ── Empty State ─────────────────────────────────────────────────────────────
export function EmptyState({ message = 'No alerts detected', sub = 'Systems operating within normal parameters.' }: { message?: string; sub?: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 gap-3">
      <div className="w-12 h-12 rounded-full bg-[#30d18a15] border border-[#30d18a30] flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 2L12.5 7H18L14 11L16 17L10 13.5L4 17L6 11L2 7H7.5L10 2Z" stroke="#30d18a" strokeWidth="1.5" strokeLinejoin="round" />
        </svg>
      </div>
      <div className="text-[var(--color-text-primary)] font-semibold text-sm">{message}</div>
      <div className="text-[var(--color-info)] text-xs font-mono">{sub}</div>
    </div>
  )
}

// ── Panel wrapper ───────────────────────────────────────────────────────────
export function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden ${className}`}>
      {children}
    </div>
  )
}

export function PanelHeader({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--color-border)]">
      <span className="text-xs font-semibold uppercase tracking-widest text-[var(--color-text-secondary)]">{title}</span>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

// ── Risk Score ──────────────────────────────────────────────────────────────
// The correlation engine's output. Playbooks trigger above 70, so the dial
// marks that threshold rather than an arbitrary midpoint.
export function riskColor(score: number) {
  return score >= 85 ? '#fb4a63' : score >= 70 ? '#ff9d4d' : score >= 40 ? '#f2c94c' : '#30d18a'
}

export function RiskScore({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const color = riskColor(score)
  const dim = size === 'lg' ? 56 : size === 'md' ? 40 : 30
  const stroke = size === 'lg' ? 4 : 3
  const r = (dim - stroke) / 2
  const circ = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: dim, height: dim }}>
      <svg width={dim} height={dim} className="-rotate-90">
        <circle cx={dim / 2} cy={dim / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth={stroke} />
        <circle
          cx={dim / 2} cy={dim / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={`${(score / 100) * circ} ${circ}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-mono font-bold leading-none"
          style={{ color, fontSize: size === 'lg' ? 16 : size === 'md' ? 13 : 10 }}
        >
          {score}
        </span>
        {size === 'lg' && <span className="text-[8px] text-[var(--color-text-muted)] mt-0.5">risk</span>}
      </div>
    </div>
  )
}

/** Compact inline version for dense table rows. */
export function RiskBadge({ score }: { score: number }) {
  const color = riskColor(score)
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="font-mono font-semibold text-xs" style={{ color }}>{score}</span>
      <span className="w-8 h-1 rounded-full bg-[var(--color-border)] overflow-hidden inline-block">
        <span className="block h-full rounded-full" style={{ width: `${score}%`, background: color }} />
      </span>
    </span>
  )
}

// ── AI explanation ──────────────────────────────────────────────────────────
export function AiExplanation({
  text, confidence, collapsed, onToggle,
}: {
  text: string
  confidence: number
  collapsed?: boolean
  onToggle?: () => void
}) {
  const short = text.length > 180 && collapsed
  return (
    <div className="rounded-lg border border-[#9c8bfb30] bg-[#9c8bfb08] p-3.5">
      <div className="flex items-center gap-2 mb-2">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M6.5 1l1.3 3.2L11 5.5 7.8 6.8 6.5 10 5.2 6.8 2 5.5l3.2-1.3L6.5 1z" stroke="#9c8bfb" strokeWidth="1" strokeLinejoin="round" />
        </svg>
        <span className="text-[11px] font-semibold text-[#9c8bfb]">Why this was flagged</span>
        <span className="ml-auto text-[10px] font-mono text-[var(--color-info)]">{confidence}% confidence</span>
      </div>
      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
        {short ? `${text.slice(0, 180).trimEnd()}…` : text}
      </p>
      {text.length > 180 && onToggle && (
        <button onClick={onToggle} className="mt-2 text-[11px] text-[#9c8bfb] hover:underline">
          {collapsed ? 'Read the full reasoning' : 'Show less'}
        </button>
      )}
      <div className="mt-2.5 pt-2.5 border-t border-[#9c8bfb20] text-[10px] text-[var(--color-text-muted)]">
        Generated summary of the correlated signals. Verify against the raw log before acting.
      </div>
    </div>
  )
}

// ── Approval state ──────────────────────────────────────────────────────────
export function ApprovalPill({ status }: { status: import('../data').ApprovalStatus }) {
  if (status === 'None') return <span className="text-[10px] text-[var(--color-text-muted)]">automatic</span>
  const cfg = {
    Pending: { c: '#ff9d4d', label: 'Awaiting approval' },
    Approved: { c: '#30d18a', label: 'Approved' },
    Rejected: { c: 'var(--color-info)', label: 'Rejected' },
  }[status]
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold"
      style={{ background: `${cfg.c}15`, color: cfg.c }}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current" />
      {cfg.label}
    </span>
  )
}

// ── Enrichment source row ───────────────────────────────────────────────────
export function SourceRow({ source }: { source: import('../data').EnrichmentSource }) {
  const cfg = {
    hit: { c: '#fb4a63', label: 'match' },
    clean: { c: '#30d18a', label: 'clean' },
    pending: { c: 'var(--color-info)', label: 'queued' },
    skipped: { c: 'var(--color-text-muted)', label: 'skipped' },
  }[source.status]
  return (
    <div className="flex items-center gap-3 py-2 border-b border-[var(--color-border)] last:border-0">
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cfg.c }} />
      <span className="text-xs text-[var(--color-text-primary)] w-20 shrink-0">{source.name}</span>
      <span className="text-[11px] text-[var(--color-text-secondary)] flex-1 min-w-0 truncate">{source.detail}</span>
      <span className="text-[10px] font-mono shrink-0" style={{ color: cfg.c }}>{cfg.label}</span>
      <span className="text-[10px] font-mono text-[var(--color-text-muted)] w-14 text-right shrink-0">{source.at}</span>
    </div>
  )
}

// ── KPI tile — shared by the ATT&CK Center and Simulation Center headers ────
export function KpiTile({
  icon, value, label, sublabel, accent = '#4f8cff',
}: {
  icon: React.ReactNode
  value: React.ReactNode
  label: string
  sublabel?: string
  accent?: string
}) {
  return (
    <div className="relative bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-4 py-3.5 overflow-hidden group hover:border-[var(--color-border-bright)] transition-colors">
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}70, transparent)` }} />
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 [&_svg]:w-[15px] [&_svg]:h-[15px]"
          style={{ background: `${accent}18`, color: accent }}
        >
          {icon}
        </div>
        <div className="min-w-0">
          <div className="text-xl font-bold font-mono leading-tight text-[var(--color-text-primary)]" style={{ color: accent }}>{value}</div>
          <div className="text-[10px] uppercase tracking-widest text-[var(--color-info)] font-semibold truncate">{label}</div>
        </div>
      </div>
      {sublabel && <div className="text-[10px] text-[var(--color-text-muted)] mt-1.5 truncate">{sublabel}</div>}
    </div>
  )
}

// ── Section label — small heading used inside detail drawers/panels ─────────
export function SectionLabel({ icon, title, count }: { icon?: React.ReactNode; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-2.5">
      {icon && <span className="text-[var(--color-text-muted)] [&_svg]:w-[13px] [&_svg]:h-[13px]">{icon}</span>}
      <span className="text-[10px] uppercase tracking-widest text-[var(--color-info)] font-semibold">{title}</span>
      {count !== undefined && (
        <span className="text-[10px] font-mono text-[var(--color-text-muted)] bg-[var(--color-surface-2)] border border-[var(--color-border)] rounded-full px-1.5">{count}</span>
      )}
    </div>
  )
}

// ── Small tag chip — hosts, rule ids, technique refs ─────────────────────────
export function Chip({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono border"
      style={{
        color: color ?? 'var(--color-text-secondary)',
        borderColor: color ? `${color}40` : 'var(--color-border)',
        background: color ? `${color}12` : 'var(--color-surface-2)',
      }}
    >
      {children}
    </span>
  )
}
