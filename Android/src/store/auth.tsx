// 登录态管理：token/user 存 AsyncStorage，通过 Context 暴露
import React, { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  getToken,
  setToken,
  getUser,
  setUser,
  setUnauthorizedHandler,
} from '../api/client'
import { fetchMe } from '../api/documents'

interface AuthState {
  token: string | null
  user: any | null
  loading: boolean
  login: (token: string, user?: any) => Promise<void>
  logout: () => Promise<void>
  refresh: () => Promise<void>
}

const AuthContext = createContext<AuthState>({
  token: null,
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
  refresh: async () => {},
})

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null)
  const [user, setUserState] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)

  const applyToken = useCallback(async (t: string | null) => {
    setTokenState(t)
    if (!t) {
      setUserState(null)
      return
    }
    // 有 token 时尝试拉取用户信息（失败不阻塞登录态）
    try {
      const { user: u } = await fetchMe()
      await setUser(u)
      setUserState(u)
    } catch {
      const cached = await getUser()
      if (cached) setUserState(cached)
    }
  }, [])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      const t = await getToken()
      if (mounted) {
        await applyToken(t)
        setLoading(false)
      }
    })()
    return () => {
      mounted = false
    }
  }, [applyToken])

  // 401 统一处理：清除登录态（由 App 层决定是否跳登录页）
  useEffect(() => {
    setUnauthorizedHandler(() => {
      setToken(null)
      setUser(null)
    })
    return () => setUnauthorizedHandler(null)
  }, [])

  const login = useCallback(
    async (t: string, u?: any) => {
      await setToken(t)
      if (u) {
        await setUser(u)
        setUserState(u)
      }
      await applyToken(t)
    },
    [applyToken],
  )

  const logout = useCallback(async () => {
    await setToken(null)
    await setUser(null)
    setTokenState(null)
    setUserState(null)
  }, [])

  const refresh = useCallback(async () => {
    if (!token) return
    await applyToken(token)
  }, [token, applyToken])

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
