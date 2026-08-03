import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchDocuments } from '@/api/documents'
import { fetchBookmarks } from '@/api/bookmarks'
import type { Document, FileType } from '@/types/document'
import DocumentCard from '@/components/DocumentCard'
import FileTypeIcon from '@/components/FileTypeIcon'
import BookmarkButton from '@/components/BookmarkButton'
import UploadDialog from '@/components/UploadDialog'
import { useAuthStore } from '@/store/auth'
import { isAdmin } from '@/types/user'
import { getFileTypeLabel, formatSize, formatDate } from '@/utils/fileType'

type FilterType = FileType | 'all' | 'bookmarks'

const FILTERS: { value: FilterType; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'bookmarks', label: '书签' },
  { value: 'pdf', label: 'PDF' },
  { value: 'docx', label: 'Word' },
  { value: 'xlsx', label: 'Excel' },
  { value: 'pptx', label: 'PPT' },
  { value: 'image', label: '图片' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'text', label: '文本' },
]

// 文档列表页
export default function Documents() {
  const [docs, setDocs] = useState<Document[]>([])
  const [bookmarkDocs, setBookmarkDocs] = useState<Document[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [keyword, setKeyword] = useState('')
  const [filter, setFilter] = useState<FilterType>('all')
  const [sort, setSort] = useState<'updated' | 'title'>('updated')
  const [showUpload, setShowUpload] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const user = useAuthStore((s) => s.user)
  const canUpload = isAdmin(user)

  const load = () => {
    setLoading(true)
    setError(false)
    Promise.all([
      fetchDocuments().catch(() => []),
      user ? fetchBookmarks().catch(() => []) : Promise.resolve([]),
    ])
      .then(([docList, bmList]) => {
        setDocs(docList)
        setBookmarkDocs(bmList)
        setLoading(false)
      })
      .catch(() => {
        setError(true)
        setLoading(false)
      })
  }

  useEffect(() => {
    load()
  }, [user])

  const filtered = useMemo(() => {
    let list = filter === 'bookmarks' ? bookmarkDocs : docs
    if (filter !== 'all' && filter !== 'bookmarks') list = list.filter((d) => d.type === filter)
    const kw = keyword.trim()
    if (kw) list = list.filter((d) => d.title.includes(kw))
    return [...list].sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title, 'zh')
      return b.updatedAt.localeCompare(a.updatedAt)
    })
  }, [docs, bookmarkDocs, filter, keyword, sort])

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
        <div className="view-toggle">
          <button
            className={`vt-btn ${viewMode === 'grid' ? 'vt-btn--active' : ''}`}
            onClick={() => setViewMode('grid')}
            title="网格视图"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </button>
          <button
            className={`vt-btn ${viewMode === 'list' ? 'vt-btn--active' : ''}`}
            onClick={() => setViewMode('list')}
            title="列表视图"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="8" y1="6" x2="21" y2="6" />
              <line x1="8" y1="12" x2="21" y2="12" />
              <line x1="8" y1="18" x2="21" y2="18" />
              <line x1="3" y1="6" x2="3.01" y2="6" />
              <line x1="3" y1="12" x2="3.01" y2="12" />
              <line x1="3" y1="18" x2="3.01" y2="18" />
            </svg>
          </button>
        </div>
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
      ) : viewMode === 'list' ? (
        <div className="doc-list">
          <div className="doc-list-header">
            <span className="doc-list-cell doc-list-cell--name">名称</span>
            <span className="doc-list-cell doc-list-cell--type">类型</span>
            <span className="doc-list-cell doc-list-cell--size">大小</span>
            <span className="doc-list-cell doc-list-cell--date">更新时间</span>
            <span className="doc-list-cell doc-list-cell--actions" />
          </div>
          {filtered.map((d) => (
            <div key={d.id} className="doc-list-row">
              <Link to={`/viewer/${d.id}`} className="doc-list-cell doc-list-cell--name">
                {d.type === 'image' ? (
                  <img className="doc-list-thumb" src={d.uri} alt={d.title} />
                ) : (
                  <span className="doc-list-thumb doc-list-thumb--icon">
                    <FileTypeIcon type={d.type} />
                  </span>
                )}
                <span className="doc-list-title">{d.title}</span>
              </Link>
              <span className="doc-list-cell doc-list-cell--type">
                <span className="doc-tag">{getFileTypeLabel(d.type)}</span>
              </span>
              <span className="doc-list-cell doc-list-cell--size">{formatSize(d.size)}</span>
              <span className="doc-list-cell doc-list-cell--date">{formatDate(d.updatedAt)}</span>
              <span className="doc-list-cell doc-list-cell--actions">
                <BookmarkButton docId={d.id} />
              </span>
            </div>
          ))}
        </div>
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
