import { useThemeStore } from '@/store/theme'

// 主题切换：跟随系统 → 亮色 → 暗色 三态循环（SVG 图标）
export default function ThemeToggle() {
  const mode = useThemeStore((s) => s.mode)
  const theme = useThemeStore((s) => s.theme)
  const setMode = useThemeStore((s) => s.setMode)

  const cycle = () => {
    if (mode === 'system') setMode('light')
    else if (mode === 'light') setMode('dark')
    else setMode('system')
  }

  return (
    <button
      className="theme-toggle"
      onClick={cycle}
      title={
        mode === 'system'
          ? `跟随系统（当前${theme === 'dark' ? '暗色' : '亮色'}），点击切换`
          : mode === 'light'
            ? '亮色模式，点击切换'
            : '暗色模式，点击切换'
      }
      aria-label="切换主题"
    >
      {mode === 'system' ? <MonitorIcon /> : theme === 'light' ? <SunIcon /> : <MoonIcon />}
    </button>
  )
}

function SunIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  )
}

function MonitorIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  )
}
