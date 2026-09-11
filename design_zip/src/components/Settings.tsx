import { useRef, useState } from 'react'
import { useStore } from '../store'
import { useAuth } from '../lib/AuthContext'
import { supabase } from '../lib/supabase'
import { api } from '../api'
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
            <div className="w-16 h-16 rounded-full bg-[#00d4ff20] border border-[#00d4ff40] flex items-center justify-center text-lg font-bold text-[#00d4ff] font-mono">
              {initials}
            </div>
          )}
          <button
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[var(--color-surface-2)] border border-[var(--color-border-bright)] flex items-center justify-center text-[var(--color-text-secondary)] hover:text-[#00d4ff] transition-colors disabled:opacity-50"
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
                className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[#00d4ff40]"
              />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-[var(--color-text-muted)] mb-1">Last name</label>
              <input
                value={lastName}
                onChange={e => { setLastName(e.target.value); setSaved(false) }}
                className="w-full bg-[var(--color-background)] border border-[var(--color-border)] rounded px-2.5 py-1.5 text-xs text-[var(--color-text-primary)] focus:outline-none focus:border-[#00d4ff40]"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={saveName}
              disabled={saving}
              className="px-3 py-1.5 rounded-lg bg-[#00d4ff15] border border-[#00d4ff40] text-[#00d4ff] text-[11px] font-semibold hover:bg-[#00d4ff25] transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving…' : saved ? 'Saved ✓' : 'Save changes'}
            </button>
            {uploading && <span className="text-[11px] text-[var(--color-text-muted)]">Uploading avatar…</span>}
            {error && <span className="text-[11px] text-[#ef4444]">{error}</span>}
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
                ? { background: '#00d4ff20', color: '#00d4ff' }
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
            className="bg-[var(--color-background)] border border-[var(--color-border)] rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-[var(--color-text-primary)] focus:outline-none focus:border-[#00d4ff40] disabled:opacity-60"
          >
            {POPULAR_TIMEZONES.map(tz => (
              <option key={tz.value} value={tz.value}>{tz.label}</option>
            ))}
          </select>
          {tzError && <span className="text-[10px] text-[#ef4444]">Could not save — try again.</span>}
        </div>
      </div>
    </div>
  )
}

interface Integration {
  name: string
  role: string
  stage: 'Detect' | 'Enrich' | 'Respond' | 'Track'
  connected: boolean
  detail: string
  endpoint: string
}

// Mirrors the real SOCore stack. Endpoints point at the VM (35.238.92.96) where each service is deployed.
const integrations: Integration[] = [
  { name: 'Wazuh', role: 'SIEM and endpoint agents', stage: 'Detect', connected: false, detail: 'Not yet integrated — Şəxs 1-dən inteqrasiya gözlənilir', endpoint: 'wazuh.socore.local:55000' },
  { name: 'MISP', role: 'Threat intelligence database', stage: 'Enrich', connected: true, detail: 'Feodo Tracker, URLhaus and Spamhaus DROP synced 4h ago', endpoint: '35.238.92.96:8443' },
  { name: 'Cortex', role: 'Analyzer engine', stage: 'Enrich', connected: true, detail: 'VirusTotal and AbuseIPDB analyzers enabled', endpoint: '35.238.92.96:9001' },
  { name: 'Case Management', role: 'Built-in case tracking', stage: 'Track', connected: true, detail: 'In-house — replaces TheHive (commercial license required)', endpoint: 'backend/api/cases' },
  { name: 'Shuffle', role: 'Playbook automation', stage: 'Respond', connected: true, detail: '4 playbooks, firewall actions run in simulation mode', endpoint: '35.238.92.96:3001' },
  { name: 'Slack', role: 'Analyst notifications', stage: 'Respond', connected: true, detail: 'Posting to #socore-alerts', endpoint: 'hooks.slack.com/services/…' },
  { name: 'AI explanation service', role: 'Alert reasoning', stage: 'Enrich', connected: false, detail: 'Summarises correlated signals for each alert', endpoint: 'backend/api/explain' },
]

const stageColor: Record<Integration['stage'], string> = {
  Detect: '#00d4ff', Enrich: '#a855f7', Respond: '#f97316', Track: '#22c55e',
}

function Row({ i }: { i: Integration }) {
  return (
    <div className="flex items-center gap-4 px-5 py-3.5 border-b border-[var(--color-border)] last:border-0">
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ background: i.connected ? '#22c55e' : 'var(--color-info)' }}
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
      <span className="text-[11px] shrink-0" style={{ color: i.connected ? '#22c55e' : 'var(--color-info)' }}>
        {i.connected ? 'Connected' : 'Not configured'}
      </span>
    </div>
  )
}

export default function Settings() {
  const { currentUser, aiLive } = useStore()
  const { role } = useAuth()

  // Every row is static except the AI explanation service, whose connection
  // state reflects whether the backend actually has a live Gemini key.
  const rows = integrations.map(i =>
    i.name === 'AI explanation service' ? { ...i, connected: aiLive } : i,
  )

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
            {rows.filter(i => i.connected).length} of {rows.length} connected
          </span>
        </div>
        {rows.map(i => <Row key={i.name} i={i} />)}
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
              <span className="font-mono text-[#f97316] shrink-0">70</span>
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
              <span className="font-mono text-[#22c55e] shrink-0">Automatic</span>
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
              <span className="text-[#22c55e]">Yes</span>
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
