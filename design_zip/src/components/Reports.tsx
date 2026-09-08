import { useStore } from '../store'
import { simulations, type Alert } from '../data'
import { riskColor } from './Shared'

// Backend timestamps are "YYYY-MM-DD HH:MM:SS" (no 'T'); Date needs one to parse reliably.
function parseTimestamp(timestamp: string): Date {
  return new Date(timestamp.includes('T') ? timestamp : timestamp.replace(' ', 'T'))
}

// Spans the earliest-to-latest alert in the current set, rather than a fixed
// mock window — "this shift" is whatever range the loaded alerts cover.
function formatShiftWindow(alerts: Alert[]): string {
  const times = alerts
    .map(a => parseTimestamp(a.timestamp))
    .filter(d => !Number.isNaN(d.getTime()))
  if (times.length === 0) return 'No alerts this shift'

  const earliest = new Date(Math.min(...times.map(d => d.getTime())))
  const latest = new Date(Math.max(...times.map(d => d.getTime())))
  const dateLabel = latest.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  const fmtTime = (d: Date) =>
    d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'UTC' })

  return `${dateLabel} · ${fmtTime(earliest)}–${fmtTime(latest)} UTC`
}

function Metric({ label, value, note, color = '#e6edf3' }: { label: string; value: string; note: string; color?: string }) {
  return (
    <div className="bg-[#161b22] border border-[#21262d] rounded-lg px-4 py-3.5">
      <div className="text-[11px] text-[#6b7280]">{label}</div>
      <div className="text-2xl font-mono font-bold leading-tight mt-0.5" style={{ color }}>{value}</div>
      <div className="text-[11px] text-[#484f58] mt-0.5">{note}</div>
    </div>
  )
}

export default function Reports() {
  const { alerts, decisions } = useStore()

  const total = alerts.length
  const resolved = alerts.filter(a => a.status === 'Resolved').length
  const critical = alerts.filter(a => a.severity === 'Critical').length
  const external = alerts.filter(a => a.country !== 'INTERNAL').length
  const avgRisk = Math.round(alerts.reduce((s, a) => s + a.riskScore, 0) / total)
  const autoHandled = alerts.filter(a => a.approvalStatus === 'None').length
  const humanReviewed = total - autoHandled
  const detectedSims = simulations.filter(s => s.status === 'Detected').length

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
      {/* Shift summary in plain language */}
      <div className="bg-[#161b22] border border-[#21262d] rounded-lg px-5 py-4">
        <div className="flex items-baseline justify-between mb-2">
          <span className="text-sm text-[#e6edf3]">Shift summary</span>
          <span className="text-[10px] font-mono text-[#484f58]">{formatShiftWindow(alerts)}</span>
        </div>
        <p className="text-xs text-[#8b949e] leading-relaxed max-w-3xl">
          {total} alerts were raised this shift, {external} of them from outside the network.
          {' '}{critical} reached critical severity, and the average risk score across all alerts was {avgRisk}.
          {' '}{autoHandled} were handled without human involvement; {humanReviewed} crossed the approval
          threshold and needed an analyst decision. {resolved} alerts are now closed.
        </p>
        <button className="mt-3 text-[11px] px-3 py-1.5 rounded-lg border border-[#21262d] text-[#8b949e] hover:text-[#00d4ff] hover:border-[#00d4ff40] transition-colors">
          Export as PDF
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Metric label="Alerts this shift" value={String(total)} note={`${external} external`} />
        <Metric label="Average risk" value={String(avgRisk)} note="across all alerts" color={riskColor(avgRisk)} />
        <Metric label="Decisions logged" value={String(decisions.length)} note="this session" color="#f97316" />
        <Metric label="Simulations detected" value={`${detectedSims}/${simulations.length}`} note="detection coverage" color="#22c55e" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Risk contribution by attack type */}
        <div className="bg-[#161b22] border border-[#21262d] rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-[#21262d] text-xs font-semibold text-[#e6edf3]">
            Attack types by peak risk
          </div>
          <div className="px-5 py-4 space-y-3">
            {byType.map(t => (
              <div key={t.type}>
                <div className="flex items-baseline justify-between text-xs mb-1">
                  <span className="text-[#e6edf3]">{t.type}</span>
                  <span className="font-mono text-[#6b7280]">
                    {t.count} alert{t.count > 1 ? 's' : ''} · peak {t.risk}
                  </span>
                </div>
                <div className="h-1.5 rounded-full bg-[#21262d] overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${t.risk}%`, background: riskColor(t.risk) }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Highest risk alerts */}
        <div className="bg-[#161b22] border border-[#21262d] rounded-lg overflow-hidden">
          <div className="px-5 py-3 border-b border-[#21262d] text-xs font-semibold text-[#e6edf3]">
            Highest risk this shift
          </div>
          <div className="divide-y divide-[#21262d]">
            {topRisk.map(a => (
              <div key={a.id} className="flex items-center gap-3 px-5 py-2.5">
                <span className="font-mono font-bold text-sm w-8 shrink-0" style={{ color: riskColor(a.riskScore) }}>
                  {a.riskScore}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[#e6edf3] truncate">{a.attackType}</div>
                  <div className="text-[10px] font-mono text-[#484f58] truncate">{a.sourceIP} · {a.mitreId}</div>
                </div>
                <span className="text-[10px] font-mono text-[#484f58] shrink-0">{a.timestamp.slice(11, 16)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
