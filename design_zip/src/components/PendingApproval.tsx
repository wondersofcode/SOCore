import { useAuth } from '../lib/AuthContext'

const BG = '#05070a'
const SURFACE = '#0b0f14'
const BORDER_BRIGHT = '#2c3644'
const TEXT_DIM = '#9497ac'
const ACCENT = '#5b8cff'

export default function PendingApproval({ status, detail }: { status: 'pending' | 'rejected'; detail: string }) {
  const { user, signOut } = useAuth()
  const rejected = status === 'rejected'

  return (
    <div className="min-h-screen flex items-center justify-center px-6" style={{ background: BG, color: '#e9eaf2', fontFamily: "'Manrope', system-ui, sans-serif" }}>
      <div className="w-full max-w-[420px] rounded-2xl border p-8 text-center" style={{ background: SURFACE, borderColor: BORDER_BRIGHT }}>
        <div
          className="w-14 h-14 mx-auto mb-5 rounded-full flex items-center justify-center"
          style={{ background: rejected ? '#f0475f1a' : `${ACCENT}1a`, border: `1px solid ${rejected ? '#f0475f40' : `${ACCENT}40`}` }}
        >
          {rejected ? (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke="#f0475f" strokeWidth="1.6" strokeLinecap="round">
              <path d="M6 6l10 10M16 6L6 16" />
            </svg>
          ) : (
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none" stroke={ACCENT} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <path d="M11 6.5V11l3 2" />
            </svg>
          )}
        </div>

        <h1 className="text-[1.35rem] font-extrabold tracking-[-0.01em] mb-2">
          {rejected ? 'Girişə icazə verilmədi' : 'Hesabınız admin təsdiqini gözləyir'}
        </h1>
        <p className="text-[14px] leading-relaxed mb-1" style={{ color: TEXT_DIM }}>
          {detail}
        </p>
        {!rejected && (
          <p className="text-[13px] leading-relaxed" style={{ color: TEXT_DIM }}>
            Bir admin hesabınızı təsdiqləyən kimi giriş edə biləcəksiniz.
          </p>
        )}
        {user?.email && (
          <div className="mt-5 text-[12px] font-mono px-3 py-2 rounded-lg" style={{ background: '#10161d', color: TEXT_DIM }}>
            {user.email}
          </div>
        )}

        <button
          onClick={signOut}
          className="w-full mt-6 py-3 rounded-[10px] text-[13.5px] font-semibold border transition-colors"
          style={{ borderColor: BORDER_BRIGHT, color: '#e9eaf2' }}
        >
          Sign out
        </button>
      </div>
    </div>
  )
}
