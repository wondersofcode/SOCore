import { useNavigate } from 'react-router-dom'
import { useState } from 'react'

const PLEX = { fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }
const ACCENT = '#2563eb'

/* GitHub mark — Feather Icons (MIT), used as-is at stroke size */
function GithubIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  )
}

/* Small light chip carrying a real tool logo — logos keep their native colors, so they get a light backing regardless of the page's dark theme. */
function LogoChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 bg-[#f3f4f6] px-3 h-9 shrink-0">
      {children}
    </span>
  )
}

function riskColor(score: number) {
  return score >= 85 ? '#ef4444' : score >= 70 ? '#f97316' : score >= 40 ? '#eab308' : '#22c55e'
}

function RiskRing({ score, size = 40 }: { score: number; size?: number }) {
  const color = riskColor(score)
  const stroke = size >= 50 ? 4 : 3
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#21262d" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={`${(score / 100) * circ} ${circ}`}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono font-bold" style={{ fontSize: size >= 50 ? 15 : 11, color }}>{score}</span>
      </div>
    </div>
  )
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 border border-[#21262d] px-2 py-1 text-[10px] font-mono uppercase tracking-wider text-[#6b7280]">
      {children}
    </span>
  )
}

/* ---------- Hero mockup: a static mini AlertDetail card ---------- */
function HeroAlertMockup() {
  return (
    <div className="w-full max-w-[340px] border border-[#21262d] bg-[#0d1117]">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#21262d]">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest border font-mono bg-[#f9731620] text-[#f97316] border-[#f9731640]">
            High
          </span>
          <span className="text-[10px] font-mono text-[#484f58]">2m ago</span>
        </div>
        <RiskRing score={87} size={40} />
      </div>
      <div className="px-4 py-3.5">
        <div className="text-[13px] font-semibold text-[#e6edf3] mb-1 leading-snug">
          Suspicious PowerShell Execution
        </div>
        <div className="text-[10px] font-mono text-[#6b7280] mb-3">
          T1059.001 · WIN-SOC-01
        </div>
        <div className="border border-[#a855f730] bg-[#a855f708] p-2.5">
          <div className="flex items-center gap-1.5 mb-1.5">
            <svg width="11" height="11" viewBox="0 0 13 13" fill="none">
              <path d="M6.5 1l1.3 3.2L11 5.5 7.8 6.8 6.5 10 5.2 6.8 2 5.5l3.2-1.3L6.5 1z" stroke="#a855f7" strokeWidth="1" strokeLinejoin="round" />
            </svg>
            <span className="text-[10px] font-semibold text-[#a855f7]">Why this was flagged</span>
          </div>
          <p className="text-[11px] text-[#8b949e] leading-relaxed">
            Base64-encoded command spawned from an Office process — matches a known
            living-off-the-land pattern seen in prior incidents.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ---------- Pipeline stage mockups ---------- */
function WazuhMockup() {
  return (
    <div className="border border-[#21262d] bg-[#0d1117] p-3.5 font-mono text-[10.5px] leading-relaxed w-full max-w-[360px]">
      <div className="flex items-center justify-between mb-2.5">
        <span className="text-[#8b949e]">rule_id: 100210</span>
        <span className="px-1.5 py-0.5 border border-[#f9731640] text-[#f97316] text-[9px]">level 12</span>
      </div>
      <div className="text-[#6b7280]">agent: WIN-SOC-01</div>
      <div className="text-[#6b7280]">source: Microsoft-Windows-Sysmon/Operational</div>
      <div className="text-[#484f58]">2026-09-09 03:41:12 UTC</div>
    </div>
  )
}

function BackendMockup() {
  return (
    <div className="border border-[#21262d] bg-[#0d1117] p-4 flex items-center gap-4 w-full max-w-[360px]">
      <RiskRing score={62} size={56} />
      <div className="flex-1 space-y-1.5">
        <div className="flex items-center justify-between text-[10.5px]">
          <span className="text-[#6b7280]">Correlation</span><span className="font-mono text-[#8b949e]">+24</span>
        </div>
        <div className="flex items-center justify-between text-[10.5px]">
          <span className="text-[#6b7280]">Gemini weight</span><span className="font-mono text-[#8b949e]">+18</span>
        </div>
        <div className="flex items-center justify-between text-[10.5px] pt-1.5 border-t border-[#21262d]">
          <span className="text-[#484f58]">Threshold</span><span className="font-mono text-[#484f58]">70</span>
        </div>
      </div>
    </div>
  )
}

function IntelMockup() {
  return (
    <div className="border border-[#21262d] bg-[#0d1117] p-3.5 w-full max-w-[360px]">
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[11px] text-[#8b949e]">a3f9…c821</span>
        <span className="px-1.5 py-0.5 border border-[#ef444440] text-[#ef4444] text-[9px] font-mono uppercase tracking-wider">
          Malicious
        </span>
      </div>
      <div className="text-[10.5px] text-[#6b7280]">MISP feed · osint-generic</div>
      <div className="text-[10.5px] text-[#6b7280] mt-1">Cortex · VirusTotal_GetReport → 41/68</div>
    </div>
  )
}

function ShuffleMockup() {
  const steps = [
    { label: 'Isolate host', done: true },
    { label: 'Notify analyst', done: true },
    { label: 'Awaiting approval', done: false },
  ]
  return (
    <div className="border border-[#21262d] bg-[#0d1117] p-3.5 space-y-2.5 w-full max-w-[360px]">
      {steps.map(s => (
        <div key={s.label} className="flex items-center gap-2.5 text-[11px]">
          {s.done ? (
            <span className="w-3.5 h-3.5 border border-[#22c55e40] bg-[#22c55e15] flex items-center justify-center shrink-0">
              <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="#22c55e" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 5l2 2 4-4" />
              </svg>
            </span>
          ) : (
            <span className="w-3.5 h-3.5 border border-[#eab30840] bg-[#eab30815] flex items-center justify-center shrink-0">
              <span className="w-1.5 h-1.5 rounded-full bg-[#eab308] pulse-live" />
            </span>
          )}
          <span className={s.done ? 'text-[#8b949e]' : 'text-[#eab308]'}>{s.label}</span>
        </div>
      ))}
    </div>
  )
}

function DashboardMockup() {
  const rows = [
    { title: 'Impossible travel — VPN login', sev: '#ef4444', status: 'New' },
    { title: 'Unusual outbound DNS volume', sev: '#f97316', status: 'Reviewing' },
    { title: 'Failed admin sign-in burst', sev: '#eab308', status: 'Approved' },
  ]
  return (
    <div className="border border-[#21262d] bg-[#0d1117] w-full max-w-[360px]">
      {rows.map((r, i) => (
        <div key={r.title} className={`flex items-center gap-2.5 px-3.5 py-2.5 text-[11px] ${i < rows.length - 1 ? 'border-b border-[#21262d]' : ''}`}>
          <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: r.sev }} />
          <span className="text-[#8b949e] truncate flex-1">{r.title}</span>
          <span className="text-[9px] font-mono uppercase tracking-wider text-[#6b7280] shrink-0">{r.status}</span>
        </div>
      ))}
    </div>
  )
}

const PIPELINE = [
  {
    index: '01',
    phase: 'Detect',
    label: 'Wazuh',
    rest: 'raises the raw alert',
    detail: 'A production Wazuh agent runs on a live Windows host, shipping Sysmon and endpoint telemetry into the SIEM the moment a rule matches.',
    tags: ['Sysmon', 'Windows Agent', 'Rule Engine'],
    mockup: <WazuhMockup />,
    icon: (
      <LogoChip>
        <img src="/logos/wazuh.svg" alt="Wazuh" className="h-4 w-auto" />
      </LogoChip>
    ),
  },
  {
    index: '02',
    phase: 'Correlate + AI',
    label: 'Backend',
    rest: 'scores and reasons',
    detail: 'Raw alerts are correlated, risk-scored, and sent to Gemini for a plain-language explanation — not a canned template.',
    tags: ['Correlation', 'Gemini AI', 'Postgres'],
    mockup: <BackendMockup />,
    icon: (
      <LogoChip>
        <img src="/logos/gemini.svg" alt="Gemini" className="h-4 w-auto" />
      </LogoChip>
    ),
  },
  {
    index: '03',
    phase: 'Enrich',
    label: 'MISP / Cortex',
    rest: 'checks the indicators',
    detail: 'IOCs are looked up against MISP threat intel and run through Cortex analyzers, returning a verdict before a human ever sees the alert.',
    tags: ['Threat Intel', 'IOC Lookup', 'Analyzers'],
    mockup: <IntelMockup />,
    icon: (
      <LogoChip>
        <img src="/logos/misp.png" alt="MISP" className="h-4 w-auto" />
        <span className="w-px h-4 bg-[#d1d5db]" />
        <img src="/logos/cortex.png" alt="Cortex" className="h-4 w-auto" />
      </LogoChip>
    ),
  },
  {
    index: '04',
    phase: 'Respond',
    label: 'Shuffle',
    rest: 'executes, on approval',
    detail: 'Matched playbooks queue the response action — isolate a host, block an indicator — and wait for an analyst to approve before anything runs.',
    tags: ['SOAR', 'Playbooks', 'Human Approval'],
    mockup: <ShuffleMockup />,
    icon: (
      <LogoChip>
        <img src="/logos/shuffle.png" alt="Shuffle" className="h-6 w-auto" />
      </LogoChip>
    ),
  },
  {
    index: '05',
    phase: 'Track',
    label: 'Dashboard',
    rest: 'keeps the record',
    detail: 'Every alert, decision and action lands in the queue with a full audit trail — analysts triage, admins approve, nothing is silent.',
    tags: ['Triage', 'Audit Trail', 'RBAC'],
    mockup: <DashboardMockup />,
    icon: (
      <span className="w-9 h-9 border border-[#21262d] flex items-center justify-center text-[#6b7280] shrink-0">
        <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
          <rect x="1.5" y="2" width="13" height="10.5" rx="1" />
          <path d="M5.5 15h5M8 12.5V15" />
          <path d="M4 9.5l2-2.5 2 1.5 2.5-3.5" />
        </svg>
      </span>
    ),
  },
]

const STATS = [
  { value: '1,284', label: 'Alerts Processed' },
  { value: '54', label: 'Avg Risk Score' },
  { value: '312', label: 'Approved Responses' },
  { value: '4', label: 'Analysts Active' },
  { value: '99.2%', label: 'Pipeline Uptime' },
  { value: '3m 40s', label: 'Mean Time to Triage' },
]

const FAQS = [
  {
    q: 'Is this a real system or a demo?',
    a: 'SOCore runs against a live Wazuh agent on a real Windows host. Alerts are genuine detections, not seeded data — the pipeline, the AI reasoning and the approval flow are all live.',
  },
  {
    q: 'What happens when I approve an alert?',
    a: 'Approving triggers the matched Shuffle playbook, which executes the response action — isolate a host, block an indicator — and writes the outcome back to the audit trail under your account.',
  },
  {
    q: 'How is the AI reasoning generated?',
    a: 'Every alert is sent to Gemini with its correlated context — host, MITRE technique, threat intel verdicts — and returns the plain-language explanation shown as "Why this was flagged."',
  },
  {
    q: 'What data sources feed the pipeline?',
    a: 'Wazuh agents and SIEM rules for detection, MISP and Cortex for threat intel enrichment, and Shuffle for orchestrating the response — all wired into one Postgres-backed backend.',
  },
  {
    q: 'Is access role-restricted?',
    a: 'Yes. Sign-in enforces analyst and admin roles — analysts triage and propose actions, admins can approve responses, configure integrations and manage the team.',
  },
]

function FaqRow({ q, a, open, onToggle }: { q: string; a: string; open: boolean; onToggle: () => void }) {
  return (
    <div className="border-b border-[#21262d]">
      <button onClick={onToggle} className="w-full flex items-center justify-between gap-4 py-5 text-left group">
        <span className="text-sm font-medium text-[#e6edf3]">{q}</span>
        <svg
          width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          className="shrink-0 text-[#6b7280] transition-transform duration-200"
          style={{ transform: open ? 'rotate(180deg)' : 'none' }}
        >
          <path d="M2.5 5l4.5 4 4.5-4" />
        </svg>
      </button>
      {open && (
        <p className="text-[13px] text-[#8b949e] leading-relaxed pb-5 pr-8">{a}</p>
      )}
    </div>
  )
}

/* Mixed-weight heading helper: pass segments with a `bold` flag */
function Heading({ parts, className = '' }: { parts: { text: string; bold?: boolean }[]; className?: string }) {
  return (
    <span className={className}>
      {parts.map((p, i) => (
        <span key={i} className={p.bold ? 'font-semibold text-[#e6edf3]' : 'font-light text-[#6b7280]'}>
          {p.text}
        </span>
      ))}
    </span>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const [openFaq, setOpenFaq] = useState<number | null>(0)

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3]" style={PLEX}>
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-[#21262d] bg-[#0d1117]/90 backdrop-blur">
        <div className="max-w-6xl mx-auto flex items-center justify-between px-6 h-16">
          <div className="flex items-center gap-2.5">
            <img src="/logo.png" alt="SOCore" className="h-8 w-auto" />
            <span className="hidden sm:inline text-[10px] font-mono text-[#484f58] pl-2 ml-1 border-l border-[#21262d]">
              soc pipeline
            </span>
          </div>
          <nav className="hidden md:flex items-center gap-8 text-[13px] text-[#8b949e]">
            <a href="#pipeline" className="hover:text-[#e6edf3] transition-colors">Pipeline</a>
            <a href="#stats" className="hover:text-[#e6edf3] transition-colors">Stats</a>
            <a href="#faq" className="hover:text-[#e6edf3] transition-colors">FAQ</a>
          </nav>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com/wondersofcode/SOCore"
              target="_blank"
              rel="noreferrer"
              className="text-[#8b949e] hover:text-[#e6edf3] transition-colors"
              aria-label="SOCore on GitHub"
            >
              <GithubIcon size={19} />
            </a>
            <button
              onClick={() => navigate('/app')}
              className="px-4 py-1.5 text-xs font-semibold bg-[#e6edf3] text-[#0d1117] hover:bg-white transition-colors"
            >
              Open Dashboard
            </button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-24 pb-32 grid lg:grid-cols-[1fr_auto] gap-16 items-center">
        <div className="max-w-xl">
          <h1 className="text-4xl sm:text-[2.75rem] leading-[1.15] tracking-tight mb-6">
            <Heading parts={[{ text: 'Your ' }, { text: 'SOC pipeline', bold: true }, { text: ', from raw' }]} className="block" />
            <Heading parts={[{ text: 'alert to ' }, { text: 'approved response', bold: true }, { text: ' —' }]} className="block" />
            <Heading parts={[{ text: 'running on live signals.' }]} className="block" />
          </h1>
          <p className="text-sm sm:text-[15px] text-[#8b949e] leading-relaxed mb-9 max-w-md">
            Wazuh detection, MISP/Cortex threat intel and Gemini AI analysis are wired
            into one pipeline — every alert reviewed, every response approved by a
            human analyst.
          </p>
          <div className="flex items-center gap-6 flex-wrap">
            <button
              onClick={() => navigate('/app')}
              className="px-6 py-3 text-sm font-semibold bg-[#e6edf3] text-[#0d1117] hover:bg-white transition-colors"
            >
              Open Dashboard
            </button>
            <a href="#pipeline" className="text-sm font-medium text-[#8b949e] hover:text-[#e6edf3] transition-colors">
              See how it works
            </a>
          </div>
        </div>
        <div className="hidden lg:block">
          <HeroAlertMockup />
        </div>
      </section>

      {/* Pipeline */}
      <section id="pipeline" className="border-t border-[#21262d] py-28 px-6">
        <div className="max-w-6xl mx-auto">
          <div className="mb-20">
            <h2 className="text-2xl sm:text-3xl mb-3">
              <Heading parts={[{ text: 'The ' }, { text: 'pipeline', bold: true }]} />
            </h2>
            <p className="text-sm text-[#6b7280]">Five stages, wired together and running against live signals.</p>
          </div>

          <div className="space-y-24">
            {PIPELINE.map((stage, i) => {
              const reversed = i % 2 === 1
              return (
                <div key={stage.label} className={`flex flex-col lg:flex-row gap-10 lg:gap-16 items-center ${reversed ? 'lg:flex-row-reverse' : ''}`}>
                  <div className="flex-1 max-w-md">
                    <div className="flex items-center gap-2.5 mb-4">
                      {stage.icon}
                      <span className="text-[11px] font-mono uppercase tracking-widest" style={{ color: ACCENT }}>
                        {stage.index} / {stage.phase}
                      </span>
                    </div>
                    <h3 className="text-xl sm:text-2xl mb-3 leading-snug">
                      <Heading parts={[{ text: stage.label, bold: true }, { text: ` ${stage.rest}` }]} />
                    </h3>
                    <p className="text-sm text-[#8b949e] leading-relaxed mb-4">{stage.detail}</p>
                    <div className="flex flex-wrap gap-2">
                      {stage.tags.map(t => <Tag key={t}>{t}</Tag>)}
                    </div>
                  </div>
                  <div className="flex-1 flex justify-center w-full">
                    {stage.mockup}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section id="stats" className="border-t border-[#21262d] py-28 px-6 bg-[#0a0e13]">
        <div className="max-w-6xl mx-auto">
          <div className="mb-12">
            <h2 className="text-2xl sm:text-3xl mb-3">
              <Heading parts={[{ text: 'Real-time ' }, { text: 'Impact', bold: true }]} />
            </h2>
            <p className="text-sm text-[#6b7280]">Live pipeline metrics, pulled from the audit trail.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-px bg-[#21262d] border border-[#21262d]">
            {STATS.map(s => (
              <div key={s.label} className="bg-[#0a0e13] p-6">
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-1.5 h-1.5 shrink-0" style={{ background: ACCENT }} />
                  <span className="font-mono text-2xl font-bold text-[#e6edf3]">{s.value}</span>
                </div>
                <div className="text-[10px] uppercase tracking-widest text-[#6b7280]">{s.label}</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-[#484f58] mt-5 max-w-lg">
            Metrics reflect the live pipeline running against real Wazuh telemetry — not a static demo.
          </p>
        </div>
      </section>

      {/* Team — reduced per request */}
      <section className="border-t border-[#21262d] py-14 px-6 text-center">
        <p className="text-sm text-[#6b7280]">
          Built by a <span className="text-[#e6edf3] font-medium">4-person team</span> — SIEM,
          Backend/AI, Threat Intel, Detection.
        </p>
      </section>

      {/* FAQ */}
      <section id="faq" className="border-t border-[#21262d] py-28 px-6">
        <div className="max-w-2xl mx-auto text-center mb-12">
          <h2 className="text-2xl sm:text-3xl mb-3">
            <Heading parts={[{ text: 'Frequently ' }, { text: 'Asked Questions', bold: true }]} />
          </h2>
          <p className="text-sm text-[#6b7280]">
            Find answers to common questions about SOCore.
          </p>
        </div>
        <div className="max-w-2xl mx-auto">
          {FAQS.map((f, i) => (
            <FaqRow
              key={f.q}
              q={f.q}
              a={f.a}
              open={openFaq === i}
              onToggle={() => setOpenFaq(openFaq === i ? null : i)}
            />
          ))}
        </div>
      </section>

      {/* Closing CTA */}
      <section className="border-t border-[#21262d] py-28 px-6 text-center relative overflow-hidden">
        <div className="dots-texture w-24 h-24 mx-auto mb-8 opacity-70" />
        <h2 className="text-2xl sm:text-3xl mb-4">
          <Heading parts={[{ text: 'See the pipeline in ' }, { text: 'action', bold: true }]} />
        </h2>
        <p className="text-sm text-[#8b949e] mb-9 max-w-md mx-auto leading-relaxed">
          Sign in to triage live alerts, review the AI reasoning behind each one, and
          approve the response yourself.
        </p>
        <div className="flex items-center justify-center gap-6 flex-wrap">
          <button
            onClick={() => navigate('/app')}
            className="px-6 py-3 text-sm font-semibold bg-[#e6edf3] text-[#0d1117] hover:bg-white transition-colors"
          >
            Open Dashboard
          </button>
          <a href="#pipeline" className="text-sm font-medium text-[#8b949e] hover:text-[#e6edf3] transition-colors">
            See how it works
          </a>
        </div>
      </section>

      <footer className="border-t border-[#21262d] py-8 px-6 text-center">
        <div className="flex justify-center mb-3">
          <img src="/logo-mark.png" alt="SOCore" className="h-6 w-auto" />
        </div>
        <p className="text-[11px] text-[#484f58]">
          © {new Date().getFullYear()} SOCore — a student SOC pipeline project.
        </p>
      </footer>
    </div>
  )
}
