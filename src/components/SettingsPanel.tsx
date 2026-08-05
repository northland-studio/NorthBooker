import { useEffect, useState } from 'react'
import { useT } from '@/i18n'

interface Settings {
  viewMode: 'grid' | 'list'
  autoLaunch: boolean
  minimizeToTray: boolean
  fonts: { ui: string; title: string; content: string }
  themeColor: string
  tts?: { enabled: boolean; speed: number; model: string; sid: number }
}

interface CloudFont {
  name: string
  family: string
  url?: string
}

interface TtsModel {
  id: string
  name: string
  speakers?: number
}

type UpdateStatus = 'idle' | 'checking' | 'no-update' | 'found' | 'error'
type TtsModelStatus = 'unknown' | 'ready' | 'downloading' | 'error'

// Electron 桌面端设置面板（字体、视图、托盘、开机启动、更新检测）
export default function SettingsPanel({ onClose }: { onClose: () => void }) {
  const t = useT()
  const [settings, setSettings] = useState<Settings | null>(null)
  const [cloudFonts, setCloudFonts] = useState<CloudFont[]>([])
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>('idle')
  const [updateVersion, setUpdateVersion] = useState('')
  const [updateError, setUpdateError] = useState('')
  const [appVersion, setAppVersion] = useState('')
  const [ttsModels, setTtsModels] = useState<TtsModel[]>([])
  const [ttsModelStatus, setTtsModelStatus] = useState<TtsModelStatus>('unknown')
  const [ttsModelPercent, setTtsModelPercent] = useState(0)
  const [ttsModelError, setTtsModelError] = useState('')
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

    // TTS 模型列表
    api.ttsGetModels().then((models: TtsModel[]) => {
      setTtsModels(models || [])
      api.getSettings().then((s: Settings) => refreshModelStatus(s?.tts?.model))
    })
    api.onTtsModelProgress((p: { id: string; percent: number }) => {
      setTtsModelPercent(p.percent)
      if (p.percent >= 100) {
        setTtsModelStatus('ready')
      } else {
        setTtsModelStatus('downloading')
      }
    })
  }, [])

  const refreshModelStatus = async (model?: string) => {
    const m = model || settings?.tts?.model
    if (!m || m === 'edge') { setTtsModelStatus('unknown'); return }
    try {
      const ready = await api.ttsModelStatus(m)
      setTtsModelStatus(ready ? 'ready' : 'unknown')
    } catch {
      setTtsModelStatus('unknown')
    }
  }

  const updateTts = (key: string, value: any) => {
    const ttsCfg = { enabled: true, speed: 0.9, model: 'edge', sid: 0, ...(settings!.tts || {}) }
    const nextTts = { ...ttsCfg, [key]: value }
    setSettings({ ...settings!, tts: nextTts })
    api.setSetting('tts', nextTts)
    if (key === 'model') refreshModelStatus()
  }

  // 当前模型支持的音色数（仅离线模型且已下载时展示）
  const currentModel = ttsModels.find((m) => m.id === settings?.tts?.model)
  const speakerCount = currentModel?.speakers && currentModel.speakers > 1 ? currentModel.speakers : 0

  const handleDownloadModel = async () => {
    const model = settings?.tts?.model
    if (!model || model === 'edge') return
    setTtsModelStatus('downloading')
    setTtsModelPercent(0)
    setTtsModelError('')
    const res = await api.ttsDownloadModel(model)
    if (res?.error) {
      setTtsModelStatus('error')
      setTtsModelError(res.error)
    } else {
      setTtsModelStatus('ready')
      setTtsModelPercent(100)
    }
  }

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
          <h2>{t('settings.title')}</h2>
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

          {/* TTS 朗读设置 */}
          <div className="settings-section-title">TTS 朗读</div>
          <div className="settings-row">
            <label>启用朗读</label>
            <label className="settings-toggle">
              <input
                type="checkbox"
                checked={settings.tts?.enabled ?? true}
                onChange={(e) => updateTts('enabled', e.target.checked)}
              />
              <span className="settings-slider" />
            </label>
          </div>
          <div className="settings-row">
            <label>语速</label>
            <div className="settings-tts-speed">
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={settings.tts?.speed ?? 0.9}
                onChange={(e) => updateTts('speed', parseFloat(e.target.value))}
              />
              <span className="settings-tts-speed-val">{(settings.tts?.speed ?? 0.9).toFixed(1)}x</span>
            </div>
          </div>
          <div className="settings-row">
            <label>TTS 模型</label>
            <select
              value={settings.tts?.model ?? 'edge'}
              onChange={(e) => updateTts('model', e.target.value)}
            >
              <option value="edge">Edge 内置</option>
              {ttsModels.map((m) => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
          {speakerCount > 0 && (
            <div className="settings-row">
              <label>音色</label>
              <select
                value={settings.tts?.sid ?? 0}
                onChange={(e) => updateTts('sid', parseInt(e.target.value, 10))}
              >
                {Array.from({ length: speakerCount }, (_, i) => (
                  <option key={i} value={i}>音色 {i + 1}</option>
                ))}
              </select>
            </div>
          )}
          {settings.tts?.model && settings.tts.model !== 'edge' && (
            <div className="settings-tts-model">
              {ttsModelStatus === 'ready' && (
                <span className="settings-update-feedback success">模型已就绪</span>
              )}
              {ttsModelStatus === 'downloading' && (
                <div className="settings-tts-download">
                  <span className="settings-update-feedback">正在下载模型 {ttsModelPercent}%</span>
                  <div className="settings-tts-progress">
                    <div className="settings-tts-progress-bar" style={{ width: `${ttsModelPercent}%` }} />
                  </div>
                </div>
              )}
              {ttsModelStatus === 'error' && (
                <span className="settings-update-feedback error">
                  下载失败: {ttsModelError || '网络不可用'}
                </span>
              )}
              {ttsModelStatus === 'unknown' && (
                <button className="settings-update-btn" onClick={handleDownloadModel}>
                  下载模型
                </button>
              )}
            </div>
          )}

          {/* 多窗口（2.6.0） */}
          <div className="settings-section-title">多窗口</div>
          <div className="settings-row">
            <label>在新窗口打开</label>
            <button className="settings-update-btn" onClick={() => api.openNewWindow(location.pathname + location.search)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
              新窗口
            </button>
          </div>

          {/* 版本更新 */}
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
