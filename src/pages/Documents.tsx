import { useEffect, useMemo, useState } from 'react'
import { fetchDocuments } from '@/api/documents'
import type { Document, FileType } from '@/types/document'
import DocumentCard from '@/components/DocumentCard'
import UploadDialog from '@/components/UploadDialog'
import { useAuthStore } from '@/store/auth'
import { isAdmin } from '@/types/user'

type FilterType = FileType | 'all'

const FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'pdf', label: 'PDF' },
  { value: 'docx', label: 'Word' },
  { value: 'image', label: '图片' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'text', label: '文本' },
]

// 文档列表页
export default function Documents() {
  const [docs, setDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [sort, setSort] = useState<'updated' | 'title'>('updated')
  const [showUpload, setShowUpload] = useState(false)

  const user = useAuthStore((s) => s.user)
  const canUpload = isAdmin(user)

  const load = () => {
    setLoading(true)
    setError(false)
    fetchDocuments()
      .then((d) => {
        setDocs(d)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = useMemo(() => {
    let list = docs
    if (filter !== 'all') list = list.filter((d) => d.type === filter)
    const kw = keyword.trim()
    if (kw) list = list.filter((d) => d.title.includes(kw))
    return [...list].sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title, 'zh')
      return b.updatedAt.localeCompare(a.updatedAt)
    })
  }, [docs, filter, keyword, sort])

  return (
    <div className="documents-page">
      <div className="documents-toolbar">
        <input
          className="search-input"
          placeholder="搜索文档..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <div className="filter-tabs">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              className={`filter-tab ${filter === f.value ? 'active' : ''}`}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>
        <select
          className="sort-select"
          value={sort}
          onChange={(e) => setSort(e.target.value as 'updated' | 'title')}
        >
          <option value="updated">最近更新</option>
          <option value="title">标题排序</option>
        </select>
        {canUpload && (
          <button className="btn-upload" onClick={() => setShowUpload(true)}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            上传
          </button>
        )}
      </div>

      {loading ? (
        <div className="documents-status">加载中...</div>
      ) : error ? (
        <div className="documents-status">文档加载失败，请稍后重试</div>
      ) : filtered.length === 0 ? (
        <div className="documents-status">未找到匹配的文档</div>
      ) : (
        <div className="doc-grid">
          {filtered.map((d) => (
            <DocumentCard key={d.id} doc={d} />
          ))}
        </div>
      )}

      {showUpload && (
        <UploadDialog
          onClose={() => setShowUpload(false)}
          onUploaded={() => load()}
        />
      )}
    </div>
  )
}
