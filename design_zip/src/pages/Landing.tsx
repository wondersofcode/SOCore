import { useNavigate } from 'react-router-dom'

function Logo({ size = 28 }: { size?: number }) {
  return (
    <div
      className="rounded-lg flex items-center justify-center shrink-0"
      style={{
        width: size, height: size,
        background: 'linear-gradient(135deg, #00d4ff20, #00d4ff40)',
        border: '1px solid #00d4ff40',
        boxShadow: '0 0 12px #00d4ff20',
      }}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 14 14" fill="none">
        <path d="M7 1L13 4V7C13 10.3 10.4 13.1 7 13.9 3.6 13.1 1 10.3 1 7V4L7 1Z" stroke="#00d4ff" strokeWidth="1.2" strokeLinejoin="round" />
        <path d="M4.5 7l1.5 1.5L9.5 5" stroke="#00d4ff" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </div>
  )
}

const PIPELINE = [
  {
    label: 'Wazuh',
    sub: 'Detect',
    detail: 'SIEM & endpoint agents raise raw alerts',
    icon: (
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 1.5l.9 1.8L10.7 4l-1.8.9L8 6.7l-.9-1.8L5.3 4l1.8-.7L8 1.5z" />
        <circle cx="8" cy="10" r="4" />
        <path d="M6.3 10l1.2 1.2L10 8.5" />
      </svg>
    ),
  },
  {
    label: 'Backend',
    sub: 'Correlation + AI',
    detail: 'Risk scoring, correlation and Gemini reasoning',
    icon: (
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="2" y="2" width="12" height="8" rx="1.5" />
        <path d="M5 13.5h6M8 10v3.5" />
        <path d="M4.5 5.5h2M4.5 7.5h4" />
      </svg>
    ),
  },
  {
    label: 'MISP / Cortex',
    sub: 'Enrich',
    detail: 'Threat intel lookups and analyzer verdicts',
    icon: (
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="8" r="6.25" />
        <path d="M8 1.75c1.7 1.8 2.6 3.9 2.6 6.25S9.7 12.45 8 14.25c-1.7-1.8-2.6-3.9-2.6-6.25S6.3 3.55 8 1.75z" />
        <path d="M1.9 8h12.2" />
      </svg>
    ),
  },
  {
    label: 'Shuffle',
    sub: 'SOAR',
    detail: 'Human-approved response playbooks execute',
    icon: (
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2 4.5h5.5l1.5 2H14" />
        <path d="M2 11.5h5.5l1.5-2H14" />
        <path d="M11.5 2.5L14 4.5l-2.5 2M11.5 13.5L14 11.5l-2.5-2" />
      </svg>
    ),
  },
  {
    label: 'Dashboard',
    sub: 'Track',
    detail: 'Analysts triage, approve and audit every step',
    icon: (
      <svg width="20" height="20" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1.5" y="2" width="13" height="10.5" rx="1.5" />
        <path d="M5.5 15h5M8 12.5V15" />
        <path d="M4 9.5l2-2.5 2 1.5 2.5-3.5" />
      </svg>
    ),
  },
]

const ACHIEVEMENTS = [
  {
    title: 'Real Windows agent, live-tested',
    detail: 'A production Wazuh agent runs on a live Windows host, shipping real detections into the pipeline.',
    color: '#00d4ff',
    icon: (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <rect x="1.5" y="2.5" width="13" height="8.5" rx="1" />
        <path d="M5.5 14h5M8 11v3" />
      </svg>
    ),
  },
  {
    title: 'Real Gemini AI reasoning per alert',
    detail: 'Every alert gets a genuine Gemini-generated explanation, not a canned template.',
    color: '#a855f7',
    icon: (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 1.5l1 2 2 1-2 1-1 2-1-2-2-1 2-1 1-2z" />
        <path d="M13 8.5l.55 1.1L14.7 10l-1.15.4L13 11.5l-.55-1.1L11.3 10l1.15-.4L13 8.5z" />
        <circle cx="4.5" cy="11.5" r="1.75" />
      </svg>
    ),
  },
  {
    title: 'Persistent Postgres backend',
    detail: 'Alerts, decisions and audit trails persist in Postgres via Supabase, not in-memory mocks.',
    color: '#22c55e',
    icon: (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <ellipse cx="8" cy="3.5" rx="6" ry="2" />
        <path d="M2 3.5v9c0 1.1 2.7 2 6 2s6-.9 6-2v-9" />
        <path d="M2 8c0 1.1 2.7 2 6 2s6-.9 6-2" />
      </svg>
    ),
  },
  {
    title: 'Role-based access — analyst & admin',
    detail: 'Sign-in enforces separate analyst and admin roles, each scoped to the right level of control.',
    color: '#f97316',
    icon: (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="8" cy="5" r="2.5" />
        <path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" />
      </svg>
    ),
  },
]

const TEAM = [
  { role: 'SIEM / Infrastructure', name: 'Team Member 1', detail: 'Wazuh, agents, log pipeline' },
  { role: 'Backend / AI', name: 'Team Member 2', detail: 'Correlation engine, Gemini integration' },
  { role: 'Threat Intel / SOAR', name: 'Team Member 3', detail: 'MISP, Cortex, TheHive, Shuffle' },
  { role: 'Detection / Docs', name: 'Team Member 4', detail: 'Use cases, simulations, documentation' },
]

export default function Landing() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3]">
      {/* Nav */}
      <header className="sticky top-0 z-10 border-b border-[#21262d] bg-[#0d1117cc] backdrop-blur">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-5 h-14">
          <div className="flex items-center gap-2.5">
            <Logo size={26} />
            <span className="font-bold text-sm tracking-wide">SOCore</span>
          </div>
          <button
            onClick={() => navigate('/app')}
            className="rounded-lg px-4 py-1.5 text-xs font-semibold transition-all"
            style={{ background: 'linear-gradient(135deg, #00d4ff, #00a8cc)', color: '#0d1117' }}
          >
            Open Dashboard
          </button>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden grid-bg">
        <div className="max-w-4xl mx-auto px-5 pt-20 pb-24 text-center">
          <div className="flex justify-center mb-6">
            <Logo size={56} />
          </div>
          <h1 className="text-3xl sm:text-5xl font-bold tracking-tight mb-4">SOCore</h1>
          <p className="text-lg sm:text-xl font-semibold mb-4" style={{ color: '#00d4ff' }}>
            Detect → Enrich → Respond → Track — a real SOC pipeline, end to end.
          </p>
          <p className="text-sm sm:text-base text-[#8b949e] max-w-2xl mx-auto leading-relaxed mb-9">
            Wazuh detection, MISP/Cortex threat intel, Gemini AI analysis, and human-approved
            response — all wired together and running live.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={() => navigate('/app')}
              className="rounded-lg px-6 py-3 text-sm font-semibold transition-all"
              style={{ background: 'linear-gradient(135deg, #00d4ff, #00a8cc)', color: '#0d1117', boxShadow: '0 0 24px #00d4ff40' }}
            >
              Open Dashboard
            </button>
            <a
              href="#architecture"
              className="rounded-lg px-6 py-3 text-sm font-semibold border border-[#21262d] text-[#8b949e] hover:text-[#e6edf3] hover:border-[#30363d] transition-all"
            >
              See how it works
            </a>
          </div>
        </div>
      </section>

      {/* Architecture flow */}
      <section id="architecture" className="border-t border-[#21262d] py-20 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold mb-2">The pipeline</h2>
            <p className="text-sm text-[#6b7280]">Five stages, wired together and running against live signals.</p>
          </div>

          <div className="flex flex-col lg:flex-row items-stretch lg:items-center gap-3">
            {PIPELINE.map((stage, i) => (
              <div key={stage.label} className="flex items-center gap-3 lg:flex-1">
                <div className="flex-1 bg-[#161b22] border border-[#21262d] rounded-xl p-5 text-center hover:border-[#00d4ff40] transition-colors">
                  <div className="w-10 h-10 mx-auto rounded-lg flex items-center justify-center mb-3" style={{ background: '#00d4ff15', color: '#00d4ff', border: '1px solid #00d4ff30' }}>
                    {stage.icon}
                  </div>
                  <div className="text-sm font-semibold text-[#e6edf3]">{stage.label}</div>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-[#00d4ff] mt-1 mb-2">{stage.sub}</div>
                  <div className="text-[11px] text-[#6b7280] leading-snug">{stage.detail}</div>
                </div>
                {i < PIPELINE.length - 1 && (
                  <div className="hidden lg:flex items-center justify-center shrink-0">
                    <svg className="flow-arrow" width="20" height="10" viewBox="0 0 20 10" fill="none" stroke="#00d4ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M0 5h16M12 1l4 4-4 4" />
                    </svg>
                  </div>
                )}
                {i < PIPELINE.length - 1 && (
                  <div className="flex lg:hidden justify-center py-0.5">
                    <svg className="flow-arrow" width="10" height="20" viewBox="0 0 10 20" fill="none" stroke="#00d4ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 0v16M1 12l4 4 4-4" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Achievements */}
      <section className="border-t border-[#21262d] py-20 px-5 bg-[#0a0e13]">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold mb-2">What's actually running</h2>
            <p className="text-sm text-[#6b7280]">Not a mockup — a working system, end to end.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {ACHIEVEMENTS.map(a => (
              <div key={a.title} className="bg-[#161b22] border border-[#21262d] rounded-xl p-5">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-4" style={{ background: `${a.color}15`, color: a.color, border: `1px solid ${a.color}30` }}>
                  {a.icon}
                </div>
                <div className="text-sm font-semibold text-[#e6edf3] mb-2 leading-snug">{a.title}</div>
                <div className="text-[11px] text-[#6b7280] leading-relaxed">{a.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Team */}
      <section className="border-t border-[#21262d] py-20 px-5">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-bold mb-2">Built by a four-person SOC team</h2>
            <p className="text-sm text-[#6b7280]">Each stage of the pipeline owned end to end.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {TEAM.map(member => (
              <div key={member.role} className="bg-[#161b22] border border-[#21262d] rounded-xl p-5 text-center">
                <div className="w-12 h-12 mx-auto rounded-full flex items-center justify-center text-sm font-bold mb-3" style={{ background: '#00d4ff15', color: '#00d4ff', border: '1px solid #00d4ff30' }}>
                  {member.name.split(' ').map(w => w[0]).slice(0, 2).join('')}
                </div>
                <div className="text-sm font-semibold text-[#e6edf3]">{member.name}</div>
                <div className="text-[10px] font-mono uppercase tracking-widest text-[#00d4ff] mt-1 mb-2">{member.role}</div>
                <div className="text-[11px] text-[#6b7280] leading-snug">{member.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA footer */}
      <section className="border-t border-[#21262d] py-16 px-5 text-center">
        <h2 className="text-xl font-bold mb-3">See the pipeline in action</h2>
        <p className="text-sm text-[#6b7280] mb-6">Sign in to triage live alerts, review AI reasoning and approve responses.</p>
        <button
          onClick={() => navigate('/app')}
          className="rounded-lg px-6 py-3 text-sm font-semibold transition-all"
          style={{ background: 'linear-gradient(135deg, #00d4ff, #00a8cc)', color: '#0d1117', boxShadow: '0 0 24px #00d4ff40' }}
        >
          Open Dashboard
        </button>
      </section>

      <footer className="border-t border-[#21262d] py-6 px-5 text-center text-[11px] text-[#484f58]">
        © {new Date().getFullYear()} SOCore — a student SOC pipeline project.
      </footer>
    </div>
  )
}
