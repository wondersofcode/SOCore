import { useState } from 'react'
import { SimStatusPill } from './Shared'
import { simulations } from '../data'
import type { SimStatus } from '../data'

const killChainColors: Record<string, string> = {
  'Credential Access': '#fb4a63',
  'Command & Control': '#9c8bfb',
  'Persistence': '#ff9d4d',
  'Execution': '#f2c94c',
  'Lateral Movement': '#4f8cff',
  'Exfiltration': '#f43f5e',
}

export default function SimulationTracker() {
  const [runningId, setRunningId] = useState<string | null>(null)
  const [filter, setFilter] = useState<SimStatus | 'All'>('All')

  const filtered = filter === 'All' ? simulations : simulations.filter(s => s.status === filter)

  const handleRun = (id: string) => {
    setRunningId(id)
    setTimeout(() => setRunningId(null), 2000)
  }

  const counts = simulations.reduce((acc, s) => {
    acc[s.status] = (acc[s.status] || 0) + 1
    return acc
  }, {} as Record<SimStatus, number>)

  return (
    <div className="space-y-4">
      {/* Header banner */}
      <div className="relative bg-[var(--color-surface)] border border-[#9c8bfb40] rounded-lg p-4 overflow-hidden">
        <div className="absolute inset-0 opacity-5" style={{ background: 'linear-gradient(135deg, #9c8bfb 0%, #ec4899 100%)' }} />
        <div className="absolute inset-x-0 top-0 h-px" style={{ background: 'linear-gradient(90deg, transparent, #9c8bfb80, transparent)' }} />
        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-[#9c8bfb20] border border-[#9c8bfb40] flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 8L7 12L13 4" stroke="#9c8bfb" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                <circle cx="8" cy="8" r="7" stroke="#9c8bfb" strokeWidth="1" opacity="0.4" />
              </svg>
            </div>
            <div>
              <div className="text-sm font-semibold text-[var(--color-text-primary)]">Simulation Tracker</div>
              <div className="text-[10px] text-[#9c8bfb] font-mono mt-0.5">PURPLE TEAM · CONTROLLED ENVIRONMENT</div>
            </div>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <div className="text-center"><div className="text-[#30d18a] font-bold text-lg">{counts.Detected || 0}</div><div className="text-[var(--color-info)] text-[9px] uppercase tracking-widest">Detected</div></div>
            <div className="text-center"><div className="text-[#f2c94c] font-bold text-lg">{counts.Tested || 0}</div><div className="text-[var(--color-info)] text-[9px] uppercase tracking-widest">Tested</div></div>
            <div className="text-center"><div className="text-[#4f8cff] font-bold text-lg">{counts.Scripted || 0}</div><div className="text-[var(--color-info)] text-[9px] uppercase tracking-widest">Scripted</div></div>
            <div className="text-center"><div className="text-[var(--color-info)] font-bold text-lg">{counts.Planned || 0}</div><div className="text-[var(--color-info)] text-[9px] uppercase tracking-widest">Planned</div></div>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex items-center gap-2">
        {(['All', 'Planned', 'Scripted', 'Tested', 'Detected'] as const).map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded text-[10px] font-semibold uppercase tracking-widest transition-colors ${
              filter === s
                ? 'bg-[#9c8bfb20] border border-[#9c8bfb40] text-[#9c8bfb]'
                : 'text-[var(--color-info)] hover:text-[var(--color-text-secondary)] border border-transparent'
            }`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--color-border)]">
              {['ID', 'Simulation Name', 'ATT&CK ID', 'Kill Chain Phase', 'Status', 'Last Run', 'Time-to-Detect', ''].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10px] uppercase tracking-widest text-[var(--color-info)] font-semibold whitespace-nowrap">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map(sim => {
              const isRunning = runningId === sim.id
              return (
                <tr key={sim.id} className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-2)] transition-colors group">
                  <td className="px-4 py-3 font-mono text-[var(--color-text-muted)]">{sim.id}</td>
                  <td className="px-4 py-3 text-[var(--color-text-primary)] font-medium group-hover:text-[#9c8bfb] transition-colors">{sim.name}</td>
                  <td className="px-4 py-3 font-mono text-[#9c8bfb]">{sim.mitreId}</td>
                  <td className="px-4 py-3">
                    <span
                      className="inline-block px-2 py-0.5 rounded text-[10px] font-mono font-semibold"
                      style={{
                        color: killChainColors[sim.killChain] || 'var(--color-info)',
                        background: `${killChainColors[sim.killChain] || 'var(--color-info)'}15`,
                      }}
                    >
                      {sim.killChain}
                    </span>
                  </td>
                  <td className="px-4 py-3"><SimStatusPill status={sim.status} /></td>
                  <td className="px-4 py-3 font-mono text-[var(--color-info)] whitespace-nowrap">{sim.lastRun}</td>
                  <td className="px-4 py-3 font-mono">
                    <span className={sim.ttd === '—' ? 'text-[var(--color-text-muted)]' : 'text-[#4f8cff]'}>{sim.ttd}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleRun(sim.id)}
                      disabled={isRunning}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[10px] font-semibold uppercase tracking-wider transition-all whitespace-nowrap"
                      style={{
                        borderColor: isRunning ? '#9c8bfb80' : '#9c8bfb40',
                        background: isRunning ? '#9c8bfb20' : '#9c8bfb10',
                        color: isRunning ? '#9c8bfb' : 'var(--color-text-secondary)',
                      }}
                    >
                      {isRunning ? (
                        <>
                          <span className="w-2 h-2 rounded-full bg-[#9c8bfb] pulse-live" />
                          Running…
                        </>
                      ) : (
                        <>
                          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
                            <path d="M2 2l6 3-6 3V2z" />
                          </svg>
                          Run
                        </>
                      )}
                    </button>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
