import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { DocPreview } from '@doc-preview/react'
import { useThemeStore } from '@/store/theme'
import { fetchDocumentById } from '@/api/documents'
import { getFileTypeLabel, formatSize, formatDate } from '@/utils/fileType'
import { resolveUri } from '@/utils/url'
import { siteUrl } from '@/utils/site'
import { createShareLink } from '@/api/share'
import BookmarkButton from '@/components/BookmarkButton'
import CommentPanel from '@/components/CommentPanel'
import { useT } from '@/i18n'
import type { Document, FileType } from '@/types/document'
import type { PreviewDocument } from '@doc-preview/core'

// Office 文档类型需要通过 ArrayBuffer 传递（@doc-preview/office 的客户端渲染器拒绝 HTTP URL）
const OFFICE_TYPES: FileType[] = ['pptx', 'xlsx', 'csv']

function toFileTypeHint(type: FileType): string {
  const map: Record<string, string> = {
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    csv: 'text/csv',
  }
  return map[type] ?? type
}

// 文档查看页
export default function Viewer() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const theme = useThemeStore((s) => s.theme)
  const t = useT()
  const [doc, setDoc] = useState<Document | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [officeBuffer, setOfficeBuffer] = useState<ArrayBuffer | null>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout>>()

  // 分享模态框
  const [shareOpen, setShareOpen] = useState(false)
  const [sharePassword, setSharePassword] = useState('')
  const [shareExpiration, setShareExpiration] = useState('')
  const [shareUrl, setShareUrl] = useState('')
  const [shareLoading, setShareLoading] = useState(false)
  const [shareError, setShareError] = useState('')
  const [shareCopied, setShareCopied] = useState(false)

  useEffect(() => {
    setDoc(null)
    setError(false)
    setLoading(true)
    setOfficeBuffer(null)
    fetchDocumentById(id ?? '')
      .then((d) => {
        if (!d) return setError(true)
        setDoc(d)
        // Office 文档：预取 ArrayBuffer
        if (OFFICE_TYPES.includes(d.type)) {
          return fetch(resolveUri(d.uri))
            .then((r) => {
              if (!r.ok) throw new Error('fetch failed')
              return r.arrayBuffer()
            })
            .then((buf) => setOfficeBuffer(buf))
            .catch(() => setError(true))
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

  const handleShareOpen = () => {
    setShareUrl('')
    setSharePassword('')
    setShareExpiration('')
    setShareError('')
    setShareCopied(false)
    setShareOpen(true)
  }

  const handleGenerateShare = async () => {
    if (!id) return
    setShareLoading(true)
    setShareError('')
    try {
      const result = await createShareLink({
        doc_id: id,
        password: sharePassword || undefined,
        expires_in_hours: shareExpiration === '1h' ? 1 : shareExpiration === '1d' ? 24 : shareExpiration === '7d' ? 168 : 0,
      })
      setShareUrl(result.url)
    } catch {
      setShareError('生成分享链接失败')
    } finally {
      setShareLoading(false)
    }
  }

  const handleCopyShareUrl = () => {
    navigator.clipboard.writeText(siteUrl(shareUrl)).then(() => {
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
    })
  }

  const previewDoc: PreviewDocument | null = useMemo(() => {
    if (!doc) return null
    if (OFFICE_TYPES.includes(doc.type) && officeBuffer) {
      return {
        fileName: doc.fileName,
        fileType: toFileTypeHint(doc.type),
        arrayBuffer: officeBuffer,
      }
    }
    return { uri: resolveUri(doc.uri), fileName: doc.fileName }
  }, [doc, officeBuffer])

  const handleCopyLink = () => {
    const url = siteUrl(`/viewer/${doc?.id ?? ''}`)
    const text = `【${doc?.title ?? ''}】${url}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      clearTimeout(copyTimer.current)
      copyTimer.current = setTimeout(() => setCopied(false), 2000)
    })
  }

  if (error) {
    return (
      <div className="viewer-status-wrap">
        <div className="viewer-status-card">
          <h2>{t('viewer.notFound')}</h2>
          <p>{t('viewer.notFoundDesc')}</p>
          <button className="btn-primary" onClick={() => navigate('/')}>
            {t('viewer.backToList')}
          </button>
        </div>
      </div>
    )
  }

  if (loading || !doc || !previewDoc) {
    return <div className="viewer-status">加载中...</div>
  }

  return (
    <div className="viewer-page">
      <div className="viewer-toolbar">
        <button className="viewer-back" onClick={() => navigate('/')} aria-label="返回">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          {t('viewer.back')}
        </button>
        <div className="viewer-info">
          <span className="viewer-title">{doc.title}</span>
          <span className="viewer-meta">
            <span className="doc-tag">{getFileTypeLabel(doc.type)}</span>
            <span>{formatSize(doc.size)}</span>
            <span>{formatDate(doc.updatedAt)}</span>
            {doc.owner && (
              <Link to={`/profile/${doc.owner.id}`} className="user-link" title={doc.owner.username}>
                {doc.owner.avatar ? (
                  <img className="user-link-avatar" src={doc.owner.avatar} alt="" />
                ) : (
                  <span className="user-link-avatar-fallback">{doc.owner.username.slice(0, 1).toUpperCase()}</span>
                )}
                {doc.owner.username}
              </Link>
            )}
          </span>
        </div>
        <div className="viewer-actions">
          <BookmarkButton docId={doc.id} />
          <button className={`viewer-share ${copied ? 'copied' : ''}`} onClick={handleCopyLink} aria-label="复制链接">
            {copied ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
              </svg>
            )}
            <span>{copied ? t('viewer.copied') : t('viewer.forward')}</span>
          </button>
          <button className="viewer-share" onClick={handleShareOpen} aria-label="分享">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            <span>{t('viewer.share')}</span>
          </button>
        </div>
      </div>
      <div className="viewer-body">
        <div className="viewer-content">
          <DocPreview
            documents={[previewDoc]}
            dark={theme === 'dark'}
            config={{
              pdf: {
                defaultZoom: Math.max(window.devicePixelRatio || 1, 2),
              },
            }}
          />
        </div>
      </div>

      {/* 评论悬浮按钮 */}
      <button
        className={`comment-fab ${showComments ? 'comment-fab--active' : ''}`}
        onClick={() => setShowComments(!showComments)}
        title={t('viewer.comment')}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
      </button>

      <CommentPanel
        docId={doc.id}
        open={showComments}
        onClose={() => setShowComments(false)}
      />

      {/* 分享链接模态框 */}
      {shareOpen && (
        <div className="dialog-mask" onClick={() => setShareOpen(false)}>
          <div className="dialog-card" onClick={(e) => e.stopPropagation()}>
            <div className="dialog-header">
              <h3>生成分享链接</h3>
              <button className="dialog-close" onClick={() => setShareOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            {shareError && <div className="form-error">{shareError}</div>}
            <label className="form-label">
              密码（可选）
              <input
                className="form-input"
                type="text"
                placeholder="留空表示无需密码"
                value={sharePassword}
                onChange={(e) => setSharePassword(e.target.value)}
              />
            </label>
            <label className="form-label">
              有效期
              <select className="sort-select" style={{ width: '100%', marginTop: 6 }} value={shareExpiration} onChange={(e) => setShareExpiration(e.target.value)}>
                <option value="">永不过期</option>
                <option value="1h">1 小时</option>
                <option value="1d">1 天</option>
                <option value="7d">7 天</option>
              </select>
            </label>
            {shareUrl ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input className="form-input" style={{ flex: 1, marginTop: 0 }} value={siteUrl(shareUrl)} readOnly />
                  <button className="btn-primary" style={{ margin: 0, whiteSpace: 'nowrap', padding: '10px 14px', fontSize: 13 }} onClick={handleCopyShareUrl}>
                    {shareCopied ? '已复制' : '复制'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="dialog-actions">
                <button className="btn-ghost" onClick={() => setShareOpen(false)}>取消</button>
                <button className="btn-primary" style={{ margin: 0 }} onClick={handleGenerateShare} disabled={shareLoading}>
                  {shareLoading ? '生成中...' : '生成链接'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
