import { useState } from 'react'
import { mitreMatrix } from '../data'
import { useAuth } from '../lib/AuthContext'
import { formatISODate } from '../lib/dateFormat'

type TechStatus = 'detected' | 'partial' | 'none' | 'missed'

const statusConfig: Record<TechStatus, { bg: string; border: string; label: string; dot: string }> = {
  detected: { bg: '#22c55e18', border: '#22c55e40', label: 'Detected', dot: '#22c55e' },
  partial: { bg: '#eab30818', border: '#eab30840', label: 'Partial', dot: '#eab308' },
  none: { bg: 'var(--color-surface-2)', border: 'var(--color-border)', label: 'Not Tested', dot: 'var(--color-text-muted)' },
  missed: { bg: '#ef444418', border: '#ef444440', label: 'Missed', dot: '#ef4444' },
}

interface TooltipState {
  id: string
  name: string
  status: TechStatus
  tactic: string
  x: number
  y: number
}

export default function MitreMatrix() {
  const { profile } = useAuth()
  const today = formatISODate(new Date().toISOString(), profile?.timezone)
  const [tooltip, setTooltip] = useState<TooltipState | null>(null)

  const counts = mitreMatrix.flatMap(t => t.techniques).reduce(
    (acc, t) => { acc[t.status as TechStatus] = (acc[t.status as TechStatus] || 0) + 1; return acc },
    {} as Record<TechStatus, number>
  )

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">MITRE ATT&CK® Coverage Matrix</h2>
          <p className="text-xs text-[var(--color-info)] mt-0.5 font-mono">Enterprise v14 · Last updated {today}</p>
        </div>
        <div className="flex items-center gap-4">
          {(Object.entries(statusConfig) as [TechStatus, typeof statusConfig[TechStatus]][]).map(([status, cfg]) => (
            <div key={status} className="flex items-center gap-1.5 text-[10px] font-mono text-[var(--color-text-secondary)]">
              <span className="w-2.5 h-2.5 rounded-sm inline-block" style={{ background: cfg.dot, opacity: 0.8 }} />
              <span>{cfg.label}</span>
              <span className="text-[var(--color-text-muted)]">({counts[status] || 0})</span>
            </div>
          ))}
        </div>
      </div>

      {/* Matrix */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
        {/* Tactic headers */}
        <div className="grid border-b border-[var(--color-border)]" style={{ gridTemplateColumns: `repeat(${mitreMatrix.length}, 1fr)` }}>
          {mitreMatrix.map(tactic => (
            <div key={tactic.id} className="px-3 py-3 border-r border-[var(--color-border)] last:border-r-0">
              <div className="text-[10px] font-semibold uppercase tracking-widest text-[#00d4ff] truncate">{tactic.tactic}</div>
              <div className="text-[9px] font-mono text-[var(--color-text-muted)] mt-0.5">{tactic.id}</div>
            </div>
          ))}
        </div>

        {/* Technique cells */}
        <div className="grid" style={{ gridTemplateColumns: `repeat(${mitreMatrix.length}, 1fr)` }}>
          {mitreMatrix.map(tactic => (
            <div key={tactic.id} className="border-r border-[var(--color-border)] last:border-r-0">
              {tactic.techniques.map((tech) => {
                const cfg = statusConfig[tech.status as TechStatus]
                return (
                  <div
                    key={tech.id}
                    className="px-2 py-2 border-b border-[var(--color-border)] last:border-b-0 cursor-pointer transition-all hover:brightness-125 hover:z-10 relative"
                    style={{ background: cfg.bg, borderLeft: `2px solid ${cfg.border}` }}
                    onMouseEnter={e => {
                      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
                      setTooltip({ id: tech.id, name: tech.name, status: tech.status as TechStatus, tactic: tactic.tactic, x: rect.right + 8, y: rect.top })
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  >
                    <div className="text-[9px] font-mono font-semibold" style={{ color: cfg.dot }}>{tech.id}</div>
                    <div className="text-[9px] text-[var(--color-text-secondary)] leading-tight mt-0.5 truncate">{tech.name}</div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Coverage summary bar */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] uppercase tracking-widest text-[var(--color-info)] font-semibold">Overall Coverage</span>
          <span className="text-xs font-mono text-[var(--color-text-primary)]">
            {Math.round(((counts.detected || 0) / Object.values(counts).reduce((a, b) => a + b, 0)) * 100)}% Detected
          </span>
        </div>
        <div className="h-2 bg-[var(--color-surface-2)] rounded-full overflow-hidden flex gap-px">
          {(['detected', 'partial', 'missed', 'none'] as TechStatus[]).map(s => {
            const pct = ((counts[s] || 0) / Object.values(counts).reduce((a, b) => a + b, 0)) * 100
            return <div key={s} className="h-full rounded-sm" style={{ width: `${pct}%`, background: statusConfig[s].dot, opacity: 0.8 }} />
          })}
        </div>
        <div className="flex items-center gap-4 mt-2">
          {(['detected', 'partial', 'missed', 'none'] as TechStatus[]).map(s => (
            <div key={s} className="text-[10px] font-mono text-[var(--color-text-muted)]">
              <span style={{ color: statusConfig[s].dot }}>{counts[s] || 0}</span> {statusConfig[s].label}
            </div>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip && (
        <div
          className="fixed z-50 bg-[var(--color-surface-2)] border border-[var(--color-border-bright)] rounded-lg px-4 py-3 shadow-2xl pointer-events-none"
          style={{ left: Math.min(tooltip.x, window.innerWidth - 220), top: tooltip.y }}
        >
          <div className="text-[10px] text-[var(--color-info)] mb-1 uppercase tracking-widest">{tooltip.tactic}</div>
          <div className="font-mono text-[#a855f7] text-xs font-semibold">{tooltip.id}</div>
          <div className="text-[var(--color-text-primary)] text-xs mt-1">{tooltip.name}</div>
          <div className="flex items-center gap-1.5 mt-2">
            <span className="w-2 h-2 rounded-full" style={{ background: statusConfig[tooltip.status].dot }} />
            <span className="text-[10px] font-mono" style={{ color: statusConfig[tooltip.status].dot }}>
              {statusConfig[tooltip.status].label}
            </span>
          </div>
          <div className="text-[10px] font-mono text-[var(--color-text-muted)] mt-1">Last test: {today}</div>
        </div>
      )}
    </div>
  )
}
