import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, setUnauthorizedHandler, tokenSecondsLeft, tokenStore, type Session } from '../api/client'
import type { Role, User } from '../api/types'

const NOTICE_KEY = 'medtrust.signout_reason'

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string, remember: boolean) => Promise<User>
  demo: (role: Role) => Promise<User>
  register: (body: Record<string, unknown>) => Promise<User>
  adopt: (s: Session, remember?: boolean) => User
  setUser: (u: User) => void
  logout: (reason?: string) => void
}

const Ctx = createContext<AuthState | null>(null)

/** One-shot message shown on the login page after an automatic sign-out. */
export function takeSignoutReason(): string | null {
  const r = sessionStorage.getItem(NOTICE_KEY)
  sessionStorage.removeItem(NOTICE_KEY)
  return r
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const logout = useCallback((reason?: string) => {
    const wasSignedIn = !!tokenStore.get()
    tokenStore.clear()
    if (reason && wasSignedIn) sessionStorage.setItem(NOTICE_KEY, reason)
    setUserState(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler((msg) => logout(msg || 'Your session has expired. Please sign in again.'))
    const left = tokenSecondsLeft()
    if (!tokenStore.get() || (left !== null && left <= 0)) {
      tokenStore.clear()
      setLoading(false)
      return
    }
    api.me().then(setUserState).catch(() => tokenStore.clear()).finally(() => setLoading(false))
  }, [logout])

  // Proactively sign out exactly when the JWT expires instead of failing on the next request.
  useEffect(() => {
    if (!user) return
    const left = tokenSecondsLeft()
    if (left === null) return
    const t = window.setTimeout(() => logout('Your session has expired. Please sign in again.'),
      Math.max(0, Math.min(left * 1000, 2 ** 31 - 1)))
    return () => window.clearTimeout(t)
  }, [user, logout])

  const adopt = useCallback((s: Session, remember = true) => {
    tokenStore.clear()
    tokenStore.set(s.token, remember)
    setUserState(s.user)
    return s.user
  }, [])

  const value: AuthState = {
    user,
    loading,
    login: async (e, p, r) => adopt(await api.login(e, p), r),
    demo: async (role) => adopt(await api.demo(role), false),
    register: async (b) => adopt(await api.register(b)),
    adopt,
    setUser: setUserState,
    logout,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth outside AuthProvider')
  return v
}
