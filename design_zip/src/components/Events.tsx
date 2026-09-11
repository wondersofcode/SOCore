import { useEffect, useState } from 'react'
import { api } from '../api'
import type { WazuhRawEvent } from '../data'
import { Panel, PanelHeader } from './Shared'
import { useAuth } from '../lib/AuthContext'
import { formatDateTime } from '../lib/dateFormat'

const PAGE_SIZE = 25

function prettyRaw(raw: string): string {
  if (!raw) return '(empty)'
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    return raw
  }
}

function levelColor(lvl: number): string {
  return lvl >= 12 ? '#fb4a63' : lvl >= 9 ? '#ff9d4d' : lvl >= 6 ? '#f2c94c' : 'var(--color-info)'
}

// One row, expanding inline into its raw JSON — matches the SOCore Command
// Center artifact's Events screen (no side drawer).
function EventRow({ event, open, onToggle, timezone }: { event: WazuhRawEvent; open: boolean; onToggle: () => void; timezone?: string }) {
  const color = levelColor(event.ruleLevel)
  return (
    <div className="border-b border-[var(--color-border)] last:border-0">
      <div
        onClick={onToggle}
        className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-[var(--color-surface-2)] transition-colors"
      >
        <svg
          width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
          className="shrink-0 text-[var(--color-text-muted)] transition-transform"
          style={{ transform: open ? 'rotate(90deg)' : 'none' }}
        >
          <path d="M5 3l4 4-4 4" />
        </svg>
        <span
          className="shrink-0 w-6 h-5 rounded flex items-center justify-center text-[10px] font-bold font-mono"
          style={{ background: `${color}30`, color }}
        >
          {event.ruleLevel}
        </span>
        <span className="flex-1 min-w-0 text-xs font-semibold text-[var(--color-text-primary)] truncate">
          {event.ruleDescription || 'Wazuh event'}
        </span>
        <span className="hidden md:flex items-center gap-3.5 shrink-0 text-[10.5px] font-mono text-[var(--color-text-muted)]">
          <span>{event.sourceIP}</span>
          <span>rule {event.ruleId || '—'}</span>
          <span>{event.agentName || '—'}</span>
          <span>{formatDateTime(event.timestamp, timezone)}</span>
        </span>
      </div>

      {open && (
        <div className="px-4 pb-4 pl-[42px]">
          <div className="flex flex-wrap gap-x-5 gap-y-1 mb-3 text-[10.5px] font-mono text-[var(--color-text-muted)] md:hidden">
            <span>{event.sourceIP}</span>
            <span>rule {event.ruleId || '—'}</span>
            <span>{event.agentName || '—'}</span>
            <span>{formatDateTime(event.timestamp, timezone)}</span>
          </div>
          <div className="flex flex-wrap gap-x-5 gap-y-1 mb-3 text-[10.5px] font-mono text-[var(--color-text-muted)]">
            <span>Event <span className="text-[var(--color-text-secondary)]">{event.id}</span></span>
            <span>Agent ID <span className="text-[var(--color-text-secondary)]">{event.agentId || '—'}</span></span>
            <span>
              Alert{' '}
              {event.alertId
                ? <span className="text-[#4f8cff]">{event.alertId}</span>
                : <span className="text-[var(--color-text-secondary)]">not converted</span>}
            </span>
          </div>
          <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg overflow-hidden">
            <div className="flex items-center gap-1.5 px-3 py-2 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
              <span className="w-2 h-2 rounded-full bg-[#fb4a63] opacity-60" />
              <span className="w-2 h-2 rounded-full bg-[#f2c94c] opacity-60" />
              <span className="w-2 h-2 rounded-full bg-[#30d18a] opacity-60" />
              <span className="text-[10px] font-mono text-[var(--color-text-muted)] ml-1.5">{event.id}.json</span>
            </div>
            <pre className="p-3 text-[10.8px] font-mono text-[var(--color-text-secondary)] overflow-x-auto leading-relaxed whitespace-pre-wrap max-h-[280px] overflow-y-auto">
              {prettyRaw(event.raw)}
            </pre>
          </div>
        </div>
      )}
    </div>
  )
}

export default function Events({
  preselectId,
  onConsumedPreselect,
}: {
  preselectId?: string | null
  onConsumedPreselect?: () => void
}) {
  const { profile } = useAuth()
  const timezone = profile?.timezone
  const [events, setEvents] = useState<WazuhRawEvent[]>([])
  const [page, setPage] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [openIds, setOpenIds] = useState<Set<string>>(new Set())

  const toggle = (id: string) => {
    setOpenIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const load = async (p: number) => {
    setLoading(true)
    setError(false)
    try {
      const rows = await api.events(PAGE_SIZE, p * PAGE_SIZE)
      setEvents(rows)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(page)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page])

  useEffect(() => {
    if (!preselectId) return
    api.event(preselectId)
      .then(ev => { setEvents(prev => (prev.some(e => e.id === ev.id) ? prev : [ev, ...prev])); setOpenIds(prev => new Set(prev).add(ev.id)) })
      .catch(() => {})
      .finally(() => onConsumedPreselect?.())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preselectId])

  return (
    <div className="space-y-4">
      <Panel>
        <PanelHeader title="Raw event history">
          <span className="text-[10px] font-mono text-[var(--color-text-muted)]">Every Wazuh event received, whether or not it became an alert</span>
        </PanelHeader>

        {loading && (
          <div className="px-5 py-10 text-center text-xs text-[var(--color-info)] font-mono">Loading events…</div>
        )}

        {!loading && error && (
          <div className="flex flex-col items-center justify-center py-14 gap-2">
            <div className="text-sm text-[var(--color-text-primary)]">Unable to load events</div>
            <div className="text-xs text-[var(--color-info)]">Something went wrong while retrieving the event history.</div>
            <button onClick={() => load(page)} className="mt-1 text-xs text-[#4f8cff] hover:underline">Retry</button>
          </div>
        )}

        {!loading && !error && events.length === 0 && (
          <div className="flex flex-col items-center justify-center py-14 gap-2">
            <div className="text-sm text-[var(--color-text-primary)]">No events on this page</div>
            <div className="text-xs text-[var(--color-info)]">Raw Wazuh events will appear here as they arrive.</div>
          </div>
        )}

        {!loading && !error && events.length > 0 && (
          <div>
            {events.map(ev => (
              <EventRow key={ev.id} event={ev} open={openIds.has(ev.id)} onToggle={() => toggle(ev.id)} timezone={timezone} />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between px-4 py-2.5 border-t border-[var(--color-border)] text-[10px] font-mono text-[var(--color-text-muted)]">
          <span>Page {page + 1}</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0 || loading}
              className="px-2.5 py-1 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-bright)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={events.length < PAGE_SIZE || loading}
              className="px-2.5 py-1 rounded border border-[var(--color-border)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-bright)] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </Panel>
    </div>
  )
}
