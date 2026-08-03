import { create } from 'zustand'

// 主题类型：亮色 / 暗色
type Theme = 'light' | 'dark'

interface ThemeState {
  theme: Theme
  toggleTheme: () => void
  setTheme: (t: Theme) => void
}

const STORAGE_KEY = 'northbooker-theme'

// 读取初始主题：本地存储优先，其次跟随系统偏好
function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'light'
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'light' || saved === 'dark') return saved
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// 将主题应用到根元素 class
function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: getInitialTheme(),
  toggleTheme: () => {
    const next = get().theme === 'light' ? 'dark' : 'light'
    applyTheme(next)
    localStorage.setItem(STORAGE_KEY, next)
    set({ theme: next })
  },
  setTheme: (t) => {
    applyTheme(t)
    localStorage.setItem(STORAGE_KEY, t)
    set({ theme: t })
  },
}))

// 模块加载时同步应用一次主题，避免首屏闪烁
if (typeof window !== 'undefined') {
  applyTheme(useThemeStore.getState().theme)
}
