import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DocPreview } from '@doc-preview/react'
import { useThemeStore } from '@/store/theme'
import { fetchDocumentById } from '@/api/documents'
import { getFileTypeLabel, formatSize, formatDate } from '@/utils/fileType'
import { resolveUri } from '@/utils/url'
import BookmarkButton from '@/components/BookmarkButton'
import CommentPanel from '@/components/CommentPanel'
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
  const [doc, setDoc] = useState<Document | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const [copied, setCopied] = useState(false)
  const [showComments, setShowComments] = useState(false)
  const [officeBuffer, setOfficeBuffer] = useState<ArrayBuffer | null>(null)
  const copyTimer = useRef<ReturnType<typeof setTimeout>>()

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
    const url = window.location.href
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
          <h2>文档不存在</h2>
          <p>该文档可能已被删除或不可访问</p>
          <button className="btn-primary" onClick={() => navigate('/')}>
            返回列表
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
          返回
        </button>
        <div className="viewer-info">
          <span className="viewer-title">{doc.title}</span>
          <span className="viewer-meta">
            <span className="doc-tag">{getFileTypeLabel(doc.type)}</span>
            <span>{formatSize(doc.size)}</span>
            <span>{formatDate(doc.updatedAt)}</span>
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
            <span>{copied ? '已复制' : '转发'}</span>
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
        title="评论"
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
    </div>
  )
}
