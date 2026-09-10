import { useEffect, useState } from 'react'
import { Routes, Route } from 'react-router-dom'
import Dashboard from './components/Dashboard'
import Events from './components/Events'
import Alerts from './components/Alerts'
import AlertDetail from './components/AlertDetail'
import MitreMatrix from './components/MitreMatrix'
import SimulationTracker from './components/SimulationTracker'
import CaseManagement from './components/CaseManagement'
import Approvals from './components/Approvals'
import Reports from './components/Reports'
import Settings from './components/Settings'
import SearchResults from './components/SearchResults'
import Login from './components/Login'
import PendingApproval from './components/PendingApproval'
import AdminPanel from './components/AdminPanel'
import Landing from './pages/Landing'
import { StoreProvider, useStore } from './store'
import { AuthProvider, useAuth } from './lib/AuthContext'
import { api } from './api'

type Screen = 'dashboard' | 'events' | 'alerts' | 'approvals' | 'cases' | 'simulations' | 'attack' | 'reports' | 'admin' | 'settings'

const NAV_ITEMS: { id: Screen; label: string; icon: React.ReactNode }[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="6" height="6" rx="1" /><rect x="9" y="1" width="6" height="6" rx="1" /><rect x="1" y="9" width="6" height="6" rx="1" /><rect x="9" y="9" width="6" height="6" rx="1" /></svg>,
  },
  {
    id: 'events',
    label: 'Events',
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M1.5 8h3l1.5-4 3 8 1.5-4h3" /></svg>,
  },
  {
    id: 'alerts',
    label: 'Alerts',
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 1.5l.75 1.5L10.5 3.5l-1.5.75-.75 1.5-.75-1.5L6 3.5l1.25-.5L8 1.5z" /><path d="M13 8l.5 1L15 9.5l-1 .5-.5 1-.5-1L12 9.5l1-.5L13 8z" /><path d="M3.5 11l.4.8.8.4-.8.4-.4.8-.4-.8-.8-.4.8-.4L3.5 11z" /><circle cx="8" cy="9" r="3.5" /></svg>,
  },
  {
    id: 'approvals',
    label: 'Approvals',
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 1.5l5.5 2.5v4c0 3-2.3 5.6-5.5 6.5C4.8 13.6 2.5 11 2.5 8V4L8 1.5z" /><path d="M5.8 8l1.6 1.6L10.4 6.4" /></svg>,
  },
  {
    id: 'cases',
    label: 'Cases',
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="1.5" y="3" width="13" height="11" rx="1.5" /><path d="M5.5 3V2a.5.5 0 01.5-.5h4a.5.5 0 01.5.5v1M4 7.5h8M4 10.5h5" /></svg>,
  },
  {
    id: 'simulations',
    label: 'Simulations',
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 3l10 5-10 5V3z" /></svg>,
  },
  {
    id: 'attack',
    label: 'ATT&CK Matrix',
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="1.5" y="1.5" width="4" height="4" rx="0.5" /><rect x="6.5" y="1.5" width="4" height="4" rx="0.5" /><rect x="11.5" y="1.5" width="3" height="4" rx="0.5" /><rect x="1.5" y="6.5" width="4" height="4" rx="0.5" /><rect x="6.5" y="6.5" width="4" height="4" rx="0.5" /><rect x="11.5" y="6.5" width="3" height="4" rx="0.5" /><rect x="1.5" y="11.5" width="4" height="3" rx="0.5" /><rect x="6.5" y="11.5" width="4" height="3" rx="0.5" /><rect x="11.5" y="11.5" width="3" height="3" rx="0.5" /></svg>,
  },
  {
    id: 'reports',
    label: 'Reports',
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M3 1.5h10a1 1 0 011 1V13a1 1 0 01-1 1H3a1 1 0 01-1-1V2.5a1 1 0 011-1z" /><path d="M5 5.5h6M5 8h6M5 10.5h4" /></svg>,
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="6" cy="5.5" r="2.3" /><path d="M1.8 14c.4-2.4 2.2-4 4.2-4s3.8 1.6 4.2 4" /><path d="M11 2.2c1 .35 1.7 1.3 1.7 2.4s-.7 2.05-1.7 2.4M12.7 8.8c1.1.5 1.9 1.7 2.1 3.2" /></svg>,
  },
  {
    id: 'settings',
    label: 'Settings',
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="2.5" /><path d="M8 1v1.5M8 13.5V15M1 8h1.5M13.5 8H15M2.93 2.93l1.06 1.06M12.01 12.01l1.06 1.06M2.93 13.07l1.06-1.06M12.01 3.99l1.06-1.06" /></svg>,
  },
]

function AppShell() {
  const [screen, setScreen] = useState<Screen>('dashboard')
  const [collapsed, setCollapsed] = useState(false)
  const [isLive, setIsLive] = useState(true)
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null)
  const [preselectEventId, setPreselectEventId] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  const { alerts, pending, live: backendLive, aiLive } = useStore()
  const { user, role, profile, signOut } = useAuth()
  const openAlertCount = alerts.filter(a => a.status !== 'Resolved').length
  const query = search.trim().toLowerCase()
  const visibleNavItems = NAV_ITEMS.filter(item => item.id !== 'admin' || role === 'admin')

  // Real pending-registration count for the notification bell — admin only.
  const [pendingUserCount, setPendingUserCount] = useState(0)
  useEffect(() => {
    if (role !== 'admin') { setPendingUserCount(0); return }
    let cancelled = false
    const poll = () => api.adminPendingCount().then(r => { if (!cancelled) setPendingUserCount(r.count) }).catch(() => {})
    poll()
    const timer = setInterval(poll, 15000)
    return () => { cancelled = true; clearInterval(timer) }
  }, [role])

  const screenTitles: Record<Screen, string> = {
    dashboard: 'Dashboard',
    events: 'Raw Event History',
    alerts: 'Alert Triage Queue',
    approvals: 'Pending Approvals',
    cases: 'Case Management',
    simulations: 'Simulation Tracker',
    attack: 'MITRE ATT&CK Matrix',
    reports: 'Reports',
    admin: 'Admin Panel',
    settings: 'Settings',
  }

  const simAccentScreens: Screen[] = ['simulations']
  const isSimScreen = simAccentScreens.includes(screen)

  return (
    <div className="flex h-screen bg-[var(--color-background)] overflow-hidden grid-bg">
      {/* Sidebar */}
      <aside
        className="flex flex-col bg-[var(--color-background)] border-r border-[var(--color-border)] shrink-0 transition-all duration-200"
        style={{ width: collapsed ? 56 : 216 }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-[var(--color-border)] h-14">
          <img src="/logo-mark.png" alt="SOCore" className="w-7 h-7 shrink-0" />
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="text-[var(--color-text-primary)] font-bold text-sm tracking-wide">SOCore</div>
              <div className="text-[var(--color-text-muted)] text-[9px] font-mono uppercase tracking-widest">Security Ops</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {visibleNavItems.map(item => {
            const active = screen === item.id
            const isSim = item.id === 'simulations'
            const activeColor = isSim ? '#a855f7' : '#00d4ff'
            return (
              <button
                key={item.id}
                onClick={() => setScreen(item.id)}
                title={collapsed ? item.label : undefined}
                className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-medium transition-all relative group"
                style={{
                  color: active ? activeColor : 'var(--color-info)',
                  background: active ? `${activeColor}10` : 'transparent',
                }}
              >
                {active && (
                  <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r-full" style={{ background: activeColor }} />
                )}
                <span className="shrink-0" style={{ color: active ? activeColor : 'var(--color-text-muted)' }}>{item.icon}</span>
                {!collapsed && <span className={active ? 'text-[var(--color-text-primary)]' : 'group-hover:text-[var(--color-text-secondary)] transition-colors'}>{item.label}</span>}
                {!collapsed && item.id === 'approvals' && pending.length > 0 && (
                  <span className="ml-auto text-[9px] font-mono font-bold bg-[#f9731625] text-[#f97316] border border-[#f9731640] rounded px-1.5 py-0.5">{pending.length}</span>
                )}
                {!collapsed && item.id === 'alerts' && (
                  <span className="ml-auto text-[9px] font-mono font-bold bg-[#ef444425] text-[#ef4444] border border-[#ef444440] rounded px-1.5 py-0.5">{openAlertCount}</span>
                )}
              </button>
            )
          })}
        </nav>

        {/* Collapse toggle */}
        <div className="border-t border-[var(--color-border)] p-3">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="w-full flex items-center justify-center p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] hover:bg-[var(--color-surface)] transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
              style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
              <path d="M9 2L4 7l5 5" />
            </svg>
          </button>
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Topbar */}
        <header className="h-14 flex items-center gap-4 px-5 border-b border-[var(--color-border)] bg-[var(--color-background)] shrink-0">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[var(--color-text-muted)] font-mono">SOCore</span>
            <span className="text-[var(--color-border-bright)]">/</span>
            <span className={`font-semibold ${isSimScreen ? 'text-[#a855f7]' : 'text-[var(--color-text-primary)]'}`}>{screenTitles[screen]}</span>
            <span
              className="ml-2 text-[9px] font-mono px-1.5 py-0.5 rounded border"
              style={backendLive
                ? { color: '#22c55e', borderColor: '#22c55e40', background: '#22c55e10' }
                : { color: 'var(--color-info)', borderColor: 'var(--color-border-bright)', background: 'transparent' }}
              title={backendLive ? 'Connected to the backend API' : 'Backend not reachable — showing sample data'}
            >
              {backendLive ? (aiLive ? 'live · ai' : 'live') : 'sample data'}
            </span>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-sm">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]" width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="5.5" cy="5.5" r="4" />
                <path d="M9 9l2.5 2.5" />
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search alerts, IPs, techniques…"
                className="w-full bg-[var(--color-surface)] border border-[var(--color-border)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[#00d4ff40] font-mono transition-colors"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-[var(--color-border-bright)] border border-[var(--color-border)] rounded px-1">⌘K</span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-4">
            {/* Live indicator */}
            <button
              onClick={() => setIsLive(l => !l)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-[10px] font-semibold uppercase tracking-widest font-mono"
              style={{
                background: isLive ? '#22c55e10' : '#6b728010',
                borderColor: isLive ? '#22c55e40' : 'var(--color-border-bright)',
                color: isLive ? '#22c55e' : 'var(--color-info)',
              }}
            >
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-[#22c55e] pulse-live' : 'bg-[var(--color-info)]'}`} />
              {isLive ? 'Live' : 'Paused'}
            </button>

            {/* Notifications — admin: real count of users awaiting approval */}
            {role === 'admin' && (
              <button
                onClick={() => setScreen('admin')}
                title={pendingUserCount > 0 ? `${pendingUserCount} istifadəçi təsdiq gözləyir` : 'Təsdiq gözləyən istifadəçi yoxdur'}
                className="relative text-[var(--color-info)] hover:text-[var(--color-text-primary)] transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9 2a5 5 0 015 5v3l1.5 2H2.5L4 10V7a5 5 0 015-5z" />
                  <path d="M7 15a2 2 0 004 0" />
                </svg>
                {pendingUserCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 bg-[#ef4444] rounded-full text-[9px] font-bold text-white flex items-center justify-center">
                    {pendingUserCount}
                  </span>
                )}
              </button>
            )}

            {/* User avatar */}
            <div className="flex items-center gap-2">
              {profile?.avatarUrl ? (
                <img src={profile.avatarUrl} alt="" className="w-7 h-7 rounded-full object-cover border border-[#00d4ff40]" />
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#00d4ff20] border border-[#00d4ff40] flex items-center justify-center text-[10px] font-bold text-[#00d4ff] font-mono">
                  {(user?.email ?? '??').slice(0, 2).toUpperCase()}
                </div>
              )}
              {!collapsed && <span className="text-xs text-[var(--color-text-secondary)]">{user?.email}</span>}
              <button
                onClick={signOut}
                className="text-[10px] text-[var(--color-info)] hover:text-[#ef4444] border border-[var(--color-border)] rounded-lg px-2 py-1 transition-colors"
              >
                Sign out
              </button>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-5">
          {/* Timestamp bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isSimScreen ? 'bg-[#a855f7]' : 'bg-[#00d4ff]'} ${isLive ? 'pulse-live' : ''}`} />
              <span className="text-[10px] font-mono text-[var(--color-text-muted)]">
                {isLive ? 'Last updated: ' : 'Paused at: '}
                <span className="text-[var(--color-info)]">2024-01-18 09:42:17 UTC</span>
              </span>
            </div>
            <div className="text-[10px] font-mono text-[var(--color-text-muted)]">
              {screen === 'alerts' ? (
                <>
                  Queue depth: <span className="text-[var(--color-info)]">{openAlertCount} open</span>
                  <span className="mx-2 text-[var(--color-border)]">|</span>
                  Oldest untriaged: <span className="text-[#f97316]">2h 41m</span>
                </>
              ) : (
                <>
                  Retention window: <span className="text-[var(--color-info)]">90d</span>
                  <span className="mx-2 text-[var(--color-border)]">|</span>
                  Ingestion rate: <span className={isSimScreen ? 'text-[#a855f7]' : 'text-[#00d4ff]'}>2,847 eps</span>
                </>
              )}
            </div>
          </div>

          {query.length >= 2 ? (
            <SearchResults query={query} onSelectAlert={setSelectedAlertId} onClear={() => setSearch('')} />
          ) : (
          <>
          {screen === 'dashboard' && (
            <Dashboard onSelectAlert={setSelectedAlertId} onOpenQueue={() => setScreen('alerts')} onOpenApprovals={() => setScreen('approvals')} />
          )}
          {screen === 'events' && (
            <Events preselectId={preselectEventId} onConsumedPreselect={() => setPreselectEventId(null)} />
          )}
          {screen === 'alerts' && <Alerts onSelectAlert={setSelectedAlertId} />}
          {screen === 'approvals' && <Approvals onSelectAlert={setSelectedAlertId} />}
          {screen === 'cases' && <CaseManagement />}
          {screen === 'simulations' && <SimulationTracker />}
          {screen === 'attack' && <MitreMatrix />}
          {screen === 'reports' && <Reports />}
          {screen === 'admin' && role === 'admin' && <AdminPanel />}
          {screen === 'settings' && <Settings />}
          </>
          )}
        </main>
      </div>

      {/* Alert Detail Panel */}
      {selectedAlertId && (
        <AlertDetail
          alertId={selectedAlertId}
          onClose={() => setSelectedAlertId(null)}
          onViewEvent={(eventId) => {
            setSelectedAlertId(null)
            setPreselectEventId(eventId)
            setScreen('events')
          }}
        />
      )}
    </div>
  )
}

function Gate() {
  const { session, loading, approvalBlocked } = useAuth()

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[var(--color-background)]">
        <div className="w-6 h-6 rounded-full border-2 border-[var(--color-border)] border-t-[#00d4ff] animate-spin" />
      </div>
    )
  }

  if (!session) {
    return <Login />
  }

  if (approvalBlocked) {
    return <PendingApproval status={approvalBlocked.status} detail={approvalBlocked.detail} />
  }

  return (
    <StoreProvider>
      <AppShell />
    </StoreProvider>
  )
}

function AuthenticatedApp() {
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<AuthenticatedApp />} />
    </Routes>
  )
}
