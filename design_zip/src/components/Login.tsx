import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'

type Mode = 'signin' | 'signup' | 'reset'

export default function Login() {
  const { signIn, signUp, resetPassword } = useAuth()
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
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

  return (
    <div className="relative min-h-screen bg-[#0d1117] grid-bg flex items-center justify-center px-4 overflow-hidden">
      {/* Ambient glow orbs for depth */}
      <div
        className="pointer-events-none absolute w-[480px] h-[480px] rounded-full"
        style={{ top: '-140px', left: '-120px', background: 'radial-gradient(circle, #00d4ff14, transparent 70%)' }}
      />
      <div
        className="pointer-events-none absolute w-[420px] h-[420px] rounded-full"
        style={{ bottom: '-160px', right: '-100px', background: 'radial-gradient(circle, #a855f712, transparent 70%)' }}
      />

      <div className="relative w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="glow-card w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'linear-gradient(135deg, #00d4ff20, #00d4ff40)', border: '1px solid #00d4ff40' }}
          >
            <svg width="26" height="26" viewBox="0 0 14 14" fill="none">
              <path d="M7 1L13 4V7C13 10.3 10.4 13.1 7 13.9 3.6 13.1 1 10.3 1 7V4L7 1Z" stroke="#00d4ff" strokeWidth="1.1" strokeLinejoin="round" />
              <path d="M4.5 7l1.5 1.5L9.5 5" stroke="#00d4ff" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <div className="text-[#e6edf3] font-bold text-lg tracking-wide">SOCore</div>
          <div className="text-[10px] text-[#484f58] font-mono uppercase tracking-[0.25em] mt-0.5">Security Operations Center</div>
          <div className="flex items-center gap-1.5 mt-3 text-[9px] font-mono text-[#22c55e] uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] pulse-live" />
            All systems operational
          </div>
        </div>

        {/* Card */}
        <div
          className="bg-[#161b22] border border-[#21262d] rounded-xl p-6"
          style={{ boxShadow: '0 20px 60px -20px rgba(0,0,0,0.6), 0 0 0 1px rgba(0,212,255,0.04)' }}
        >
          <div className="text-sm font-semibold text-[#e6edf3] mb-1">
            {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create an account' : 'Reset password'}
          </div>
          <div className="text-xs text-[#6b7280] mb-5">
            {mode === 'signin' && 'Access the SOC command dashboard.'}
            {mode === 'signup' && 'New analyst accounts default to read/triage access.'}
            {mode === 'reset' && "We'll email you a link to reset your password."}
          </div>

          <form onSubmit={submit} className="space-y-3">
            <div>
              <label className="block text-[10px] uppercase tracking-widest text-[#6b7280] font-semibold mb-1.5">Email</label>
              <div className="relative">
                <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#484f58]" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                  <rect x="1.5" y="3" width="13" height="10" rx="1.5" />
                  <path d="M2 4l6 4.5L14 4" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="w-full bg-[#0d1117] border border-[#21262d] rounded-lg pl-9 pr-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#00d4ff40] transition-colors"
                />
              </div>
            </div>

            {mode !== 'reset' && (
              <div>
                <label className="block text-[10px] uppercase tracking-widest text-[#6b7280] font-semibold mb-1.5">Password</label>
                <div className="relative">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-[#484f58]" width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4">
                    <rect x="3" y="7" width="10" height="7" rx="1.5" />
                    <path d="M5.5 7V4.5a2.5 2.5 0 015 0V7" strokeLinecap="round" />
                  </svg>
                  <input
                    type="password"
                    required
                    minLength={6}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-[#0d1117] border border-[#21262d] rounded-lg pl-9 pr-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#00d4ff40] transition-colors"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="text-xs text-[#ef4444] bg-[#ef444410] border border-[#ef444430] rounded-lg px-3 py-2">{error}</div>
            )}
            {message && (
              <div className="text-xs text-[#22c55e] bg-[#22c55e10] border border-[#22c55e30] rounded-lg px-3 py-2">{message}</div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 rounded-lg bg-[#00d4ff15] border border-[#00d4ff40] text-[#00d4ff] text-sm font-semibold hover:bg-[#00d4ff25] hover:shadow-[0_0_16px_#00d4ff30] transition-all disabled:opacity-40"
            >
              {busy ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
            </button>
          </form>

          <div className="mt-4 flex items-center justify-between text-xs">
            {mode === 'signin' ? (
              <>
                <button onClick={() => switchMode('reset')} className="text-[#6b7280] hover:text-[#e6edf3] transition-colors">
                  Forgot password?
                </button>
                <button onClick={() => switchMode('signup')} className="text-[#00d4ff] hover:underline">
                  Create account
                </button>
              </>
            ) : (
              <button onClick={() => switchMode('signin')} className="text-[#00d4ff] hover:underline mx-auto">
                Back to sign in
              </button>
            )}
          </div>
        </div>

        <div className="text-center text-[9px] font-mono text-[#30363d] uppercase tracking-widest mt-6">
          Encrypted session · Role-based access control
        </div>
      </div>
    </div>
  )
}
