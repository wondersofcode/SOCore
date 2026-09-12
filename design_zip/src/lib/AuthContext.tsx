import { createContext, useContext, useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from './supabase'

export type Role = 'l1_analyst' | 'l2_analyst' | 'admin'

export interface Profile {
  role: Role
  displayName: string
  firstName: string
  lastName: string
  avatarUrl: string
  themePreference: 'dark' | 'light'
  timezone: string
}

interface AuthState {
  session: Session | null
  user: User | null
  role: Role | null
  profile: Profile | null
  /** Set once the backend explicitly refuses /api/me with 403 — i.e. the
   *  account exists but isn't approved yet (or was rejected). Null while
   *  that's still unknown, or when the backend is simply unreachable (in
   *  which case the app falls back to the least-privileged view as before). */
  approvalBlocked: { status: 'pending' | 'rejected'; detail: string } | null
  loading: boolean
  refreshProfile: () => Promise<void>
  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  signUp: (email: string, password: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  resetPassword: (email: string) => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthState | null>(null)

// ── Local preview bypass ─────────────────────────────────────────────────────
// Off unless VITE_DEMO_MODE=true is explicitly set in the env this build was
// started with — never the case in a real deployment (production .env files
// never set it). Used only to demo the app against a local/throwaway backend
// without a real Supabase login. The backend it talks to must itself have
// auth.get_current_user overridden (see scripts used for the demo) to accept
// this placeholder token — nothing here weakens the real backend's auth.
const DEMO_MODE = import.meta.env.VITE_DEMO_MODE === 'true'
const DEMO_TOKEN = 'demo-preview-token'

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [approvalBlocked, setApprovalBlocked] = useState<{ status: 'pending' | 'rejected'; detail: string } | null>(null)
  const [loading, setLoading] = useState(true)
  const [checkingProfile, setCheckingProfile] = useState(false)

  const fetchRole = async (accessToken: string) => {
    // The backend is the source of truth for role/profile (never trust a
    // claim the frontend could forge) — it reads the `profiles` row, not the
    // JWT payload. get_current_user itself returns 403 for a pending/rejected
    // account, which is how we detect that state here.
    setCheckingProfile(true)
    try {
      const base = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'
      const res = await fetch(`${base}/api/me`, { headers: { Authorization: `Bearer ${accessToken}` } })
      if (res.status === 403) {
        const body = await res.json().catch(() => ({ detail: '' }))
        const status = String(body.detail || '').includes('rədd') ? 'rejected' : 'pending'
        setApprovalBlocked({ status, detail: body.detail || 'Hesabınız təsdiq gözləyir' })
        setRole(null)
        setProfile(null)
        return
      }
      if (!res.ok) return
      const data = await res.json()
      setApprovalBlocked(null)
      setRole(data.role)
      setProfile({
        role: data.role,
        displayName: data.display_name,
        firstName: data.firstName ?? '',
        lastName: data.lastName ?? '',
        avatarUrl: data.avatarUrl ?? '',
        themePreference: data.themePreference === 'light' ? 'light' : 'dark',
        timezone: data.timezone || 'Asia/Baku',
      })
    } catch {
      // Backend unreachable — role/profile stay null, UI falls back to the least-privileged view.
    } finally {
      setCheckingProfile(false)
    }
  }

  useEffect(() => {
    if (DEMO_MODE) {
      setSession({ access_token: DEMO_TOKEN, user: { id: 'demo-user', email: 'demo.analyst@socore.tech' } } as unknown as Session)
      fetchRole(DEMO_TOKEN).finally(() => setLoading(false))
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) fetchRole(data.session.access_token)
      setLoading(false)
    })

    const { data: listener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession)
      if (newSession) fetchRole(newSession.access_token)
      else {
        setRole(null)
        setProfile(null)
        setApprovalBlocked(null)
      }
    })

    return () => listener.subscription.unsubscribe()
  }, [])

  const refreshProfile = async () => {
    if (session) await fetchRole(session.access_token)
  }

  // Reflect the account's stored theme preference on <html> as soon as it's
  // known. Defaults to dark (the app's native look) before a profile has
  // loaded or for signed-out visitors on the login/landing pages.
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', profile?.themePreference ?? 'dark')
  }, [profile?.themePreference])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error?.message ?? null }
  }

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password })
    return { error: error?.message ?? null }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email)
    return { error: error?.message ?? null }
  }

  return (
    <AuthContext.Provider
      value={{
        session,
        user: session?.user ?? null,
        role,
        profile,
        approvalBlocked,
        loading: loading || checkingProfile,
        refreshProfile,
        signIn,
        signUp,
        signOut,
        resetPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider')
  return ctx
}
