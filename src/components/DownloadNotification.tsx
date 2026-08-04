import { useEffect, useState } from 'react'

type Phase = 'hidden' | 'available' | 'downloading' | 'completed'

interface UpdateInfo {
  version: string
}

// 右下角下载通知：发现新版本 → 下载进度 → 完成
export default function DownloadNotification({
  onComplete,
  onShowUpdatePopup,
}: {
  onComplete?: () => void
  onShowUpdatePopup?: () => void
}) {
  const [phase, setPhase] = useState<Phase>('hidden')
  const [version, setVersion] = useState('')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')

  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api?.isElectron) return

    const onAvailable = (info: UpdateInfo) => {
      setVersion(info.version)
      setPhase('available')
      setError('')
    }

    const onProgress = (p: number) => {
      setProgress(Math.round(p))
      setPhase('downloading')
    }

    const onDownloaded = () => {
      setPhase('completed')
      setProgress(100)
      onComplete?.()
    }

    const onError = (msg: string) => {
      setError(msg)
      setPhase('available') // 回到可重试状态
    }

    // GitHub 下载失败时自动切换到 CDN → 自动重试下载
    const onSourceSwitched = () => {
      setError('')
      setPhase('downloading')
      setProgress(0)
      api.downloadUpdate()
    }

    api.onUpdateAvailable(onAvailable)
    api.onUpdateProgress(onProgress)
    api.onUpdateDownloaded(onDownloaded)
    api.onUpdateError(onError)
    api.onSourceSwitched(onSourceSwitched)

    return () => {
      // electronAPI 事件无 removeListener，组件卸载不影响
    }
  }, [])

  const api = (window as any).electronAPI

  const handleDownload = () => {
    setPhase('downloading')
    setProgress(0)
    api?.downloadUpdate()
  }

  const handleDismiss = () => {
    setPhase('hidden')
  }

  if (phase === 'hidden') return null

  return (
    <div className={`download-notification ${phase}`}>
      {/* 关闭按钮 */}
      <button className="dn-close" onClick={handleDismiss} aria-label="关闭">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>

      {/* 头图标 */}
      <div className="dn-icon">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
      </div>

      {/* 内容 */}
      <div className="dn-body">
        {phase === 'available' && (
          <>
            <div className="dn-title">发现新版本 v{version}</div>
            {error && <div className="dn-error">{error}</div>}
            <button className="dn-btn" onClick={handleDownload}>
              下载更新
            </button>
          </>
        )}

        {(phase === 'downloading' || phase === 'completed') && (
          <>
            <div className="dn-title">
              {phase === 'completed' ? '下载完成 v' + version : '正在下载 v' + version}
            </div>
            <div className="dn-progress-bar">
              <div className="dn-progress-fill" style={{ width: progress + '%' }} />
            </div>
            <div className="dn-progress-text">{progress}%</div>
          </>
        )}

        {phase === 'completed' && (
          <div className="dn-completed-actions">
            <button
              className="dn-btn dn-btn-primary"
              onClick={() => api?.installUpdate()}
            >
              立即重启以安装
            </button>
            <button className="dn-btn dn-btn-secondary" onClick={handleDismiss}>
              暂不更新
            </button>
            <button
              className="dn-btn dn-btn-ghost"
              onClick={onShowUpdatePopup}
            >
              查看更新内容
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
