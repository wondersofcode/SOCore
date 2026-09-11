import { useEffect, useRef, useState } from 'react'
import { useStore } from '../store'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { api } from '../api'
import type { ConnectionStatus } from '../api'
import type { UserRole } from '../data'
import { POPULAR_TIMEZONES } from '../lib/dateFormat'

const ROLE_LABEL: Record<UserRole, string> = {
  l1_analyst: 'L1 Analyst',
  l2_analyst: 'L2 Analyst',
  admin: 'Admin',
}

function ProfileCard() {
  const { user, profile, refreshProfile } = useAuth()
  const fileInput = useRef<HTMLInputElement>(null)
  const [firstName, setFirstName] = useState(profile?.firstName ?? '')
  const [lastName, setLastName] = useState(profile?.lastName ?? '')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')

  const initials = (profile?.firstName?.[0] ?? user?.email?.[0] ?? '?').toUpperCase()

  const saveName = async () => {
    setSaving(true)
    setSaved(false)
    setError('')
    try {
      await api.updateProfile({ firstName, lastName })
      await refreshProfile()
      setSaved(true)
    } catch {
      setError('Could not save — try again.')
    } finally {
      setSaving(false)
    }
  }

  const onAvatarPicked = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !user) return
    setUploading(true)
    setError('')
    try {
      const ext = file.name.split('.').pop() || 'png'
      const path = `${user.id}/avatar.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      // Cache-bust so the new picture shows immediately even though the path is unchanged.
      const avatarUrl = `${data.publicUrl}?t=${Date.now()}`
      await api.updateProfile({ avatarUrl })
      await refreshProfile()
    } catch {
      setError('Avatar upload failed — check the "avatars" bucket exists and is public.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-5 py-4">
      <div className="text-xs font-semibold text-[var(--color-text-primary)] mb-4">Profile</div>
      <div className="flex items-start gap-5">
        <div className="relative shrink-0">
          {profile?.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" className="w-16 h-16 rounded-full object-cover border border-[var(--color-border)]" />
          ) : (
            <div className="w-16 h-16 rounded-full bg-[#4f8cff20] border border-[#4f8cff40] flex items-center justify-center text-lg font-bold text-[#4f8cff] font-mono">
              {initials}
            </div>
          )}
          <button
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border-bright)] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[#4f8cff] transition-colors disabled:opacity-50"
            title="Change avatar"
          >
            <svg width="11" height="11" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 9.5V10.5H10V9.5M6 1.5V8M6 1.5L3.5 4M6 1.5L8.5 4" />
            </svg>
          </button>
          <input ref={fileInput} type="file" accept="image/*" className="hidden" onChange={onAvatarPicked} />
        </div>

        <div className="flex-1 min-w-0 space-y-2.5">
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-1">First name</label>
              <input
                value={firstName}
                onChange={e => { setFirstName(e.target.value); setSaved(false) }}
                className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[#4f8cff40]"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-1">Last name</label>
              <input
                value={lastName}
                onChange={e => { setLastName(e.target.value); setSaved(false) }}
                className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[#4f8cff40]"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={saveName}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg bg-[#4f8cff15] border border-[#4f8cff40] text-[#4f8cff] text-[11px] font-semibold hover:bg-[#4f8cff25] transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
            </button>
            {uploading && <span className="text-[11px] text-[var(--color-text-muted)]">Uploading avatar…</span>}
            {error && <span className="text-[11px] text-[#fb4a63]">{error}</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

function ThemeCard() {
  const { profile, refreshProfile } = useAuth()
  const [busy, setBusy] = useState(false)
  const [tzBusy, setTzBusy] = useState(false)
  const [tzError, setTzError] = useState(false)
  const theme = profile?.themePreference ?? 'dark'
  const timezone = profile?.timezone ?? 'Asia/Baku'

  const setTheme = async (next: 'dark' | 'light') => {
    if (next === theme || busy) return
    setBusy(true)
    document.documentElement.setAttribute('data-theme', next) // instant feedback
    try {
      await api.updateProfile({ themePreference: next })
      await refreshProfile()
    } catch {
      document.documentElement.setAttribute('data-theme', theme) // revert on failure
    } finally {
      setBusy(false)
    }
  }

  const setTimezone = async (next: string) => {
    if (next === timezone || tzBusy) return
    setTzBusy(true)
    setTzError(false)
    try {
      await api.updateProfile({ timezone: next })
      await refreshProfile()
    } catch {
      setTzError(true)
    } finally {
      setTzBusy(false)
    }
  }

  return (
    <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-5 py-4">
      <div className="text-xs font-semibold text-[var(--color-text-primary)] mb-1">Appearance</div>
      <div className="text-[11px] text-[var(--color-info)] mb-3">Saved to your account — follows you across devices</div>
      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex rounded-lg border border-[var(--color-border)] p-0.5 bg-[var(--color-background)]">
          {(['dark', 'light'] as const).map(opt => (
            <button
              key={opt}
              onClick={() => setTheme(opt)}
              disabled={busy}
              className="px-3.5 py-1.5 rounded-md text-[11px] font-semibold capitalize transition-colors disabled:opacity-60"
              style={theme === opt
                ? { background: '#4f8cff20', color: '#4f8cff' }
                : { color: 'var(--color-text-secondary)' }}
            >
              {opt}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-1">
          <select
            value={timezone}
            onChange={e => setTimezone(e.target.value)}
            disabled={tzBusy}
            className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-text-primary)] focus:outline-none focus:border-[#4f8cff40] disabled:opacity-60"
          >
            {POPULAR_TIMEZONES.map(tz => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
          {tzError && <span className="text-[10px] text-[#fb4a63]">Could not save — try again.</span>}
        </div>
      </div>
    </div>
  )
}

interface Integration {
  key: string
  name: string
  role: string
  stage: 'Detect' | 'Enrich' | 'Respond' | 'Track'
  detail: string
  endpoint: string
}

// Mirrors the real SOCore stack. `connected`/`url` come from GET /api/health's
// `connections` field (real TCP reachability checks against the VM), not a
// hardcoded guess — see backend/app/integrations_health.py.
const integrations: Integration[] = [
  { key: 'wazuh', name: 'Wazuh', role: 'SIEM and endpoint agents', stage: 'Detect', detail: 'Manager + dashboard on the VM, agents enrolled on port 1515', endpoint: '35.238.92.96:5601' },
  { key: 'misp', name: 'MISP', role: 'Threat intelligence database', stage: 'Enrich', detail: 'Feodo Tracker, URLhaus and Spamhaus DROP feeds', endpoint: '35.238.92.96:8443' },
  { key: 'cortex', name: 'Cortex', role: 'Analyzer engine', stage: 'Enrich', detail: 'VirusTotal and AbuseIPDB analyzers enabled', endpoint: '35.238.92.96:9001' },
  { key: 'caseManagement', name: 'Case Management', role: 'Built-in case tracking', stage: 'Track', detail: 'In-house — replaces TheHive (commercial license required)', endpoint: 'backend/api/cases' },
  { key: 'shuffle', name: 'Shuffle', role: 'Playbook automation', stage: 'Respond', detail: 'Firewall actions run in simulation mode', endpoint: '35.238.92.96:3001' },
  { key: 'slack', name: 'Slack', role: 'Analyst notifications', stage: 'Respond', detail: 'Posts alert/decision notifications to the configured channel', endpoint: 'hooks.slack.com/services/…' },
  { key: 'ai', name: 'AI explanation service', role: 'Alert reasoning + assistant', stage: 'Enrich', detail: 'Groq — summarises correlated signals, powers the AI assistant', endpoint: 'backend/api/assistant/chat' },
]

const stageColor: Record<Integration['stage'], string> = {
  Detect: '#4f8cff', Enrich: '#9c8bfb', Respond: '#ff9d4d', Track: '#30d18a',
}

function Row({ i, status, canOpenTool }: { i: Integration; status: ConnectionStatus | undefined; canOpenTool: boolean }) {
  const connected = status?.connected ?? false
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-[var(--color-border)] last:border-0">
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: connected ? '#30d18a' : 'var(--color-info)' }}
      />
      <div className="w-44 shrink-0">
        <div className="text-sm text-[var(--color-text-primary)]">{i.name}</div>
        <div className="text-[11px] text-[var(--color-info)]">{i.role}</div>
      </div>
      <span
        className="text-[10px] font-mono px-2 py-0.5 rounded shrink-0"
        style={{ background: `${stageColor[i.stage]}15`, color: stageColor[i.stage] }}
      >
        {i.stage}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-[var(--color-text-secondary)] truncate">{i.detail}</div>
        <div className="text-[10px] font-mono text-[var(--color-text-muted)] truncate">{i.endpoint}</div>
      </div>
      <span className="text-[11px] shrink-0" style={{ color: connected ? '#30d18a' : 'var(--color-info)' }}>
        {connected ? 'Connected' : 'Not reachable'}
      </span>
      {connected && status?.url && canOpenTool && (
        <a
          href={status.url}
          target="_blank"
          rel="noreferrer"
          className="text-[11px] font-semibold shrink-0 px-2.5 py-1 rounded-lg border border-[#4f8cff40] text-[#4f8cff] hover:bg-[#4f8cff15] transition-colors"
        >
          Open tool →
        </a>
      )}
    </div>
  )
}

export default function Settings() {
  const { currentUser } = useStore()
  const { role } = useAuth()
  const [connections, setConnections] = useState<Record<string, ConnectionStatus>>({})
  const canOpenTool = role === 'l2_analyst' || role === 'admin'

  useEffect(() => {
    api.health().then(h => setConnections(h.connections ?? {})).catch(() => {})
  }, [])

  const connectedCount = integrations.filter(i => connections[i.key]?.connected).length

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="grid grid-cols-2 gap-3">
        <ProfileCard />
        <ThemeCard />
      </div>

      <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg overflow-hidden">
        <div className="px-5 py-3 border-b border-[var(--color-border)] flex items-center justify-between">
          <span className="text-xs font-semibold text-[var(--color-text-primary)]">Pipeline connections</span>
          <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
            {connectedCount} of {integrations.length} connected
          </span>
        </div>
        {integrations.map(i => (
          <Row key={i.key} i={i} status={connections[i.key]} canOpenTool={canOpenTool} />
        ))}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-5 py-4">
          <div className="text-xs font-semibold text-[var(--color-text-primary)] mb-3">Response policy</div>
          <div className="space-y-3 text-xs">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[var(--color-text-primary)]">Approval threshold</div>
                <div className="text-[11px] text-[var(--color-info)]">Actions above this risk score wait for a human</div>
              </div>
              <span className="font-mono text-[#ff9d4d] shrink-0">70</span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[var(--color-text-primary)]">Firewall actions</div>
                <div className="text-[11px] text-[var(--color-info)]">Logged rather than executed while no firewall is attached</div>
              </div>
              <span className="font-mono text-[var(--color-text-secondary)] shrink-0">Simulated</span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-[var(--color-text-primary)]">Notifications</div>
                <div className="text-[11px] text-[var(--color-info)]">Sent without approval for every severity</div>
              </div>
              <span className="font-mono text-[#30d18a] shrink-0">Automatic</span>
            </div>
          </div>
        </div>

        <div className="bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg px-5 py-4">
          <div className="text-xs font-semibold text-[var(--color-text-primary)] mb-3">Session</div>
          <div className="space-y-3 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-secondary)]">Signed in as</span>
              <span className="text-[var(--color-text-primary)]">{currentUser}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-secondary)]">Role</span>
              <span className="text-[var(--color-text-primary)]">{role ? ROLE_LABEL[role] : '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-secondary)]">Can approve actions</span>
              <span className="text-[#30d18a]">Yes</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[var(--color-text-secondary)]">Log retention</span>
              <span className="text-[var(--color-text-primary)]">90 days</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
