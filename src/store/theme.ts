import { create } from 'zustand'

// 主题模式：亮色 / 暗色 / 跟随系统
type ThemeMode = 'light' | 'dark' | 'system'
type Theme = 'light' | 'dark'

interface ThemeState {
  mode: ThemeMode
  theme: Theme
  toggleTheme: () => void
  setMode: (m: ThemeMode) => void
}

const STORAGE_KEY = 'northbooker-theme'

function systemPrefersDark(): boolean {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
}

function resolveTheme(mode: ThemeMode): Theme {
  if (mode === 'system') return systemPrefersDark() ? 'dark' : 'light'
  return mode
}

// 读取初始模式：本地存储优先，其次跟随系统偏好
function getInitialMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light'
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'light' || saved === 'dark' || saved === 'system') return saved
  return 'system'
}

// 将主题应用到根元素 class
function applyTheme(theme: Theme) {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', theme === 'dark')
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: getInitialMode(),
  theme: resolveTheme(getInitialMode()),
  toggleTheme: () => {
    // 快捷切换：light ↔ dark，并固定该模式
    const next = get().theme === 'light' ? 'dark' : 'light'
    applyTheme(next)
    localStorage.setItem(STORAGE_KEY, next)
    set({ mode: next, theme: next })
  },
  setMode: (m) => {
    const theme = resolveTheme(m)
    applyTheme(theme)
    localStorage.setItem(STORAGE_KEY, m)
    set({ mode: m, theme })
  },
}))

// 模块加载时同步应用一次主题，避免首屏闪烁
if (typeof window !== 'undefined') {
  applyTheme(useThemeStore.getState().theme)

  // 跟随系统主题：系统深浅色变化时实时切换
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    const { mode } = useThemeStore.getState()
    if (mode !== 'system') return
    const theme = e.matches ? 'dark' : 'light'
    applyTheme(theme)
    useThemeStore.setState({ theme })
  })
}
