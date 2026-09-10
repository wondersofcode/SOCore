import type { Severity, AlertStatus, CaseStatus, SimStatus } from '../data'

// ── Severity Badge ──────────────────────────────────────────────────────────
const severityConfig: Record<Severity, { bg: string; text: string; border: string }> = {
  Critical: { bg: 'bg-[#ef444420]', text: 'text-[#ef4444]', border: 'border-[#ef444440]' },
  High: { bg: 'bg-[#f9731620]', text: 'text-[#f97316]', border: 'border-[#f9731640]' },
  Medium: { bg: 'bg-[#eab30820]', text: 'text-[#eab308]', border: 'border-[#eab30840]' },
  Low: { bg: 'bg-[#3b82f620]', text: 'text-[#3b82f6]', border: 'border-[#3b82f640]' },
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
    Critical: 'bg-[#ef4444]',
    High: 'bg-[#f97316]',
    Medium: 'bg-[#eab308]',
    Low: 'bg-[#3b82f6]',
    Informational: 'bg-[var(--color-info)]',
  }
  return <span className={`inline-block w-2 h-2 rounded-full ${colors[severity]} shrink-0`} />
}

// ── Status Pill ─────────────────────────────────────────────────────────────
const alertStatusConfig: Record<AlertStatus, { bg: string; text: string }> = {
  New: { bg: 'bg-[#00d4ff15]', text: 'text-[#00d4ff]' },
  Enriching: { bg: 'bg-[#a855f715]', text: 'text-[#a855f7]' },
  Responding: { bg: 'bg-[#f9731615]', text: 'text-[#f97316]' },
  Resolved: { bg: 'bg-[#22c55e15]', text: 'text-[#22c55e]' },
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
  Open: { bg: 'bg-[#00d4ff15]', text: 'text-[#00d4ff]' },
  Investigating: { bg: 'bg-[#f9731615]', text: 'text-[#f97316]' },
  Contained: { bg: 'bg-[#a855f715]', text: 'text-[#a855f7]' },
  Closed: { bg: 'bg-[#22c55e15]', text: 'text-[#22c55e]' },
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

const simStatusConfig: Record<SimStatus, { bg: string; text: string }> = {
  Planned: { bg: 'bg-[#6b728020]', text: 'text-[var(--color-info)]' },
  Scripted: { bg: 'bg-[#3b82f620]', text: 'text-[#3b82f6]' },
  Tested: { bg: 'bg-[#eab30820]', text: 'text-[#eab308]' },
  Detected: { bg: 'bg-[#22c55e20]', text: 'text-[#22c55e]' },
}

export function SimStatusPill({ status }: { status: SimStatus }) {
  const c = simStatusConfig[status]
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${c.bg} ${c.text}`}>
      {status}
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

export function StatCard({ icon, label, value, trend, accent = '#00d4ff', glow }: StatCardProps) {
  return (
    <div
      className="relative bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4 overflow-hidden group hover:border-[var(--color-border-bright)] transition-colors"
      style={glow ? { boxShadow: `0 0 0 1px ${accent}30, 0 4px 24px ${accent}10` } : undefined}
    >
      <div className="absolute inset-x-0 top-0 h-px" style={{ background: `linear-gradient(90deg, transparent, ${accent}60, transparent)` }} />
      <div className="flex items-start justify-between mb-3">
        <div className="text-[var(--color-text-secondary)] text-xs uppercase tracking-widest font-semibold">{label}</div>
        <div style={{ color: accent }} className="opacity-70">{icon}</div>
      </div>
      <div className="text-3xl font-bold text-[var(--color-text-primary)] tracking-tight font-mono">{value}</div>
      {trend && (
        <div className={`mt-2 flex items-center gap-1 text-xs font-mono ${trend.direction === 'up' ? (trend.positive ? 'text-[#22c55e]' : 'text-[#ef4444]') : (trend.positive ? 'text-[#ef4444]' : 'text-[#22c55e]')}`}>
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
      <div className="w-12 h-12 rounded-full bg-[#22c55e15] border border-[#22c55e30] flex items-center justify-center">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M10 2L12.5 7H18L14 11L16 17L10 13.5L4 17L6 11L2 7H7.5L10 2Z" stroke="#22c55e" strokeWidth="1.5" strokeLinejoin="round" />
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
  return score >= 85 ? '#ef4444' : score >= 70 ? '#f97316' : score >= 40 ? '#eab308' : '#22c55e'
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
    <div className="rounded-lg border border-[#a855f730] bg-[#a855f708] p-3.5">
      <div className="flex items-center gap-2 mb-2">
        <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
          <path d="M6.5 1l1.3 3.2L11 5.5 7.8 6.8 6.5 10 5.2 6.8 2 5.5l3.2-1.3L6.5 1z" stroke="#a855f7" strokeWidth="1" strokeLinejoin="round" />
        </svg>
        <span className="text-[11px] font-semibold text-[#a855f7]">Why this was flagged</span>
        <span className="ml-auto text-[10px] font-mono text-[var(--color-info)]">{confidence}% confidence</span>
      </div>
      <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed">
        {short ? `${text.slice(0, 180).trimEnd()}…` : text}
      </p>
      {text.length > 180 && onToggle && (
        <button onClick={onToggle} className="mt-2 text-[11px] text-[#a855f7] hover:underline">
          {collapsed ? 'Read the full reasoning' : 'Show less'}
        </button>
      )}
      <div className="mt-2.5 pt-2.5 border-t border-[#a855f720] text-[10px] text-[var(--color-text-muted)]">
        Generated summary of the correlated signals. Verify against the raw log before acting.
      </div>
    </div>
  )
}

// ── Approval state ──────────────────────────────────────────────────────────
export function ApprovalPill({ status }: { status: import('../data').ApprovalStatus }) {
  if (status === 'None') return <span className="text-[10px] text-[var(--color-text-muted)]">automatic</span>
  const cfg = {
    Pending: { c: '#f97316', label: 'Awaiting approval' },
    Approved: { c: '#22c55e', label: 'Approved' },
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
    hit: { c: '#ef4444', label: 'match' },
    clean: { c: '#22c55e', label: 'clean' },
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
