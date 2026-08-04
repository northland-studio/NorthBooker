import { useState } from 'react'
import { createShareLink } from '@/api/share'

interface ShareDialogProps {
  docId: string
  onClose: () => void
}

// 统一的分享链接生成弹窗（文档和在线文档通用）
export default function ShareDialog({ docId, onClose }: ShareDialogProps) {
  const [password, setPassword] = useState('')
  const [expiration, setExpiration] = useState('')
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    setLoading(true)
    setError('')
    try {
      const expires_in_hours = expiration === '1h' ? 1 : expiration === '1d' ? 24 : expiration === '7d' ? 168 : 0
      const result = await createShareLink({ doc_id: docId, password: password || undefined, expires_in_hours })
      setUrl(result.url)
    } catch {
      setError('生成分享链接失败')
    } finally {
      setLoading(false)
    }
  }

  const copy = () => {
    navigator.clipboard.writeText(`${window.location.origin}${url}`).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="share-dialog-overlay" onClick={onClose}>
      <div className="share-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="settings-header">
          <h2>生成分享链接</h2>
          <button className="settings-close" onClick={onClose}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="share-dialog-body">
          {error && <div className="form-error">{error}</div>}
          <div className="form-group">
            <label>访问密码（可选）</label>
            <input className="form-input" type="text" placeholder="留空则不设密码" value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <div className="form-group">
            <label>有效期</label>
            <select className="sort-select" style={{ width: '100%' }} value={expiration} onChange={(e) => setExpiration(e.target.value)}>
              <option value="">永不过期</option>
              <option value="1h">1 小时</option>
              <option value="1d">1 天</option>
              <option value="7d">7 天</option>
            </select>
          </div>
          {url ? (
            <div className="form-group">
              <div style={{ display: 'flex', gap: 6 }}>
                <input className="form-input" style={{ flex: 1, marginTop: 0 }} value={`${window.location.origin}${url}`} readOnly />
                <button className="btn-primary" style={{ margin: 0, whiteSpace: 'nowrap' }} onClick={copy}>{copied ? '已复制' : '复制'}</button>
              </div>
            </div>
          ) : (
            <button className="btn-primary" style={{ width: '100%', margin: 0 }} onClick={handleGenerate} disabled={loading}>
              {loading ? '生成中...' : '生成链接'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
