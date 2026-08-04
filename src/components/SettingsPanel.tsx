import { useEffect, useState } from 'react'

interface Settings {
  viewMode: 'grid' | 'list'
  autoLaunch: boolean
  minimizeToTray: boolean
  fonts: { ui: string; title: string; content: string }
}

// Electron 桌面端设置面板（字体、视图、托盘、开机启动）
export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const api = (window as any).electronAPI

  useEffect(() => {
    if (!api?.isElectron) { onClose(); return }
    api.getSettings().then(setSettings)
  }, [])

  if (!settings) return null

  const update = (key: string, value: any) => {
    const next = { ...settings, [key]: value }
    setSettings(next)
    api.setSetting(key, value)
  }

  const updateFont = (field: keyof Settings['fonts'], value: string) => {
    const fonts = { ...settings.fonts, [field]: value }
    setSettings({ ...settings, fonts })
    api.setSetting('fonts', fonts)
  }

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="settings-panel" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>桌面端设置</h2>
          <button className="settings-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="settings-body">
          {/* 视图模式 */}
          <div className="settings-row">
            <label>默认视图</label>
            <select
              value={settings.viewMode}
              onChange={(e) => update('viewMode', e.target.value)}
            >
              <option value="grid">网格视图</option>
              <option value="list">列表视图</option>
            </select>
          </div>

          {/* 开关项 */}
          <div className="settings-row">
            <label>最小化到托盘</label>
            <label className="settings-toggle">
              <input type="checkbox" checked={settings.minimizeToTray}
                onChange={(e) => update('minimizeToTray', e.target.checked)} />
              <span className="settings-slider" />
            </label>
          </div>

          <div className="settings-row">
            <label>开机自启动</label>
            <label className="settings-toggle">
              <input type="checkbox" checked={settings.autoLaunch}
                onChange={(e) => update('autoLaunch', e.target.checked)} />
              <span className="settings-slider" />
            </label>
          </div>

          {/* 字体设置 */}
          <div className="settings-section-title">自定义字体</div>
          <div className="settings-row">
            <label>界面字体</label>
            <input className="settings-input" placeholder="默认"
              value={settings.fonts.ui}
              onChange={(e) => updateFont('ui', e.target.value)} />
          </div>
          <div className="settings-row">
            <label>标题字体</label>
            <input className="settings-input" placeholder="默认"
              value={settings.fonts.title}
              onChange={(e) => updateFont('title', e.target.value)} />
          </div>
          <div className="settings-row">
            <label>内容字体</label>
            <input className="settings-input" placeholder="默认"
              value={settings.fonts.content}
              onChange={(e) => updateFont('content', e.target.value)} />
          </div>
        </div>
      </div>
    </div>
  )
}
