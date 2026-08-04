import { useEffect, useState } from 'react'

interface ReleaseNotes {
  version: string
  date: string
  changes: string[]
}

// 更新公告弹窗：监听 update-downloaded 事件，显示更新内容
export default function UpdatePopup() {
  const [notes, setNotes] = useState<ReleaseNotes | null>(null)
  const [show, setShow] = useState(false)

  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api?.isElectron) return

    const handler = async () => {
      const data = await api.fetchReleaseNotes()
      if (data) {
        setNotes(data)
        setShow(true)
      }
    }

    api.onUpdateDownloaded(handler)
    return () => {
      // 清理（electronAPI 事件不提供 removeListener，组件卸载时不影响）
    }
  }, [])

  if (!show || !notes) return null

  return (
    <div className="update-popup-overlay" onClick={() => setShow(false)}>
      <div className="update-popup" onClick={(e) => e.stopPropagation()}>
        <div className="update-popup-icon">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
        </div>
        <h2>北牖 {notes.version} 已就绪</h2>
        <p className="update-popup-date">{notes.date}</p>
        <ul className="update-popup-changes">
          {notes.changes.map((c, i) => (
            <li key={i}>{c}</li>
          ))}
        </ul>
        <div className="update-popup-actions">
          <button className="btn-secondary" onClick={() => setShow(false)}>
            稍后
          </button>
          <button
            className="btn-primary"
            onClick={() => {
              const api = (window as any).electronAPI
              api?.installUpdate()
            }}
          >
            立即重启安装
          </button>
        </div>
      </div>
    </div>
  )
}
