import { create } from 'zustand'
import type { User } from '@/types/user'
import { fetchMe, logout as apiLogout, redirectToLogin } from '@/api/auth'

const TOKEN_KEY = 'nb_token'
const USER_KEY = 'nb_user'

// 从 localStorage 恢复初始用户
function loadUser(): User | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? (JSON.parse(raw) as User) : null
  } catch {
    return null
  }
}

interface AuthState {
  user: User | null
  loading: boolean // 初始化时拉取用户信息
  setUser: (user: User | null) => void
  setToken: (token: string) => void
  login: () => void // 跳转玄剑授权
  logout: () => Promise<void>
  refresh: () => Promise<void> // 重新拉取当前用户
}

export const useAuthStore = create<AuthState>((set) => ({
  user: loadUser(),
  loading: false,

  setUser: (user) => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user))
    } else {
      localStorage.removeItem(USER_KEY)
    }
    set({ user })
  },

  setToken: (token) => {
    localStorage.setItem(TOKEN_KEY, token)
  },

  login: () => {
    redirectToLogin()
  },

  logout: async () => {
    await apiLogout()
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    set({ user: null })
  },

  refresh: async () => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      set({ user: null })
      return
    }
    set({ loading: true })
    try {
      const user = await fetchMe()
      if (user) {
        localStorage.setItem(USER_KEY, JSON.stringify(user))
      } else {
        localStorage.removeItem(TOKEN_KEY)
        localStorage.removeItem(USER_KEY)
      }
      set({ user, loading: false })
    } catch {
      set({ loading: false })
    }
  },
}))
