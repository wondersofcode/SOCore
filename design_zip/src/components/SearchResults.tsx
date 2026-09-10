import { useStore } from '../store'
import { cases, simulations } from '../data'
import { SeverityBadge, RiskBadge, AlertStatusPill, CaseStatusPill, SimStatusPill } from './Shared'

export default function SearchResults({
  query, onSelectAlert, onClear,
}: {
  query: string
  onSelectAlert: (id: string) => void
  onClear: () => void
}) {
  const { alerts } = useStore()

  const matchedAlerts = alerts.filter(a =>
    [a.id, a.sourceIP, a.attackType, a.mitreId, a.mitreName, a.country, a.asn, a.analyst]
      .join(' ').toLowerCase().includes(query),
  )
  const matchedCases = cases.filter(c =>
    [c.id, c.title, c.assignedTo, ...c.tags].join(' ').toLowerCase().includes(query),
  )
  const matchedSims = simulations.filter(s =>
    [s.id, s.name, s.mitreId, s.killChain].join(' ').toLowerCase().includes(query),
  )

  const total = matchedAlerts.length + matchedCases.length + matchedSims.length

  if (total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-2">
        <div className="text-sm text-[var(--color-text-primary)]">Nothing matches “{query}”</div>
        <div className="text-xs text-[var(--color-info)]">Try an IP address, an alert ID, or a technique like T1110.</div>
        <button onClick={onClear} className="mt-1 text-xs text-[#00d4ff] hover:underline">Clear the search</button>
      </div>
    )
  }

  return (
    <div className="space-y-4 max-w-5xl">
      <div className="flex items-center gap-3 text-xs">
        <span className="text-[var(--color-text-secondary)]">
          {total} result{total > 1 ? 's' : ''} for <span className="font-mono text-[var(--color-text-primary)]">{query}</span>
        </span>
        <button onClick={onClear} className="text-[#00d4ff] hover:underline">Clear</button>
      </div>

      {matchedAlerts.length > 0 && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-primary)]">
            Alerts <span className="text-[var(--color-text-muted)] font-normal">({matchedAlerts.length})</span>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {matchedAlerts.slice(0, 12).map(a => (
              <button
                key={a.id}
                onClick={() => onSelectAlert(a.id)}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[var(--color-surface-2)] transition-colors text-left"
              >
                <RiskBadge score={a.riskScore} />
                <SeverityBadge severity={a.severity} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[var(--color-text-primary)] truncate">{a.attackType}</div>
                  <div className="text-[10px] font-mono text-[var(--color-text-muted)] truncate">
                    {a.id} · {a.sourceIP} · {a.mitreId}
                  </div>
                </div>
                <AlertStatusPill status={a.status} />
              </button>
            ))}
          </div>
        </div>
      )}

      {matchedCases.length > 0 && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-primary)]">
            Cases <span className="text-[var(--color-text-muted)] font-normal">({matchedCases.length})</span>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {matchedCases.map(c => (
              <div key={c.id} className="flex items-center gap-3 px-4 py-2.5">
                <SeverityBadge severity={c.severity} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[var(--color-text-primary)] truncate">{c.title}</div>
                  <div className="text-[10px] font-mono text-[var(--color-text-muted)]">{c.id} · {c.assignedTo}</div>
                </div>
                <CaseStatusPill status={c.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {matchedSims.length > 0 && (
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
          <div className="px-4 py-2.5 border-b border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-primary)]">
            Simulations <span className="text-[var(--color-text-muted)] font-normal">({matchedSims.length})</span>
          </div>
          <div className="divide-y divide-[var(--color-border)]">
            {matchedSims.map(s => (
              <div key={s.id} className="flex items-center gap-3 px-4 py-2.5">
                <div className="flex-1 min-w-0">
                  <div className="text-xs text-[var(--color-text-primary)] truncate">{s.name}</div>
                  <div className="text-[10px] font-mono text-[var(--color-text-muted)]">{s.mitreId} · {s.killChain}</div>
                </div>
                <SimStatusPill status={s.status} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
