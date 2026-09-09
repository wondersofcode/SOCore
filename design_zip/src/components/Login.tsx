import { useState } from 'react'
import { useAuth } from '../lib/AuthContext'

type Mode = 'signin' | 'signup' | 'reset'

const PLEX = { fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }

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
    <div className="min-h-screen bg-[#0d1117] flex items-center justify-center px-4" style={PLEX}>
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <img src="/logo.png" alt="SOCore" className="w-56 h-auto mb-4" />
          <div className="text-[10px] text-[#484f58] font-mono uppercase tracking-[0.25em] mt-0.5">Security Operations Center</div>
          <div className="flex items-center gap-1.5 mt-3 text-[9px] font-mono text-[#22c55e] uppercase tracking-widest">
            <span className="w-1.5 h-1.5 rounded-full bg-[#22c55e] pulse-live" />
            All systems operational
          </div>
        </div>

        {/* Card */}
        <div className="bg-[#0d1117] border border-[#21262d] p-6">
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
                  className="w-full bg-[#0d1117] border border-[#21262d] pl-9 pr-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#2563eb40] transition-colors"
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
                    className="w-full bg-[#0d1117] border border-[#21262d] pl-9 pr-3 py-2 text-sm text-[#e6edf3] placeholder-[#484f58] focus:outline-none focus:border-[#2563eb40] transition-colors"
                  />
                </div>
              </div>
            )}

            {error && (
              <div className="text-xs text-[#ef4444] bg-[#ef444410] border border-[#ef444430] px-3 py-2">{error}</div>
            )}
            {message && (
              <div className="text-xs text-[#22c55e] bg-[#22c55e10] border border-[#22c55e30] px-3 py-2">{message}</div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="w-full py-2.5 bg-[#e6edf3] text-[#0d1117] text-sm font-semibold hover:bg-white transition-colors disabled:opacity-40"
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
                <button onClick={() => switchMode('signup')} className="text-[#2563eb] hover:underline">
                  Create account
                </button>
              </>
            ) : (
              <button onClick={() => switchMode('signin')} className="text-[#2563eb] hover:underline mx-auto">
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
