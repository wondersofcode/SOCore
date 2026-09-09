import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/AuthContext'

type Mode = 'signin' | 'signup' | 'reset'

const MANROPE = { fontFamily: "'Manrope', system-ui, sans-serif" }

const BG = '#05070a'
const SURFACE = '#0b0f14'
const SURFACE_2 = '#10161d'
const BORDER = '#1c222c'
const BORDER_BRIGHT = '#2c3644'
const TEXT_DIM = '#9497ac'
const TEXT_FAINT = '#5b5e73'
const ACCENT = '#5b8cff'
const ACCENT_2 = '#82a4ff'
const VIOLET = '#9b7dff'
const SEV_CRITICAL = '#f0475f'
const SEV_HIGH = '#f2953f'
const SEV_MEDIUM = '#e8c34a'

function EyeIcon({ off }: { off: boolean }) {
  return off ? (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 2l12 12" />
      <path d="M9.9 9.9A2.5 2.5 0 016.1 6.1" />
      <path d="M4.2 4.5C2.6 5.5 1.3 7 1 8c1 3 4 5.5 7 5.5 1.1 0 2.2-.3 3.2-.8M12.6 11.3C13.7 10.4 14.6 9.2 15 8c-1-3-4-5.5-7-5.5-.6 0-1.2.08-1.8.24" />
    </svg>
  ) : (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 8c1-3 4-5.5 7-5.5S14 5 15 8c-1 3-4 5.5-7 5.5S2 11 1 8z" />
      <circle cx="8" cy="8" r="2.5" />
    </svg>
  )
}

function MiniAlertRow({ sev, title, color }: { sev: string; title: string; color: string }) {
  return (
    <div className="flex items-center gap-2.5 py-2.5" style={{ borderTop: `1px solid ${BORDER}` }}>
      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: color }} />
      <div className="min-w-0">
        <div className="font-mono text-[9px] font-bold tracking-wide uppercase" style={{ color }}>{sev}</div>
        <div className="text-[12.5px] truncate" style={{ color: TEXT_DIM }}>{title}</div>
      </div>
    </div>
  )
}

export default function Login() {
  const navigate = useNavigate()
  const { signIn, signUp, resetPassword } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setMessage('')
    setBusy(true)

    if (mode === 'reset') {
      const { error } = await resetPassword(email)
      setBusy(false)
      if (error) setError(error)
      else setMessage('Password reset email sent — check your inbox.')
      return
    }

    const action = mode === 'signin' ? signIn : signUp
    const { error } = await action(email, password)
    setBusy(false)
    if (error) {
      setError(error)
    } else if (mode === 'signup') {
      setMessage('Account created. Check your email to confirm, then sign in.')
      setMode('signin')
    }
  }

  const switchMode = (next: Mode) => {
    setMode(next)
    setError('')
    setMessage('')
  }

  const heading = mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create your workspace' : 'Reset your password'
  const subheading =
    mode === 'signin' ? 'Sign in to your SOCore workspace.' :
    mode === 'signup' ? 'New analyst accounts default to read/triage access.' :
    "We'll email you a link to reset your password."

  return (
    <div className="min-h-screen flex" style={{ ...MANROPE, background: BG, color: '#e9eaf2' }}>
      {/* LEFT — brand panel */}
      <div className="hidden lg:flex lg:w-[55%] relative overflow-hidden flex-col justify-between p-12" style={{ background: `linear-gradient(160deg, ${SURFACE}, ${BG})` }}>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            backgroundImage: `linear-gradient(${ACCENT}0d 1px, transparent 1px), linear-gradient(90deg, ${ACCENT}0d 1px, transparent 1px)`,
            backgroundSize: '56px 56px',
            WebkitMaskImage: 'radial-gradient(ellipse 80% 70% at 30% 20%, black 20%, transparent 75%)',
            maskImage: 'radial-gradient(ellipse 80% 70% at 30% 20%, black 20%, transparent 75%)',
          }}
        />
        <div
          className="absolute rounded-full pointer-events-none"
          style={{ width: 640, height: 640, top: -220, left: -160, background: `radial-gradient(circle, ${ACCENT}22, transparent 65%)` }}
        />
        <div
          className="absolute rounded-full pointer-events-none"
          style={{ width: 460, height: 460, bottom: -180, right: -120, background: `radial-gradient(circle, ${VIOLET}18, transparent 65%)` }}
        />

        <div className="relative z-[1] hero-in" style={{ animationDelay: '.02s' }}>
          <button onClick={() => navigate('/')} className="transition-opacity hover:opacity-80" aria-label="Back to SOCore home">
            <img src="/logo.png" alt="SOCore" className="h-6 w-auto" />
          </button>
        </div>

        <div className="relative z-[1] max-w-[440px]">
          <div className="hero-in" style={{ animationDelay: '.14s' }}>
            <span className="inline-flex items-center gap-2 font-mono text-[11px] font-semibold tracking-[0.14em] uppercase" style={{ color: ACCENT_2 }}>
              <span className="w-3.5 h-px" style={{ background: ACCENT }} />Security Operations Platform
            </span>
            <h1 className="text-[2.4rem] leading-[1.12] font-extrabold tracking-[-0.02em] mt-4 mb-4 text-balance">
              Security operations,<br />
              <span style={{ background: `linear-gradient(120deg, ${ACCENT_2}, ${VIOLET})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>unified.</span>
            </h1>
            <p className="text-[15px] leading-relaxed" style={{ color: TEXT_DIM }}>
              Monitor threats, investigate incidents and respond from one unified security platform.
            </p>
          </div>

          {/* miniature console, receding into the panel */}
          <div
            className="hero-in mt-10 rounded-xl border overflow-hidden"
            style={{
              animationDelay: '.28s',
              borderColor: BORDER_BRIGHT,
              background: SURFACE_2,
              boxShadow: '0 30px 80px -30px rgba(0,0,0,0.7)',
              WebkitMaskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)',
              maskImage: 'linear-gradient(to bottom, black 55%, transparent 100%)',
            }}
          >
            <div className="flex items-center justify-between px-4 py-2.5 border-b" style={{ borderColor: BORDER }}>
              <span className="font-mono text-[10.5px]" style={{ color: TEXT_FAINT }}>Live security events</span>
              <span className="relative w-[6px] h-[6px] rounded-full" style={{ background: '#38d485' }}>
                <span className="absolute inset-[-3px] rounded-full ping-ring" style={{ border: '1px solid #38d485' }} />
              </span>
            </div>
            <div className="px-4 pb-1">
              <MiniAlertRow sev="Critical" title="Suspicious Login" color={SEV_CRITICAL} />
              <MiniAlertRow sev="High" title="Malware Detection" color={SEV_HIGH} />
              <MiniAlertRow sev="Medium" title="Unusual Network Activity" color={SEV_MEDIUM} />
            </div>
          </div>
        </div>

        <div className="relative z-[1] hero-in font-mono text-[10.5px]" style={{ animationDelay: '.4s', color: TEXT_FAINT }}>
          © SOCore — a student SOC pipeline project
        </div>
      </div>

      {/* RIGHT — form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-[380px]">
          <div className="hero-in flex lg:hidden justify-center mb-8" style={{ animationDelay: '.02s' }}>
            <button onClick={() => navigate('/')} className="transition-opacity hover:opacity-80" aria-label="Back to SOCore home">
              <img src="/logo.png" alt="SOCore" className="h-7 w-auto" />
            </button>
          </div>

          <div className="hero-in mb-8" style={{ animationDelay: '.1s' }}>
            <h2 className="text-[1.7rem] font-extrabold tracking-[-0.015em] mb-2">{heading}</h2>
            <p className="text-[14px]" style={{ color: TEXT_DIM }}>{subheading}</p>
          </div>

          <form onSubmit={submit} className="hero-in space-y-4" style={{ animationDelay: '.18s' }} noValidate>
            <div>
              <label htmlFor="email" className="block text-[12px] font-semibold mb-1.5" style={{ color: TEXT_DIM }}>Email</label>
              <div className="relative">
                <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: TEXT_FAINT }} width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <rect x="1.5" y="3" width="13" height="10" rx="1.5" />
                  <path d="M2 4l6 4.5L14 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full rounded-[10px] border pl-10 pr-3.5 py-3 text-[14px] outline-none transition-all"
                  style={{ background: SURFACE, borderColor: BORDER_BRIGHT, color: '#e9eaf2' }}
                  onFocus={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.boxShadow = `0 0 0 3px ${ACCENT}26` }}
                  onBlur={e => { e.currentTarget.style.borderColor = BORDER_BRIGHT; e.currentTarget.style.boxShadow = 'none' }}
                />
              </div>
            </div>

            {mode !== 'reset' && (
              <div>
                <label htmlFor="password" className="block text-[12px] font-semibold mb-1.5" style={{ color: TEXT_DIM }}>Password</label>
                <div className="relative">
                  <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: TEXT_FAINT }} width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <rect x="3" y="7" width="10" height="7" rx="1.5" />
                    <path d="M5.5 7V4.5a2.5 2.5 0 015 0V7" strokeLinecap="round" />
                  </svg>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full rounded-[10px] border pl-10 pr-10 py-3 text-[14px] outline-none transition-all"
                    style={{ background: SURFACE, borderColor: BORDER_BRIGHT, color: '#e9eaf2' }}
                    onFocus={e => { e.currentTarget.style.borderColor = ACCENT; e.currentTarget.style.boxShadow = `0 0 0 3px ${ACCENT}26` }}
                    onBlur={e => { e.currentTarget.style.borderColor = BORDER_BRIGHT; e.currentTarget.style.boxShadow = 'none' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: TEXT_FAINT }}
                  >
                    <EyeIcon off={showPassword} />
                  </button>
                </div>
              </div>
            )}

            {error && (
              <div role="alert" className="flex items-start gap-2 text-[12.5px] rounded-[10px] px-3.5 py-3" style={{ color: '#ff8a9a', background: `${SEV_CRITICAL}14`, border: `1px solid ${SEV_CRITICAL}40` }}>
                <span className="shrink-0 mt-px">⚠</span>
                <span>{error}</span>
              </div>
            )}
            {message && (
              <div role="status" className="flex items-start gap-2 text-[12.5px] rounded-[10px] px-3.5 py-3" style={{ color: '#7de8b5', background: '#38d48514', border: '1px solid #38d48540' }}>
                <span className="shrink-0 mt-px">✓</span>
                <span>{message}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-3.5 rounded-[10px] text-[14.5px] font-semibold transition-all flex items-center justify-center gap-2 disabled:opacity-60"
              style={{ background: ACCENT, color: '#04070f', boxShadow: busy ? 'none' : `0 0 0 1px ${ACCENT}66, 0 10px 26px -8px ${ACCENT}8c` }}
            >
              {busy && (
                <span className="w-4 h-4 rounded-full border-2 border-[#04070f33] border-t-[#04070f] animate-spin" />
              )}
              {busy ? 'Signing in…' : mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create account' : 'Send reset link'}
            </button>
          </form>

          <div className="hero-in mt-5 flex items-center justify-between text-[13px]" style={{ animationDelay: '.24s' }}>
            {mode === 'signin' ? (
              <>
                <button onClick={() => switchMode('reset')} className="transition-colors" style={{ color: TEXT_DIM }}>
                  Forgot password?
                </button>
                <button onClick={() => switchMode('signup')} className="font-semibold hover:underline" style={{ color: ACCENT_2 }}>
                  Create account
                </button>
              </>
            ) : (
              <button onClick={() => switchMode('signin')} className="mx-auto font-semibold hover:underline" style={{ color: ACCENT_2 }}>
                Back to sign in
              </button>
            )}
          </div>

          <div className="hero-in mt-10 pt-6 border-t flex items-center justify-between text-[11px] font-mono" style={{ animationDelay: '.3s', borderColor: BORDER, color: TEXT_FAINT }}>
            <span>© SOCore</span>
            <a href="https://github.com/wondersofcode/SOCore" target="_blank" rel="noreferrer" className="hover:underline">GitHub</a>
          </div>
        </div>
      </div>
    </div>
  )
}
