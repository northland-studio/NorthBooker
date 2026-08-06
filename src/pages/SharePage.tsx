import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { DocPreview } from '@doc-preview/react'
import type { PreviewDocument } from '@doc-preview/core'
import { useThemeStore } from '@/store/theme'
import { fetchShareInfo, verifyShare, type ShareDoc } from '@/api/share'
import { formatSize, formatDate } from '@/utils/fileType'
import { resolveUri } from '@/utils/url'

// Office 文档类型需要通过 ArrayBuffer 传递（@doc-preview/office 的客户端渲染器拒绝 HTTP URL）
const OFFICE_TYPES = ['pptx', 'xlsx', 'csv']

function toFileTypeHint(type: string): string {
  const map: Record<string, string> = {
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv',
  }
  return map[type] ?? type
}

// 分享落地页：/share/:token — 校验分享链接并展示文档/在线文档内容
export default function SharePage() {
  const { token } = useParams<{ token: string }>()
  const theme = useThemeStore((s) => s.theme)
  const [doc, setDoc] = useState<ShareDoc | null>(null)
  const [needPassword, setNeedPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [officeBuffer, setOfficeBuffer] = useState<ArrayBuffer | null>(null)

  useEffect(() => {
    if (!token) return
    setLoading(true)
    setError('')
    setDoc(null)
    setNeedPassword(false)
    setOfficeBuffer(null)
    fetchShareInfo(token)
      .then((info) => {
        if (info.hasPassword) {
          setNeedPassword(true)
        } else {
          return verifyShare(token).then(({ doc: d }) => setDoc(d))
        }
      })
      .catch((err: { response?: { data?: { error?: string } } }) => {
        setError(err.response?.data?.error || '链接不存在或已失效')
      })
      .finally(() => setLoading(false))
  }, [token])

  // Office 文档：预取 ArrayBuffer
  useEffect(() => {
    if (doc?.kind !== 'document' || !doc.uri || !OFFICE_TYPES.includes(doc.type || '')) return
    setOfficeBuffer(null)
    fetch(resolveUri(doc.uri))
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject()))
      .then((buf) => setOfficeBuffer(buf))
      .catch(() => {})
  }, [doc])

  const previewDoc: PreviewDocument | null = useMemo(() => {
    if (!doc || doc.kind !== 'document' || !doc.uri) return null
    if (OFFICE_TYPES.includes(doc.type || '') && officeBuffer) {
      return {
        fileName: doc.fileName || '',
        fileType: toFileTypeHint(doc.type || ''),
        arrayBuffer: officeBuffer,
      }
    }
    return { uri: resolveUri(doc.uri), fileName: doc.fileName || '' }
  }, [doc, officeBuffer])

  const handleVerify = async () => {
    if (!token) return
    setPasswordError('')
    try {
      const { doc: d } = await verifyShare(token, password)
      setDoc(d)
      setNeedPassword(false)
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } }
      setPasswordError(e.response?.data?.error || '密码错误')
    }
  }

  if (loading) {
    return (
      <div className="viewer-status-wrap">
        <div className="viewer-status">加载中...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="viewer-status-wrap">
        <div className="viewer-status-card">
          <h2>{error}</h2>
          <p>分享链接无效、已过期或对应文档已被删除。</p>
          <Link className="btn-primary" to="/" style={{ display: 'inline-block', marginTop: 12 }}>
            返回北牖首页
          </Link>
        </div>
      </div>
    )
  }

  if (needPassword) {
    return (
      <div className="share-page">
        <div className="share-head">
          <Link to="/" className="viewer-back">
            北牖 NorthBooker
          </Link>
        </div>
        <div className="share-lock-card">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
          <h2>此分享受密码保护</h2>
          <p>请输入分享者提供的访问密码以查看内容</p>
          <input
            className="form-input"
            type="password"
            placeholder="访问密码"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleVerify()}
            style={{ maxWidth: 260, margin: '10px auto 0' }}
          />
          {passwordError && <div className="form-error">{passwordError}</div>}
          <button className="btn-primary" style={{ margin: '12px auto 0' }} onClick={handleVerify}>
            查看内容
          </button>
        </div>
      </div>
    )
  }

  if (!doc) return null

  return (
    <div className="share-page">
      <div className="share-head">
        <Link to="/" className="viewer-back">
          北牖 NorthBooker
        </Link>
        <div className="share-head-info">
          <span className="share-title">{doc.title}</span>
          <span className="share-meta">
            {doc.kind === 'document' ? '文件分享' : '在线文档分享'}
            {doc.kind === 'document' && doc.size != null && ` · ${formatSize(doc.size)}`}
            {doc.updated_at && ` · ${formatDate(doc.updated_at)}`}
          </span>
        </div>
      </div>

      {doc.kind === 'page' ? (
        <div className="share-page-content">
          <h1 className="share-content-title">{doc.title}</h1>
          <div
            className="share-content-body"
            dangerouslySetInnerHTML={{ __html: doc.content || '' }}
          />
        </div>
      ) : (
        <div className="share-preview">
          {previewDoc ? (
            <DocPreview
              documents={[previewDoc]}
              dark={theme === 'dark'}
              config={{ pdf: { defaultZoom: Math.max(window.devicePixelRatio || 1, 2) } }}
            />
          ) : (
            <div className="viewer-status">正在加载文档...</div>
          )}
        </div>
      )}
    </div>
  )
}
