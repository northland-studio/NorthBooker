import { useEffect, useState } from 'react'

interface Settings {
  viewMode: 'grid' | 'list'
  autoLaunch: boolean
  minimizeToTray: boolean
  fonts: { ui: string; title: string; content: string }
  themeColor: string
}

interface CloudFont {
  name: string
  family: string
  url?: string
}

type UpdateStatus = 'idle' | 'checking' | 'no-update' | 'found' | 'error'

// Electron 桌面端设置面板（字体、视图、托盘、开机启动、更新检测）
export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const [settings, setSettings] = useState<Settings | null>(null)
  const [cloudFonts, setCloudFonts] = useState<CloudFont[]>([])
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle')
  const [updateVersion, setUpdateVersion] = useState('')
  const [updateError, setUpdateError] = useState('')
  const [appVersion, setAppVersion] = useState('')
  const api = (window as any).electronAPI

  useEffect(() => {
    if (!api?.isElectron) { onClose(); return }
    api.getSettings().then(setSettings)
    api.getCloudFonts().then((fonts: CloudFont[]) => setCloudFonts(fonts || []))
    api.getVersion().then((v: string) => setAppVersion(v || ''))

    // 监听更新事件
    api.onUpdateAvailable((info: { version: string }) => {
      setUpdateStatus('found')
      setUpdateVersion(info.version)
    })
    api.onUpdateNotAvailable(() => {
      setUpdateStatus('no-update')
    })
    api.onUpdateError((msg: string) => {
      setUpdateStatus('error')
      setUpdateError(msg)
    })
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

  // 云字体选择
  const handleCloudFont = (field: keyof Settings['fonts'], font: CloudFont) => {
    if (!font.family) {
      updateFont(field, '')
      return
    }
    updateFont(field, font.family)
    if (font.url) {
      api.loadCloudFont({ family: font.family, url: font.url })
    }
  }

  // 本地字体选择
  const handleLocalFont = async (field: keyof Settings['fonts']) => {
    const result = await api.pickLocalFont()
    if (result?.family) {
      updateFont(field, result.family)
    }
  }

  // 获取某个字段的当前云字体
  const getSelectedCloudFont = (field: keyof Settings['fonts']) => {
    return cloudFonts.find((f) => f.family === settings.fonts[field])
  }

  // 更新检测
  const checkUpdate = async () => {
    setUpdateStatus('checking')
    setUpdateError('')
    try {
      await api.checkUpdate()
    } catch {
      // 错误由事件处理
    }
  }

  const presetColors = ['#004AAD', '#E74C3C', '#27AE60', '#F39C12', '#8E44AD', '#1ABC9C', '#2C3E50', '#E91E63']

  const FontRow = ({ label, field }: { label: string; field: keyof Settings['fonts'] }) => {
    const selected = getSelectedCloudFont(field)
    return (
      <div className="settings-row settings-row-font">
        <label>{label}</label>
        <div className="settings-font-controls">
          <select
            className="settings-font-preset"
            value={selected?.family || '__custom__'}
            onChange={(e) => {
              const f = cloudFonts.find((cf) => cf.family === e.target.value)
              if (f) handleCloudFont(field, f)
            }}
          >
            {cloudFonts.map((f) => (
              <option key={f.family || '__default__'} value={f.family || '__default__'}>
                {f.name}
              </option>
            ))}
            <option value="__custom__">自定义...</option>
          </select>
          {(!selected || selected.family === '') && (
            <input
              className="settings-input settings-font-input"
              placeholder="输入字体名"
              value={settings.fonts[field]}
              onChange={(e) => updateFont(field, e.target.value)}
            />
          )}
          <button
            className="settings-font-local-btn"
            title="选择本地字体文件"
            onClick={() => handleLocalFont(field)}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
            </svg>
          </button>
        </div>
      </div>
    )
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
          <FontRow label="界面字体" field="ui" />
          <FontRow label="标题字体" field="title" />
          <FontRow label="内容字体" field="content" />

          {/* 主题色 */}
          <div className="settings-section-title">主题色</div>
          <div className="settings-color-presets">
            {presetColors.map((color) => (
              <button
                key={color}
                className={`settings-color-preset${settings.themeColor === color ? ' settings-color-preset--active' : ''}`}
                style={{ backgroundColor: color }}
                title={color}
                onClick={() => {
                  setSettings({ ...settings, themeColor: color })
                  api.setSetting('themeColor', color)
                }}
              />
            ))}
            <input
              type="color"
              className="settings-color-input"
              value={settings.themeColor || '#004AAD'}
              onChange={(e) => {
                const color = e.target.value
                setSettings({ ...settings, themeColor: color })
                api.setSetting('themeColor', color)
              }}
              title="自定义颜色"
            />
          </div>

          {/* 更新检测 */}
          <div className="settings-section-title">版本更新</div>
          <div className="settings-row">
            <div className="settings-update-info">
              <span>北牖 Desktop v{appVersion || '...'}</span>
            </div>
            <button
              className="settings-update-btn"
              onClick={checkUpdate}
              disabled={updateStatus === 'checking'}
            >
              {updateStatus === 'checking' ? (
                <>
                  <span className="settings-spinner" />
                  检查中...
                </>
              ) : (
                '检查更新'
              )}
            </button>
          </div>

          {/* 更新反馈 */}
          {updateStatus === 'no-update' && (
            <div className="settings-update-feedback success">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              已是最新版本
            </div>
          )}
          {updateStatus === 'found' && (
            <div className="settings-update-feedback found">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              发现新版本 v{updateVersion}，可在右下角通知中下载安装
            </div>
          )}
          {updateStatus === 'error' && (
            <div className="settings-update-feedback error">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
              </svg>
              检查失败: {updateError || '网络不可用'}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
