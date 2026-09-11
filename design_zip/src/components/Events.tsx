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

function EventDrawer({ event, onClose }: { event: WazuhRawEvent; onClose: () => void }) {
  const { profile } = useAuth()
  const timezone = profile?.timezone
  return (
    <div className="fixed inset-0 z-50 flex" onClick={onClose}>
      <div className="flex-1 bg-black/60 backdrop-blur-sm" />
      <div
        className="w-full max-w-2xl bg-[var(--color-background)] border-l border-[var(--color-border)] overflow-y-auto flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="sticky top-0 bg-[var(--color-background)] border-b border-[var(--color-border)] px-6 py-4 flex items-start justify-between z-10">
          <div className="flex flex-col gap-2">
            <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[var(--color-border)] text-[var(--color-text-secondary)] w-fit">
              {event.alertId ? 'Converted to alert' : 'Not converted to an alert'}
            </span>
            <div className="text-[var(--color-text-primary)] font-semibold text-lg leading-tight">
              {event.ruleDescription || 'Wazuh event'}
            </div>
            <div className="flex items-center gap-3 text-xs flex-wrap">
              <span className="font-mono text-[#9c8bfb]">rule {event.ruleId || '—'}</span>
              <span className="text-[var(--color-text-muted)]">·</span>
              <span className="font-mono text-[var(--color-text-secondary)]">level {event.ruleLevel}</span>
              <span className="text-[var(--color-text-muted)]">·</span>
              <span className="font-mono text-[var(--color-text-secondary)]">{formatDateTime(event.timestamp, timezone)}</span>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--color-info)] hover:text-[var(--color-text-primary)] transition-colors p-1">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4l10 10M14 4L4 14" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-xs">
              <div><div className="text-[var(--color-info)] mb-1 uppercase tracking-widest text-[10px]">Event ID</div><div className="font-mono text-[var(--color-text-primary)]">{event.id}</div></div>
              <div><div className="text-[var(--color-info)] mb-1 uppercase tracking-widest text-[10px]">Source IP</div><div className="font-mono text-[var(--color-text-primary)]">{event.sourceIP}</div></div>
              <div><div className="text-[var(--color-info)] mb-1 uppercase tracking-widest text-[10px]">Agent</div><div className="font-mono text-[var(--color-text-primary)]">{event.agentName || '—'} {event.agentId && <span className="text-[var(--color-text-muted)]">({event.agentId})</span>}</div></div>
              <div><div className="text-[var(--color-info)] mb-1 uppercase tracking-widest text-[10px]">Alert</div><div className="font-mono text-[var(--color-text-primary)]">{event.alertId || '—'}</div></div>
            </div>
          </div>

          <div>
            <div className="text-[10px] uppercase tracking-widest text-[var(--color-info)] font-semibold mb-3">Raw Event</div>
            <div className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-surface)] border-b border-[var(--color-border)]">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-[#fb4a63] opacity-60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#f2c94c] opacity-60" />
                  <div className="w-2.5 h-2.5 rounded-full bg-[#30d18a] opacity-60" />
                </div>
                <span className="text-[10px] font-mono text-[var(--color-text-muted)] ml-2">{event.id}.json</span>
              </div>
              <pre className="p-4 text-[11px] font-mono text-[var(--color-text-secondary)] overflow-x-auto leading-relaxed whitespace-pre-wrap">
                <code>{prettyRaw(event.raw)}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
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
  const [selected, setSelected] = useState<WazuhRawEvent | null>(null)

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
      .then(ev => setSelected(ev))
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
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)]">
                  {['Timestamp', 'Source IP', 'Rule', 'Agent', 'Alert'].map(h => (
                    <th key={h} className="px-4 py-2.5 text-left text-[10px] uppercase tracking-widest text-[var(--color-info)] font-semibold whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {events.map(ev => (
                  <tr
                    key={ev.id}
                    onClick={() => setSelected(ev)}
                    className="border-b border-[var(--color-border)] last:border-b-0 hover:bg-[var(--color-surface-2)] cursor-pointer group transition-colors"
                  >
                    <td className="px-4 py-2.5 font-mono text-[var(--color-text-secondary)] whitespace-nowrap">{formatDateTime(ev.timestamp, timezone)}</td>
                    <td className="px-4 py-2.5 font-mono text-[var(--color-text-primary)] whitespace-nowrap">{ev.sourceIP}</td>
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-[#9c8bfb]">{ev.ruleId || '—'}</span>
                      <div className="text-[10px] text-[var(--color-info)] truncate max-w-[280px]">{ev.ruleDescription}</div>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--color-text-secondary)] whitespace-nowrap">{ev.agentName || '—'}</td>
                    <td className="px-4 py-2.5 font-mono whitespace-nowrap">
                      {ev.alertId ? (
                        <span className="text-[#4f8cff] group-hover:underline">{ev.alertId}</span>
                      ) : (
                        <span className="text-[var(--color-text-muted)]">not converted</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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

      {selected && <EventDrawer event={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
