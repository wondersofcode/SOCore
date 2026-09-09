import { useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

const MANROPE = { fontFamily: "'Manrope', system-ui, sans-serif" }

const BG = '#0a0b12'
const SURFACE = '#12141f'
const BORDER = '#242739'
const BORDER_BRIGHT = '#363a54'
const TEXT_DIM = '#9497ac'
const TEXT_FAINT = '#5b5e73'
const ACCENT = '#5b8cff'
const ACCENT_2 = '#82a4ff'
const VIOLET = '#9b7dff'
const SEV_CRITICAL = '#f0475f'
const SEV_HIGH = '#f2953f'
const SEV_MEDIUM = '#e8c34a'
const SEV_GOOD = '#38d485'

/* ---------- scroll-reveal ---------- */
function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced || !('IntersectionObserver' in window)) {
      setVisible(true)
      return
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true)
          io.disconnect()
        }
      },
      { threshold: 0.14, rootMargin: '0px 0px -60px 0px' }
    )
    io.observe(el)
    return () => io.disconnect()
  }, [])
  return { ref, visible }
}

function Reveal({ children, className = '' }: { children: ReactNode; className?: string }) {
  const { ref, visible } = useReveal<HTMLDivElement>()
  return (
    <div ref={ref} className={`reveal-up ${visible ? 'in-view' : ''} ${className}`}>
      {children}
    </div>
  )
}

function GithubIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
    </svg>
  )
}

/* ---------- risk gauge ---------- */
function RiskGauge({ score, size = 64, color, animate = false }: { score: number; size?: number; color: string; animate?: boolean }) {
  const stroke = size >= 60 ? 5 : 4
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const [offset, setOffset] = useState(animate ? circ : circ * (1 - score / 100))

  useEffect(() => {
    if (!animate) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduced) {
      setOffset(circ * (1 - score / 100))
      return
    }
    const t = setTimeout(() => setOffset(circ * (1 - score / 100)), 500)
    return () => clearTimeout(t)
  }, [animate, circ, score])

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={BORDER_BRIGHT} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: animate ? 'stroke-dashoffset 1.1s cubic-bezier(.16,.8,.24,1)' : 'none' }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-mono font-bold" style={{ fontSize: size >= 60 ? 18 : 14, color }}>{score}</span>
      </div>
    </div>
  )
}

/* ---------- capability strip ---------- */
const CAPABILITIES = [
  { label: 'Threat Detection', icon: (<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="6"/><circle cx="8" cy="8" r="2"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2"/></svg>) },
  { label: 'Threat Intelligence', icon: (<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><circle cx="8" cy="8" r="6.25"/><path d="M8 1.75c1.7 1.8 2.6 3.9 2.6 6.25S9.7 12.45 8 14.25c-1.7-1.8-2.6-3.9-2.6-6.25S6.3 3.55 8 1.75z"/><path d="M1.9 8h12.2"/></svg>) },
  { label: 'Incident Response', icon: (<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M8 1.5l5.5 2.5v4c0 3-2.3 5.6-5.5 6.5C4.8 13.6 2.5 11 2.5 8V4L8 1.5z"/><path d="M5.8 8l1.6 1.6L10.4 6.4"/></svg>) },
  { label: 'Automated Response', icon: (<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4.5h5.5l1.5 2H14"/><path d="M2 11.5h5.5l1.5-2H14"/><path d="M11.5 2.5L14 4.5l-2.5 2M11.5 13.5L14 11.5l-2.5-2"/></svg>) },
  { label: 'Audit & Compliance', icon: (<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="12" height="12" rx="2"/><path d="M5 8h6M5 11h4M5 5h2"/></svg>) },
]

function TrustStrip() {
  return (
    <section className="border-y border-[#242739]">
      <div className="max-w-[1180px] mx-auto px-7 py-10">
        <Reveal className="text-center mb-7">
          <span className="font-mono text-[10.5px] tracking-[0.14em] uppercase" style={{ color: TEXT_FAINT }}>
            Built for security operations teams
          </span>
        </Reveal>
        <Reveal>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 divide-y sm:divide-y-0 lg:divide-x divide-[#242739] border-t sm:border-t-0 border-[#242739]">
            {CAPABILITIES.map(c => (
              <div key={c.label} className="flex items-center justify-center gap-2.5 py-4 lg:py-1 px-3">
                <span className="shrink-0" style={{ color: ACCENT }}>{c.icon}</span>
                <span className="text-[13.5px] whitespace-nowrap" style={{ color: TEXT_DIM }}>{c.label}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ---------- pipeline showcase visuals ---------- */
function WazuhLogCard() {
  return (
    <div className="border rounded-lg p-4 font-mono text-[11.5px] leading-relaxed" style={{ borderColor: BORDER_BRIGHT, background: SURFACE }}>
      <div className="flex items-center justify-between mb-2.5">
        <span style={{ color: TEXT_DIM }}>rule_id: 100210</span>
        <span className="px-1.5 py-0.5 rounded text-[9.5px]" style={{ background: `${SEV_HIGH}25`, color: SEV_HIGH }}>level 12</span>
      </div>
      <div style={{ color: TEXT_FAINT }}>agent: WIN-SOC-01</div>
      <div style={{ color: TEXT_FAINT }}>source: Microsoft-Windows-Sysmon/Operational</div>
      <div style={{ color: TEXT_FAINT }}>2026-09-10 04:31:02 UTC</div>
    </div>
  )
}

function ReasonCard() {
  return (
    <div className="border rounded-lg p-4" style={{ borderColor: BORDER_BRIGHT, background: SURFACE }}>
      <div className="flex items-center gap-4 mb-3.5">
        <RiskGauge score={62} size={52} color={SEV_MEDIUM} />
        <div className="font-mono text-[11.5px]" style={{ color: TEXT_DIM }}>correlation +24 · gemini weight +18</div>
      </div>
      <div className="rounded-lg p-3" style={{ background: `${VIOLET}12`, border: `1px solid ${VIOLET}55` }}>
        <div className="text-[11px] font-semibold mb-1" style={{ color: VIOLET }}>Why this was flagged</div>
        <p className="text-[12px] leading-relaxed" style={{ color: TEXT_DIM }}>
          Score exceeds the 70-point auto-review threshold once correlated with a prior failed-login burst on the same host.
        </p>
      </div>
    </div>
  )
}

function IntelCard() {
  return (
    <div className="border rounded-lg p-4" style={{ borderColor: BORDER_BRIGHT, background: SURFACE }}>
      <div className="flex items-center justify-between mb-2">
        <span className="font-mono text-[12.5px]" style={{ color: TEXT_DIM }}>a3f9…c821</span>
        <span className="font-mono text-[9.5px] font-bold tracking-wide px-2 py-0.5 rounded" style={{ background: `${SEV_CRITICAL}18`, color: SEV_CRITICAL, border: `1px solid ${SEV_CRITICAL}55` }}>
          Malicious
        </span>
      </div>
      <div className="font-mono text-[11.5px]" style={{ color: TEXT_FAINT }}>MISP feed · osint-generic</div>
      <div className="font-mono text-[11.5px] mt-1" style={{ color: TEXT_FAINT }}>Cortex · VirusTotal_GetReport → 41/68</div>
    </div>
  )
}

function PlaybookCard() {
  return (
    <div className="border rounded-lg p-4 space-y-2.5" style={{ borderColor: BORDER_BRIGHT, background: SURFACE }}>
      {[{ label: 'Isolate host', done: true }, { label: 'Notify analyst', done: true }, { label: 'Awaiting approval', done: false }].map(s => (
        <div key={s.label} className="flex items-center gap-2.5 text-[13px]">
          {s.done ? (
            <span className="w-[18px] h-[18px] rounded-md flex items-center justify-center shrink-0" style={{ background: `${SEV_GOOD}20`, border: `1px solid ${SEV_GOOD}66` }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke={SEV_GOOD} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M2 5l2 2 4-4" /></svg>
            </span>
          ) : (
            <span className="w-[18px] h-[18px] rounded-md flex items-center justify-center shrink-0" style={{ background: `${SEV_MEDIUM}20`, border: `1px solid ${SEV_MEDIUM}66` }}>
              <span className="w-1.5 h-1.5 rounded-full pulse-live" style={{ background: SEV_MEDIUM }} />
            </span>
          )}
          <span style={{ color: s.done ? TEXT_DIM : SEV_MEDIUM }}>{s.label}</span>
        </div>
      ))}
    </div>
  )
}

const PIPELINE = [
  { n: '01', tag: 'Detect — Wazuh', h: 'Unified visibility from the first signal.', p: 'A live Wazuh agent watches the host and raises the alert the moment a Sysmon rule matches — nothing waits in a queue unseen.', visual: <WazuhLogCard /> },
  { n: '02', tag: 'Reason — Backend + Gemini', h: 'Investigation, without losing context.', p: 'Every alert is correlated, risk-scored, and sent to Gemini for a plain-language explanation — shown right on the alert, not buried in a runbook.', visual: <ReasonCard /> },
  { n: '03', tag: 'Enrich — MISP / Cortex', h: 'Threat intelligence, connected in.', p: 'Indicators are checked against MISP threat intel and run through Cortex analyzers, returning a verdict before a human opens the alert.', visual: <IntelCard /> },
  { n: '04', tag: 'Respond — Shuffle', h: 'Automated response, never unsupervised.', p: 'Matched playbooks queue the response action — isolate a host, block an indicator — and wait for an analyst to approve before anything executes.', visual: <PlaybookCard /> },
]

/* ---------- integrations ---------- */
function IntegChip({ children }: { children: ReactNode }) {
  return (
    <div className="bg-[#f4f5f8] rounded-[10px] h-[84px] flex items-center justify-center p-3.5 transition-transform duration-300 hover:-translate-y-1" style={{ boxShadow: 'none' }}>
      {children}
    </div>
  )
}

export default function Landing() {
  const navigate = useNavigate()
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="min-h-screen text-[#e9eaf2]" style={{ ...MANROPE, background: BG }}>
      {/* background grid */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage: 'linear-gradient(rgba(91,140,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(91,140,255,0.05) 1px, transparent 1px)',
          backgroundSize: '64px 64px',
          WebkitMaskImage: 'radial-gradient(ellipse 90% 60% at 50% 0%, black 30%, transparent 75%)',
          maskImage: 'radial-gradient(ellipse 90% 60% at 50% 0%, black 30%, transparent 75%)',
        }}
      />

      {/* NAV */}
      <nav
        className="sticky top-0 z-50 border-b transition-colors duration-300"
        style={{ borderColor: scrolled ? BORDER : 'transparent', background: scrolled ? 'rgba(10,11,18,0.78)' : 'transparent', backdropFilter: scrolled ? 'blur(14px)' : 'none' }}
      >
        <div className="max-w-[1180px] mx-auto px-7 h-16 flex items-center gap-8">
          <a href="#top" className="flex items-center gap-2.5 shrink-0">
            <img src="/logo.png" alt="SOCore" className="h-[22px] w-auto" />
            <span className="font-mono text-[10px] uppercase tracking-[0.12em] pl-2.5 ml-0.5 border-l" style={{ color: TEXT_FAINT, borderColor: BORDER_BRIGHT }}>
              soc pipeline
            </span>
          </a>
          <div className="hidden md:flex items-center gap-7 text-sm flex-1" style={{ color: TEXT_DIM }}>
            <a href="#pipeline" className="hover:text-[#e9eaf2] transition-colors">Pipeline</a>
            <a href="#integrations" className="hover:text-[#e9eaf2] transition-colors">Integrations</a>
            <a href="#trust" className="hover:text-[#e9eaf2] transition-colors">Security</a>
            <a href="https://github.com/wondersofcode/SOCore" target="_blank" rel="noreferrer" className="hover:text-[#e9eaf2] transition-colors">Docs</a>
          </div>
          <div className="flex items-center gap-4 ml-auto md:ml-0 shrink-0">
            <a href="https://github.com/wondersofcode/SOCore" target="_blank" rel="noreferrer" aria-label="SOCore on GitHub" className="transition-colors" style={{ color: TEXT_DIM }}>
              <GithubIcon size={19} />
            </a>
            <button onClick={() => navigate('/app')} className="hidden sm:inline-flex text-[13.5px] font-semibold px-4 py-2 rounded-md border transition-colors" style={{ color: TEXT_DIM, borderColor: BORDER_BRIGHT }}>
              Sign in
            </button>
            <button
              onClick={() => navigate('/app')}
              className="text-[13.5px] font-semibold px-4 py-2 rounded-md transition-all"
              style={{ background: ACCENT, color: '#04070f', boxShadow: `0 0 0 1px ${ACCENT}66, 0 8px 24px -8px ${ACCENT}8c` }}
            >
              Get Started
            </button>
          </div>
        </div>
      </nav>

      <main id="top" className="relative z-[1]">
        {/* HERO */}
        <section className="relative overflow-hidden pt-24 pb-16">
          <div
            className="absolute z-0 pointer-events-none rounded-full"
            style={{ width: 900, height: 900, top: -420, left: '50%', transform: 'translateX(-46%)', background: `radial-gradient(circle, ${ACCENT}29, transparent 60%)` }}
          />
          <div className="relative z-[1] max-w-[1180px] mx-auto px-7 grid lg:grid-cols-[1.02fr_0.98fr] gap-14 items-center">
            <div>
              <span className="hero-in inline-flex items-center gap-2 font-mono text-[11.5px] font-semibold tracking-[0.14em] uppercase" style={{ color: ACCENT_2, animationDelay: '.02s' }}>
                <span className="w-3.5 h-px" style={{ background: ACCENT }} />
                Security Operations Platform
              </span>
              <h1
                className="hero-in text-[2.6rem] sm:text-[3.3rem] leading-[1.08] tracking-[-0.02em] font-extrabold mt-5 mb-5 text-balance"
                style={{ animationDelay: '.12s' }}
              >
                <span style={{ background: 'linear-gradient(180deg, #fff, #c7cbe0 140%)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
                  Security operations,
                </span>
                <br />
                <span style={{ background: `linear-gradient(120deg, ${ACCENT_2}, ${VIOLET})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
                  unified.
                </span>
              </h1>
              <p className="hero-in text-[17px] max-w-[520px] mb-8" style={{ color: TEXT_DIM, animationDelay: '.24s' }}>
                SOCore brings detection, threat intelligence, investigation and response into one pipeline — every alert reasoned about, every action approved by a human.
              </p>
              <div className="hero-in flex items-center gap-4 flex-wrap mb-7" style={{ animationDelay: '.36s' }}>
                <button
                  onClick={() => navigate('/app')}
                  className="px-6 py-3.5 rounded-lg text-[14.5px] font-semibold transition-all"
                  style={{ background: ACCENT, color: '#04070f', boxShadow: `0 0 0 1px ${ACCENT}66, 0 8px 24px -8px ${ACCENT}8c` }}
                >
                  Open the Console
                </button>
                <a
                  href="https://github.com/wondersofcode/SOCore" target="_blank" rel="noreferrer"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-lg text-[14.5px] font-semibold border transition-colors"
                  style={{ color: TEXT_DIM, borderColor: BORDER_BRIGHT }}
                >
                  <GithubIcon size={16} /> View Source
                </a>
              </div>
              <div className="hero-in flex items-center gap-2.5 flex-wrap text-[12.5px]" style={{ color: TEXT_FAINT, animationDelay: '.46s' }}>
                {['Open source', 'Wazuh', 'MISP', 'Cortex', 'Shuffle', 'Gemini'].map((t, i) => (
                  <span key={t} className="flex items-center gap-2.5">
                    {i > 0 && <span className="w-[3px] h-[3px] rounded-full" style={{ background: TEXT_FAINT }} />}
                    {t}
                  </span>
                ))}
              </div>
            </div>

            {/* CONSOLE MOCKUP */}
            <div className="hero-in" style={{ animationDelay: '.5s' }}>
              <div className="relative rounded-2xl overflow-hidden border" style={{ borderColor: BORDER_BRIGHT, background: SURFACE, boxShadow: '0 40px 100px -30px rgba(0,0,0,0.7)' }}>
                <div className="flex items-center justify-between px-4 py-3 border-b" style={{ borderColor: BORDER }}>
                  <div className="flex items-center gap-2">
                    <span className="relative w-[7px] h-[7px] rounded-full shrink-0" style={{ background: SEV_GOOD }}>
                      <span className="absolute inset-[-4px] rounded-full ping-ring" style={{ border: `1px solid ${SEV_GOOD}` }} />
                    </span>
                    <span className="font-mono text-[11px]" style={{ color: TEXT_DIM }}>SOC-01 · production</span>
                  </div>
                  <span className="font-mono text-[11px]" style={{ color: TEXT_FAINT }}>04:32:17 UTC</span>
                </div>
                <div className="p-[18px]">
                  <div className="flex items-center gap-4 pb-4 mb-4 border-b" style={{ borderColor: BORDER }}>
                    <RiskGauge score={81} size={64} color={SEV_CRITICAL} animate />
                    <div>
                      <span className="font-mono text-[9.5px] font-bold tracking-wide uppercase px-1.5 py-0.5 rounded inline-block mb-1.5" style={{ background: `${SEV_CRITICAL}28`, color: SEV_CRITICAL }}>Critical</span>
                      <div className="text-[14px] font-bold mb-1">Suspicious PowerShell Execution</div>
                      <div className="font-mono text-[11px]" style={{ color: TEXT_FAINT }}>T1059.001 · WIN-SOC-01</div>
                    </div>
                  </div>
                  <div className="rounded-lg p-3 mb-4" style={{ background: `${VIOLET}12`, border: `1px solid ${VIOLET}55` }}>
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <svg width="11" height="11" viewBox="0 0 13 13" fill={VIOLET}><path d="M6.5 1l1.3 3.2L11 5.5 7.8 6.8 6.5 10 5.2 6.8 2 5.5l3.2-1.3L6.5 1z" /></svg>
                      <span className="text-[11px] font-semibold" style={{ color: VIOLET }}>Why this was flagged</span>
                    </div>
                    <p className="text-[12px] leading-relaxed" style={{ color: TEXT_DIM }}>
                      Base64-encoded command spawned from an Office process — matches a known living-off-the-land pattern seen in prior incidents.
                    </p>
                  </div>
                  <div>
                    {[
                      { t: 'Unusual outbound DNS volume', c: SEV_HIGH, tag: '2m' },
                      { t: 'Failed admin sign-in burst', c: SEV_MEDIUM, tag: '6m' },
                      { t: 'Playbook approved — host isolated', c: SEV_GOOD, tag: '11m' },
                    ].map((row, i) => (
                      <div key={row.t} className="flex items-center gap-2.5 py-2 text-[12px]" style={{ borderTop: i > 0 ? `1px solid ${BORDER}` : undefined }}>
                        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: row.c }} />
                        <span className="flex-1 truncate" style={{ color: TEXT_DIM }}>{row.t}</span>
                        <span className="font-mono text-[10px] shrink-0" style={{ color: TEXT_FAINT }}>{row.tag}</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between px-4 py-2.5 border-t font-mono text-[10.5px]" style={{ borderColor: BORDER, color: TEXT_FAINT }}>
                  <span>4 analysts active</span>
                  <span>role: analyst</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div id="trust"><TrustStrip /></div>

        {/* PROBLEM */}
        <section className="py-24">
          <div className="max-w-[1180px] mx-auto px-7">
            <Reveal className="max-w-[640px] mx-auto text-center mb-10">
              <span className="inline-flex items-center gap-2 font-mono text-[11.5px] font-semibold tracking-[0.14em] uppercase" style={{ color: ACCENT_2 }}>
                <span className="w-3.5 h-px" style={{ background: ACCENT }} />The problem
              </span>
              <h2 className="text-[2rem] sm:text-[2.4rem] font-extrabold tracking-[-0.015em] mt-3.5 text-balance">
                Security shouldn't be scattered<br />across a dozen tools.
              </h2>
              <p className="mt-3.5 text-[15.5px]" style={{ color: TEXT_DIM }}>
                Detection in one tab, intel in another, response in a spreadsheet somewhere. Context gets lost between them — and so does time.
              </p>
            </Reveal>

            <Reveal>
              <div className="flex items-center justify-center gap-3.5 flex-wrap py-9 px-5 opacity-60">
                {['siem.log', 'threat-intel.csv', '#soc-alerts', 'playbook_v3.docx', 'manual triage'].map((c, i) => (
                  <span
                    key={c}
                    className="font-mono text-[11.5px] rounded-full px-3.5 py-1.5 border border-dashed"
                    style={{ color: TEXT_FAINT, borderColor: BORDER_BRIGHT, transform: [undefined, 'translateY(10px) rotate(-2deg)', 'translateY(-8px) rotate(1.5deg)', 'translateY(6px) rotate(-1deg)', 'translateY(-4px) rotate(2deg)'][i] }}
                  >
                    {c}
                  </span>
                ))}
              </div>
              <div className="flex justify-center my-1" style={{ color: TEXT_FAINT }}>
                <svg width="16" height="24" viewBox="0 0 16 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M8 2v18M2 14l6 6 6-6" /></svg>
              </div>
              <div className="flex items-center justify-center flex-wrap gap-0 pt-2">
                {['Wazuh', 'Backend + Gemini', 'MISP / Cortex', 'Shuffle', 'Dashboard'].map((c, i) => (
                  <span key={c} className="flex items-center">
                    {i > 0 && <span className="w-7 h-px hidden sm:block" style={{ background: `${ACCENT}55` }} />}
                    <span
                      className="font-mono text-[12px] font-semibold rounded-lg px-4.5 py-2.5 m-1"
                      style={{ color: '#e9eaf2', background: SURFACE, border: `1px solid ${ACCENT}55`, boxShadow: `0 0 24px -6px ${ACCENT}55` }}
                    >
                      {c}
                    </span>
                  </span>
                ))}
              </div>
            </Reveal>
          </div>
        </section>

        {/* PIPELINE SHOWCASE */}
        <section id="pipeline" className="pt-10 pb-20 border-t" style={{ borderColor: BORDER }}>
          <div className="max-w-[1180px] mx-auto px-7">
            <Reveal className="max-w-[640px] mb-14">
              <span className="inline-flex items-center gap-2 font-mono text-[11.5px] font-semibold tracking-[0.14em] uppercase" style={{ color: ACCENT_2 }}>
                <span className="w-3.5 h-px" style={{ background: ACCENT }} />The Pipeline
              </span>
              <h2 className="text-[2rem] sm:text-[2.4rem] font-extrabold tracking-[-0.015em] mt-3.5 text-balance">From raw signal to approved response.</h2>
              <p className="mt-3.5 text-[15.5px]" style={{ color: TEXT_DIM }}>Four stages, wired together, running against live Wazuh telemetry.</p>
            </Reveal>

            <div>
              {PIPELINE.map((stage, i) => (
                <Reveal key={stage.n}>
                  <div className={`grid md:grid-cols-[0.95fr_1.05fr] gap-10 md:gap-14 items-center py-10 md:py-12 ${i > 0 ? 'border-t' : ''}`} style={{ borderColor: BORDER }}>
                    <div className={i % 2 === 1 ? 'md:order-2' : ''}>
                      <div className="flex items-center gap-2.5 font-mono text-[12px] font-bold mb-4" style={{ color: ACCENT_2 }}>
                        <span className="w-[30px] h-[30px] rounded-lg flex items-center justify-center text-[12px]" style={{ border: `1px solid ${ACCENT}55`, background: `${ACCENT}1a` }}>{stage.n}</span>
                        {stage.tag}
                      </div>
                      <h3 className="text-[22px] font-bold tracking-[-0.01em] mb-2.5">{stage.h}</h3>
                      <p className="text-[14.5px] max-w-[440px]" style={{ color: TEXT_DIM }}>{stage.p}</p>
                    </div>
                    <div className={i % 2 === 1 ? 'md:order-1' : ''}>{stage.visual}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* INTEGRATIONS */}
        <section id="integrations" className="py-24 border-t" style={{ borderColor: BORDER }}>
          <div className="max-w-[1180px] mx-auto px-7">
            <Reveal className="max-w-[640px] mb-12">
              <span className="inline-flex items-center gap-2 font-mono text-[11.5px] font-semibold tracking-[0.14em] uppercase" style={{ color: ACCENT_2 }}>
                <span className="w-3.5 h-px" style={{ background: ACCENT }} />Integrations
              </span>
              <h2 className="text-[2rem] sm:text-[2.4rem] font-extrabold tracking-[-0.015em] mt-3.5 text-balance">Works with the tools already in your stack.</h2>
              <p className="mt-3.5 text-[15.5px]" style={{ color: TEXT_DIM }}>Every integration shown here is wired into the running pipeline — nothing aspirational.</p>
            </Reveal>
            <Reveal>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
                <IntegChip><img src="/logos/wazuh.svg" alt="Wazuh" className="max-h-[26px] w-auto" /></IntegChip>
                <IntegChip><img src="/logos/gemini.svg" alt="Gemini" className="max-h-[26px] w-auto" /></IntegChip>
                <IntegChip><img src="/logos/misp.png" alt="MISP" className="max-h-[26px] w-auto" /></IntegChip>
                <IntegChip><img src="/logos/cortex.png" alt="Cortex" className="max-h-[26px] w-auto" /></IntegChip>
                <IntegChip><img src="/logos/shuffle.png" alt="Shuffle" className="max-h-[26px] w-auto" /></IntegChip>
                <IntegChip>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="#1a1d29"><path d="M5.042 15.165a2.528 2.528 0 0 1-2.52 2.523A2.528 2.528 0 0 1 0 15.165a2.527 2.527 0 0 1 2.522-2.52h2.52v2.52zM6.313 15.165a2.527 2.527 0 0 1 2.521-2.52 2.527 2.527 0 0 1 2.521 2.52v6.313A2.528 2.528 0 0 1 8.834 24a2.528 2.528 0 0 1-2.521-2.522v-6.313zM8.834 5.042a2.528 2.528 0 0 1-2.521-2.52A2.528 2.528 0 0 1 8.834 0a2.528 2.528 0 0 1 2.521 2.522v2.52H8.834zM8.834 6.313a2.528 2.528 0 0 1 2.521 2.521 2.528 2.528 0 0 1-2.521 2.521H2.522A2.528 2.528 0 0 1 0 8.834a2.528 2.528 0 0 1 2.522-2.521h6.312zM18.956 8.834a2.528 2.528 0 0 1 2.522-2.521A2.528 2.528 0 0 1 24 8.834a2.528 2.528 0 0 1-2.522 2.521h-2.522V8.834zM17.688 8.834a2.528 2.528 0 0 1-2.523 2.521 2.527 2.527 0 0 1-2.52-2.521V2.522A2.527 2.527 0 0 1 15.165 0a2.528 2.528 0 0 1 2.523 2.522v6.312zM15.165 18.956a2.528 2.528 0 0 1 2.523 2.522A2.528 2.528 0 0 1 15.165 24a2.527 2.527 0 0 1-2.52-2.522v-2.522h2.52zM15.165 17.688a2.527 2.527 0 0 1-2.52-2.523 2.526 2.526 0 0 1 2.52-2.52h6.313A2.527 2.527 0 0 1 24 15.165a2.528 2.528 0 0 1-2.522 2.523h-6.313z"/></svg>
                </IntegChip>
              </div>
            </Reveal>
          </div>
        </section>

        {/* CREDIBILITY */}
        <section className="py-24 border-t" style={{ borderColor: BORDER }}>
          <div className="max-w-[1180px] mx-auto px-7">
            <Reveal className="max-w-[640px] mb-12">
              <span className="inline-flex items-center gap-2 font-mono text-[11.5px] font-semibold tracking-[0.14em] uppercase" style={{ color: ACCENT_2 }}>
                <span className="w-3.5 h-px" style={{ background: ACCENT }} />Built for security teams
              </span>
              <h2 className="text-[2rem] sm:text-[2.4rem] font-extrabold tracking-[-0.015em] mt-3.5 text-balance">Every action is accountable.</h2>
            </Reveal>

            <div className="grid md:grid-cols-2 gap-14 items-start">
              <Reveal className="flex flex-col gap-5">
                {[
                  { h: 'Role-based access', p: 'Sign-in enforces separate analyst and admin roles, checked server-side on every request.', icon: <><circle cx="8" cy="5" r="2.5" /><path d="M3 14c0-2.8 2.2-5 5-5s5 2.2 5 5" /></> },
                  { h: 'Full audit trail', p: 'Every alert, decision and response action is logged against the analyst who made the call.', icon: <><rect x="2" y="2" width="12" height="12" rx="2" /><path d="M5 8h6M5 11h4M5 5h2" /></> },
                  { h: 'Human-approved automation', p: 'Shuffle playbooks queue a response and wait — nothing executes without an explicit approval.', icon: <><path d="M8 1.5l5.5 2.5v4c0 3-2.3 5.6-5.5 6.5C4.8 13.6 2.5 11 2.5 8V4L8 1.5z" /><path d="M5.8 8l1.6 1.6L10.4 6.4" /></> },
                  { h: 'API-first backend', p: 'A FastAPI service backed by Postgres — the same API the console and the pipeline both call.', icon: <><rect x="2" y="2" width="12" height="8" rx="1" /><path d="M5 13.5h6M8 10v3.5" /></> },
                  { h: 'Open source', p: 'The full pipeline is public on GitHub — read the code, not just the marketing.', icon: <><circle cx="4" cy="4" r="2" /><circle cx="4" cy="12" r="2" /><circle cx="12" cy="8" r="2" /><path d="M4 6v4M5.6 4.9l4.7 2.3M5.6 11.1l4.7-2.3" /></> },
                ].map(item => (
                  <div key={item.h} className="flex gap-3.5">
                    <span className="w-[34px] h-[34px] rounded-lg border flex items-center justify-center shrink-0" style={{ background: SURFACE, borderColor: BORDER_BRIGHT, color: ACCENT_2 }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">{item.icon}</svg>
                    </span>
                    <div>
                      <h4 className="text-[14.5px] font-bold mb-1">{item.h}</h4>
                      <p className="text-[13.5px]" style={{ color: TEXT_DIM }}>{item.p}</p>
                    </div>
                  </div>
                ))}
              </Reveal>

              <Reveal>
                <div className="rounded-xl overflow-hidden border" style={{ borderColor: BORDER_BRIGHT, background: SURFACE, boxShadow: '0 30px 70px -30px rgba(0,0,0,.6)' }}>
                  <div className="flex justify-between px-4 py-3 border-b font-mono text-[11px]" style={{ borderColor: BORDER, color: TEXT_FAINT }}>
                    <span>/api/audit-log</span><span>live</span>
                  </div>
                  {[
                    { a: 'alert.approve', who: 'analyst', t: '12s' },
                    { a: 'playbook.execute', who: 'shuffle', t: '13s' },
                    { a: 'case.create', who: 'analyst', t: '4m' },
                    { a: 'ioc.enrich', who: 'cortex', t: '6m' },
                    { a: 'role.assign', who: 'admin', t: '1h' },
                  ].map((row, i, arr) => (
                    <div key={row.a} className={`flex justify-between px-4 py-2.5 font-mono text-[11.5px] ${i < arr.length - 1 ? 'border-b' : ''}`} style={{ borderColor: BORDER, color: TEXT_DIM }}>
                      <span><b className="text-[#e9eaf2] font-semibold">{row.a}</b> <span style={{ color: TEXT_FAINT }}>· {row.who}</span></span>
                      <span>{row.t}</span>
                    </div>
                  ))}
                </div>
              </Reveal>
            </div>
          </div>
        </section>

        {/* GITHUB */}
        <section className="pb-24">
          <div className="max-w-[1180px] mx-auto px-7">
            <Reveal>
              <div
                className="relative overflow-hidden rounded-2xl border flex flex-col md:flex-row items-center justify-between gap-10 p-10 md:p-14 text-center md:text-left"
                style={{ borderColor: BORDER_BRIGHT, background: `linear-gradient(160deg, ${SURFACE}, #0d0f1a)` }}
              >
                <div className="absolute rounded-full pointer-events-none" style={{ width: 500, height: 500, right: -160, top: -200, background: `radial-gradient(circle, ${ACCENT}24, transparent 65%)` }} />
                <div className="relative z-[1] max-w-[480px]">
                  <span className="inline-flex items-center gap-2 font-mono text-[11.5px] font-semibold tracking-[0.14em] uppercase" style={{ color: ACCENT_2 }}>
                    <span className="w-3.5 h-px" style={{ background: ACCENT }} />Open Source
                  </span>
                  <h2 className="text-[1.9rem] font-extrabold mt-3.5 mb-3.5 text-balance">Built in the open.</h2>
                  <p className="text-[15px] mb-6" style={{ color: TEXT_DIM }}>
                    Explore the source, follow development, and help shape the future of security operations. SOCore is built by a 4-person team — SIEM, Backend/AI, Threat Intel, Detection.
                  </p>
                  <div className="flex gap-3.5 flex-wrap justify-center md:justify-start">
                    <a href="https://github.com/wondersofcode/SOCore" target="_blank" rel="noreferrer" className="px-6 py-3.5 rounded-lg text-[14.5px] font-semibold transition-all" style={{ background: ACCENT, color: '#04070f' }}>View on GitHub</a>
                    <a href="https://github.com/wondersofcode/SOCore#readme" target="_blank" rel="noreferrer" className="px-6 py-3.5 rounded-lg text-[14.5px] font-semibold border" style={{ color: TEXT_DIM, borderColor: BORDER_BRIGHT }}>Read the Docs</a>
                  </div>
                </div>
                <img src="/logo-mark.png" alt="" className="relative z-[1] w-[110px] h-[110px] opacity-90 shrink-0" />
              </div>
            </Reveal>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="relative pb-28">
          <div className="absolute pointer-events-none rounded-full" style={{ width: 700, height: 700, left: '50%', top: '50%', transform: 'translate(-50%,-50%)', background: `radial-gradient(circle, ${ACCENT}24, transparent 60%)` }} />
          <div className="relative z-[1] max-w-[1180px] mx-auto px-7 text-center">
            <Reveal>
              <span className="inline-flex items-center gap-2 font-mono text-[11.5px] font-semibold tracking-[0.14em] uppercase justify-center" style={{ color: ACCENT_2 }}>
                <span className="w-3.5 h-px" style={{ background: ACCENT }} />Get started
              </span>
              <h2 className="text-[2.2rem] sm:text-[2.8rem] font-extrabold mt-4 mb-4 text-balance">Build a stronger security operation.</h2>
              <p className="text-[16px] max-w-[480px] mx-auto mb-8" style={{ color: TEXT_DIM }}>
                Detection, intelligence and response — unified, and always reviewed by a human.
              </p>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <button onClick={() => navigate('/app')} className="px-6 py-3.5 rounded-lg text-[14.5px] font-semibold transition-all" style={{ background: ACCENT, color: '#04070f', boxShadow: `0 0 0 1px ${ACCENT}66, 0 8px 24px -8px ${ACCENT}8c` }}>
                  Open the Console
                </button>
                <a href="https://github.com/wondersofcode/SOCore" target="_blank" rel="noreferrer" className="px-6 py-3.5 rounded-lg text-[14.5px] font-semibold border" style={{ color: TEXT_DIM, borderColor: BORDER_BRIGHT }}>
                  Explore on GitHub
                </a>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="border-t py-16" style={{ borderColor: BORDER }}>
        <div className="max-w-[1180px] mx-auto px-7">
          <div className="grid md:grid-cols-[1.4fr_1fr_1fr] gap-12 mb-12">
            <div>
              <img src="/logo.png" alt="SOCore" className="h-5 w-auto mb-3" />
              <p className="text-[13px] max-w-[260px] leading-relaxed" style={{ color: TEXT_FAINT }}>
                Security operations, unified. An open-source SOC pipeline built by a 4-person team.
              </p>
            </div>
            <div>
              <h5 className="font-mono text-[10.5px] tracking-[0.12em] uppercase mb-3.5" style={{ color: TEXT_FAINT }}>Product</h5>
              <a href="#pipeline" className="block text-[13.5px] mb-2.5 hover:text-[#e9eaf2] transition-colors" style={{ color: TEXT_DIM }}>Pipeline</a>
              <a href="#integrations" className="block text-[13.5px] mb-2.5 hover:text-[#e9eaf2] transition-colors" style={{ color: TEXT_DIM }}>Integrations</a>
              <a href="https://socore.tech/app" target="_blank" rel="noreferrer" className="block text-[13.5px] mb-2.5 hover:text-[#e9eaf2] transition-colors" style={{ color: TEXT_DIM }}>Console</a>
            </div>
            <div>
              <h5 className="font-mono text-[10.5px] tracking-[0.12em] uppercase mb-3.5" style={{ color: TEXT_FAINT }}>Resources</h5>
              <a href="https://github.com/wondersofcode/SOCore" target="_blank" rel="noreferrer" className="block text-[13.5px] mb-2.5 hover:text-[#e9eaf2] transition-colors" style={{ color: TEXT_DIM }}>GitHub</a>
              <a href="https://github.com/wondersofcode/SOCore#readme" target="_blank" rel="noreferrer" className="block text-[13.5px] mb-2.5 hover:text-[#e9eaf2] transition-colors" style={{ color: TEXT_DIM }}>Documentation</a>
            </div>
          </div>
          <div className="flex justify-between items-center flex-wrap gap-3 pt-7 border-t text-[12.5px]" style={{ borderColor: BORDER, color: TEXT_FAINT }}>
            <span>© {new Date().getFullYear()} SOCore</span>
            <span>Open source security operations platform.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
