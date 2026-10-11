import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { api, setUnauthorizedHandler, tokenStore, type Session } from '../api/client'
import type { Role, User } from '../api/types'

interface AuthState {
  user: User | null
  loading: boolean
  login: (email: string, password: string, remember: boolean) => Promise<User>
  demo: (role: Role) => Promise<User>
  register: (body: Record<string, unknown>) => Promise<User>
  adopt: (s: Session, remember?: boolean) => User
  logout: () => void
}

const Ctx = createContext<AuthState | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  const logout = useCallback(() => {
    tokenStore.clear()
    setUser(null)
  }, [])

  useEffect(() => {
    setUnauthorizedHandler(logout)
    if (!tokenStore.get()) {
      setLoading(false)
      return
    }
    api.me().then(setUser).catch(() => tokenStore.clear()).finally(() => setLoading(false))
  }, [logout])

  const adopt = useCallback((s: Session, remember = true) => {
    tokenStore.clear()
    tokenStore.set(s.token, remember)
    setUser(s.user)
    return s.user
  }, [])

  const value: AuthState = {
    user,
    loading,
    login: async (e, p, r) => adopt(await api.login(e, p), r),
    demo: async (role) => adopt(await api.demo(role), false),
    register: async (b) => adopt(await api.register(b)),
    adopt,
    logout,
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth outside AuthProvider')
  return v
}
