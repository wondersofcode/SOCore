import { useState } from 'react'
import Dashboard from './components/Dashboard'
import Alerts from './components/Alerts'
import AlertDetail from './components/AlertDetail'
import MitreMatrix from './components/MitreMatrix'
import SimulationTracker from './components/SimulationTracker'
import CaseManagement from './components/CaseManagement'
import Approvals from './components/Approvals'
import Reports from './components/Reports'
import Settings from './components/Settings'
import SearchResults from './components/SearchResults'
import { StoreProvider, useStore } from './store'

type Screen = 'dashboard' | 'alerts' | 'approvals' | 'cases' | 'simulations' | 'attack' | 'reports' | 'settings'

const NAV_ITEMS: { id: Screen; label: string; icon: React.ReactNode }[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="1" width="6" height="6" rx="1" /><rect x="9" y="1" width="6" height="6" rx="1" /><rect x="1" y="9" width="6" height="6" rx="1" /><rect x="9" y="9" width="6" height="6" rx="1" /></svg>,
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
  const [search, setSearch] = useState('')

  const { alerts, pending, live: backendLive, aiLive } = useStore()
  const openAlertCount = alerts.filter(a => a.status !== 'Resolved').length
  const query = search.trim().toLowerCase()

  const screenTitles: Record<Screen, string> = {
    dashboard: 'Dashboard',
    alerts: 'Alert Triage Queue',
    approvals: 'Pending Approvals',
    cases: 'Case Management',
    simulations: 'Simulation Tracker',
    attack: 'MITRE ATT&CK Matrix',
    reports: 'Reports',
    settings: 'Settings',
  }

  const simAccentScreens: Screen[] = ['simulations']
  const isSimScreen = simAccentScreens.includes(screen)

  return (
    <div className="flex h-screen bg-[#0d1117] overflow-hidden grid-bg">
      {/* Sidebar */}
      <aside
        className="flex flex-col bg-[#0d1117] border-r border-[#21262d] shrink-0 transition-all duration-200"
        style={{ width: collapsed ? 56 : 216 }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-4 border-b border-[#21262d] h-14">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: 'linear-gradient(135deg, #00d4ff20, #00d4ff40)', border: '1px solid #00d4ff40', boxShadow: '0 0 12px #00d4ff20' }}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 4V7C13 10.3 10.4 13.1 7 13.9 3.6 13.1 1 10.3 1 7V4L7 1Z" stroke="#00d4ff" strokeWidth="1.2" strokeLinejoin="round" />
              <path d="M4.5 7l1.5 1.5L9.5 5" stroke="#00d4ff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          {!collapsed && (
            <div className="overflow-hidden">
              <div className="text-[#e6edf3] font-bold text-sm tracking-wide">SOCore</div>
              <div className="text-[#484f58] text-[9px] font-mono uppercase tracking-widest">Security Ops</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3 overflow-y-auto">
          {NAV_ITEMS.map(item => {
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
                  color: active ? activeColor : '#6b7280',
                  background: active ? `${activeColor}10` : 'transparent',
                }}
              >
                {active && (
                  <div className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r-full" style={{ background: activeColor }} />
                )}
                <span className="shrink-0" style={{ color: active ? activeColor : '#484f58' }}>{item.icon}</span>
                {!collapsed && <span className={active ? 'text-[#e6edf3]' : 'group-hover:text-[#8b949e] transition-colors'}>{item.label}</span>}
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
        <div className="border-t border-[#21262d] p-3">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="w-full flex items-center justify-center p-2 rounded-lg text-[#484f58] hover:text-[#8b949e] hover:bg-[#161b22] transition-colors"
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
        <header className="h-14 flex items-center gap-4 px-5 border-b border-[#21262d] bg-[#0d1117] shrink-0">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-xs">
            <span className="text-[#484f58] font-mono">SOCore</span>
            <span className="text-[#30363d]">/</span>
            <span className={`font-semibold ${isSimScreen ? 'text-[#a855f7]' : 'text-[#e6edf3]'}`}>{screenTitles[screen]}</span>
            <span
              className="ml-2 text-[9px] font-mono px-1.5 py-0.5 rounded border"
              style={backendLive
                ? { color: '#22c55e', borderColor: '#22c55e40', background: '#22c55e10' }
                : { color: '#6b7280', borderColor: '#30363d', background: 'transparent' }}
              title={backendLive ? 'Connected to the backend API' : 'Backend not reachable — showing sample data'}
            >
              {backendLive ? (aiLive ? 'live · ai' : 'live') : 'sample data'}
            </span>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-sm">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#484f58]" width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                <circle cx="5.5" cy="5.5" r="4" />
                <path d="M9 9l2.5 2.5" />
              </svg>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search alerts, IPs, techniques…"
                className="w-full bg-[#161b22] border border-[#21262d] rounded-lg pl-8 pr-3 py-1.5 text-xs text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#00d4ff40] font-mono transition-colors"
              />
              <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[9px] font-mono text-[#30363d] border border-[#21262d] rounded px-1">⌘K</span>
            </div>
          </div>

          <div className="ml-auto flex items-center gap-4">
            {/* Live indicator */}
            <button
              onClick={() => setIsLive(l => !l)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-[10px] font-semibold uppercase tracking-widest font-mono"
              style={{
                background: isLive ? '#22c55e10' : '#6b728010',
                borderColor: isLive ? '#22c55e40' : '#30363d',
                color: isLive ? '#22c55e' : '#6b7280',
              }}
            >
              <span className={`w-2 h-2 rounded-full ${isLive ? 'bg-[#22c55e] pulse-live' : 'bg-[#6b7280]'}`} />
              {isLive ? 'Live' : 'Paused'}
            </button>

            {/* Notifications */}
            <button className="relative text-[#6b7280] hover:text-[#e6edf3] transition-colors">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 2a5 5 0 015 5v3l1.5 2H2.5L4 10V7a5 5 0 015-5z" />
                <path d="M7 15a2 2 0 004 0" />
              </svg>
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#ef4444] rounded-full text-[9px] font-bold text-white flex items-center justify-center">3</span>
            </button>

            {/* User avatar */}
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-[#00d4ff20] border border-[#00d4ff40] flex items-center justify-center text-[10px] font-bold text-[#00d4ff] font-mono">
                KO
              </div>
              {!collapsed && <span className="text-xs text-[#8b949e]">K. Osei</span>}
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto p-5">
          {/* Timestamp bar */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`w-1.5 h-1.5 rounded-full ${isSimScreen ? 'bg-[#a855f7]' : 'bg-[#00d4ff]'} ${isLive ? 'pulse-live' : ''}`} />
              <span className="text-[10px] font-mono text-[#484f58]">
                {isLive ? 'Last updated: ' : 'Paused at: '}
                <span className="text-[#6b7280]">2024-01-18 09:42:17 UTC</span>
              </span>
            </div>
            <div className="text-[10px] font-mono text-[#484f58]">
              {screen === 'alerts' ? (
                <>
                  Queue depth: <span className="text-[#6b7280]">{openAlertCount} open</span>
                  <span className="mx-2 text-[#21262d]">|</span>
                  Oldest untriaged: <span className="text-[#f97316]">2h 41m</span>
                </>
              ) : (
                <>
                  Retention window: <span className="text-[#6b7280]">90d</span>
                  <span className="mx-2 text-[#21262d]">|</span>
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
          {screen === 'alerts' && <Alerts onSelectAlert={setSelectedAlertId} />}
          {screen === 'approvals' && <Approvals onSelectAlert={setSelectedAlertId} />}
          {screen === 'cases' && <CaseManagement />}
          {screen === 'simulations' && <SimulationTracker />}
          {screen === 'attack' && <MitreMatrix />}
          {screen === 'reports' && <Reports />}
          {screen === 'settings' && <Settings />}
          </>
          )}
        </main>
      </div>

      {/* Alert Detail Panel */}
      {selectedAlertId && (
        <AlertDetail alertId={selectedAlertId} onClose={() => setSelectedAlertId(null)} />
      )}
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <AppShell />
    </StoreProvider>
  )
}
