import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DocPreview } from '@doc-preview/react'
import { useThemeStore } from '@/store/theme'
import { fetchDocumentById } from '@/api/documents'
import { getFileTypeLabel, formatSize, formatDate } from '@/utils/fileType'
import type { Document } from '@/types/document'

// 文档查看页
export default function Viewer() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const theme = useThemeStore((s) => s.theme)
  const [doc, setDoc] = useState<Document | null>(null)
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setDoc(null)
    setError(false)
    setLoading(true)
    fetchDocumentById(id ?? '')
      .then((d) => {
        if (d) setDoc(d)
        else setError(true)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [id])

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

  if (loading || !doc) {
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
      </div>
      <div className="viewer-content">
        <DocPreview documents={[{ uri: doc.uri, fileName: doc.fileName }]} dark={theme === 'dark'} />
      </div>
    </div>
  )
}
